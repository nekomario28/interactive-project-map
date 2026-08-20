import { buildGraph } from "./graph";
import { fetchPublicRepos } from "./github";
import { graphCacheRequest, normalizeUsername, type GraphRequestOptions } from "./hosted-options";
import { boolParam, intParam } from "./params";
import { fetchStaticProfileGraph } from "./static-graph";
import { attachStandardTaxonomyToGraph } from "./standard-taxonomy-runtime";
import type { Env, GalaxyGraph } from "./types";

export { normalizeUsername } from "./hosted-options";

const GRAPH_CACHE_SECONDS = 900;

export type GraphSource = "STATIC" | "GITHUB";
type LoadedGraph = { graph: GalaxyGraph; source: GraphSource };
const inflightGraphs = new Map<string, Promise<LoadedGraph>>();

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

function cacheResponse(loaded: LoadedGraph): Response {
  return Response.json(loaded.graph, {
    headers: {
      "Cache-Control": `public, max-age=${GRAPH_CACHE_SECONDS}`,
      "X-Project-Map-Source": loaded.source,
    },
  });
}

export async function getGraph(
  request: Request,
  env: Env,
  ctx: WorkerContext,
): Promise<{ graph: GalaxyGraph; cacheStatus: GraphCacheStatus; source: GraphSource }> {
  const url = new URL(request.url);
  const options = graphOptionsFromUrl(url);
  const preferStatic = boolParam(url, "static", false);
  const address = clientAddress(request);

  await enforceLimiter(env.API_RATE_LIMITER, `client:${address}`, "Hosted service rate limit reached");

  const cache = (caches as CacheStorageWithDefault).default;
  const cacheKey = graphCacheRequest(url.origin, options, preferStatic ? "profile" : "dynamic");
  const cached = await cache.match(cacheKey);

  if (cached) {
    const source: GraphSource = cached.headers.get("X-Project-Map-Source") === "STATIC" ? "STATIC" : "GITHUB";
    return {
      graph: await cached.json() as GalaxyGraph,
      cacheStatus: "HIT",
      source,
    };
  }

  const inflightKey = cacheKey.url;
  const existing = inflightGraphs.get(inflightKey);
  if (existing) {
    const loaded = await existing;
    return { ...loaded, cacheStatus: "COALESCED" };
  }

  const loadGraph = (async (): Promise<LoadedGraph> => {
    if (preferStatic) {
      const staticGraph = await fetchStaticProfileGraph(options.username);
      if (staticGraph) {
        const loaded: LoadedGraph = { graph: staticGraph, source: "STATIC" };
        ctx.waitUntil(cache.put(cacheKey, cacheResponse(loaded)));
        return loaded;
      }
    }

    await enforceLimiter(env.UPSTREAM_RATE_LIMITER, `client:${address}`, "Too many uncached GitHub lookups");
    await enforceLimiter(env.GLOBAL_UPSTREAM_RATE_LIMITER, "github-upstream", "Hosted service is busy. Try again shortly.");

    const repos = await fetchPublicRepos(options.username, env, options.maxRepos, {
      includeForks: options.includeForks,
      includeArchived: options.includeArchived,
    });
    const graph = buildGraph(options.username, repos, options.includeForks, options.includeArchived);
    await attachStandardTaxonomyToGraph(graph, repos);
    const loaded: LoadedGraph = { graph, source: "GITHUB" };
    ctx.waitUntil(cache.put(cacheKey, cacheResponse(loaded)));
    return loaded;
  })();

  inflightGraphs.set(inflightKey, loadGraph);
  try {
    const loaded = await loadGraph;
    return { ...loaded, cacheStatus: "MISS" };
  } finally {
    if (inflightGraphs.get(inflightKey) === loadGraph) inflightGraphs.delete(inflightKey);
  }
}