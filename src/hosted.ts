import { buildGraph } from "./graph";
import { fetchPublicRepos } from "./github";
import { boolParam, intParam } from "./params";
import type { Env, GalaxyGraph } from "./types";

const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const GRAPH_CACHE_SECONDS = 900;

type CacheStorageWithDefault = CacheStorage & { default: Cache };

export interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

export interface GraphRequestOptions {
  username: string;
  maxRepos: number;
  includeForks: boolean;
  includeArchived: boolean;
}

export type GraphCacheStatus = "HIT" | "MISS";

export function normalizeUsername(value: string): string {
  const username = value.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) throw new Error("Invalid GitHub username");
  return username;
}

export function graphOptionsFromUrl(url: URL): GraphRequestOptions {
  return {
    username: normalizeUsername(url.searchParams.get("username") ?? ""),
    maxRepos: intParam(url, "max_repos", 100, 1, 300),
    includeForks: boolParam(url, "forks", true),
    includeArchived: boolParam(url, "archived", false),
  };
}

export function graphCacheRequest(origin: string, options: GraphRequestOptions): Request {
  const url = new URL("/__cache/graph", origin);
  url.searchParams.set("username", options.username);
  url.searchParams.set("max_repos", String(options.maxRepos));
  url.searchParams.set("forks", String(options.includeForks));
  url.searchParams.set("archived", String(options.includeArchived));
  return new Request(url.toString(), { method: "GET" });
}

function clientAddress(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

async function enforceLimiter(
  limiter: Env["API_RATE_LIMITER"],
  key: string,
  message: string,
): Promise<void> {
  if (!limiter) return;
  const { success } = await limiter.limit({ key });
  if (!success) throw new Error(message);
}

export async function getGraph(
  request: Request,
  env: Env,
  ctx: WorkerContext,
): Promise<{ graph: GalaxyGraph; cacheStatus: GraphCacheStatus }> {
  const url = new URL(request.url);
  const options = graphOptionsFromUrl(url);
  const address = clientAddress(request);

  await enforceLimiter(env.API_RATE_LIMITER, `client:${address}`, "Hosted service rate limit reached");

  const cache = (caches as CacheStorageWithDefault).default;
  const cacheKey = graphCacheRequest(url.origin, options);
  const cached = await cache.match(cacheKey);

  if (cached) {
    return {
      graph: await cached.json() as GalaxyGraph,
      cacheStatus: "HIT",
    };
  }

  await enforceLimiter(env.UPSTREAM_RATE_LIMITER, `client:${address}`, "Too many uncached GitHub lookups");
  await enforceLimiter(env.GLOBAL_UPSTREAM_RATE_LIMITER, "github-upstream", "Hosted service is busy. Try again shortly.");

  const repos = await fetchPublicRepos(options.username, env, options.maxRepos);
  const graph = buildGraph(options.username, repos, options.includeForks, options.includeArchived);
  const cacheResponse = Response.json(graph, {
    headers: { "Cache-Control": `public, max-age=${GRAPH_CACHE_SECONDS}` },
  });

  ctx.waitUntil(cache.put(cacheKey, cacheResponse));
  return { graph, cacheStatus: "MISS" };
}
