import { buildGraph } from "./graph";
import { fetchPublicRepos } from "./github";
import { graphCacheRequest, normalizeUsername, type GraphRequestOptions } from "./hosted-options";
import { boolParam, intParam } from "./params";
import type { Env, GalaxyGraph } from "./types";

export { normalizeUsername } from "./hosted-options";

const GRAPH_CACHE_SECONDS = 900;
const inflightGraphs = new Map<string, Promise<GalaxyGraph>>();

type CacheStorageWithDefault = CacheStorage & { default: Cache };

export interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

export type GraphCacheStatus = "HIT" | "MISS" | "COALESCED";

export function graphOptionsFromUrl(url: URL): GraphRequestOptions {
  return {
    username: normalizeUsername(url.searchParams.get("username") ?? ""),
    maxRepos: intParam(url, "max_repos", 100, 1, 300),
    includeForks: boolParam(url, "forks", true),
    includeArchived: boolParam(url, "archived", false),
  };
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

  const inflightKey = cacheKey.url;
  const existing = inflightGraphs.get(inflightKey);
  if (existing) {
    return { graph: await existing, cacheStatus: "COALESCED" };
  }

  const loadGraph = (async () => {
    await enforceLimiter(env.UPSTREAM_RATE_LIMITER, `client:${address}`, "Too many uncached GitHub lookups");
    await enforceLimiter(env.GLOBAL_UPSTREAM_RATE_LIMITER, "github-upstream", "Hosted service is busy. Try again shortly.");

    const repos = await fetchPublicRepos(options.username, env, options.maxRepos, {
      includeForks: options.includeForks,
      includeArchived: options.includeArchived,
    });
    const graph = buildGraph(options.username, repos, options.includeForks, options.includeArchived);
    const cacheResponse = Response.json(graph, {
      headers: { "Cache-Control": `public, max-age=${GRAPH_CACHE_SECONDS}` },
    });

    ctx.waitUntil(cache.put(cacheKey, cacheResponse));
    return graph;
  })();

  inflightGraphs.set(inflightKey, loadGraph);
  try {
    return { graph: await loadGraph, cacheStatus: "MISS" };
  } finally {
    if (inflightGraphs.get(inflightKey) === loadGraph) inflightGraphs.delete(inflightKey);
  }
}
