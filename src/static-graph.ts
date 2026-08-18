import { buildGraph } from "./graph";
import type { GalaxyGraph, GalaxyNode, GitHubRepo } from "./types";

const REPO_NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;
const MAX_STATIC_BYTES = 2_000_000;
const MAX_REPOSITORIES = 400;

function finiteNonNegative(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function safeString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function safeTopics(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((topic): topic is string => typeof topic === "string")
    .slice(0, 20)
    .map((topic) => topic.slice(0, 50));
}

function validatedRepositoryUrl(value: unknown, username: string, repoName: string): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "github.com") return null;
    const segments = url.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
    if (segments.length < 2) return null;
    if (segments[0].toLowerCase() !== username.toLowerCase()) return null;
    if (segments[1].toLowerCase() !== repoName.toLowerCase()) return null;
    return `https://github.com/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}`;
  } catch {
    return null;
  }
}

export function sanitizeStaticGraph(value: unknown, username: string): GalaxyGraph | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { owner?: unknown; generatedAt?: unknown; nodes?: unknown };
  if (typeof candidate.owner !== "string" || candidate.owner.toLowerCase() !== username.toLowerCase()) return null;
  if (!Array.isArray(candidate.nodes)) return null;

  const repoNodes = candidate.nodes.filter((node): node is GalaxyNode => {
    return Boolean(node && typeof node === "object" && (node as GalaxyNode).type === "repository");
  });
  if (repoNodes.length > MAX_REPOSITORIES) return null;

  const repos: GitHubRepo[] = [];
  const seen = new Set<string>();
  for (const node of repoNodes) {
    const name = typeof node.label === "string" ? node.label : "";
    if (!REPO_NAME_RE.test(name)) return null;
    const key = name.toLowerCase();
    if (seen.has(key)) return null;
    seen.add(key);
    const htmlUrl = validatedRepositoryUrl(node.url, username, name);
    if (!htmlUrl) return null;
    repos.push({
      id: repos.length + 1,
      name,
      html_url: htmlUrl,
      description: safeString(node.description, 2_000) || null,
      language: typeof node.language === "string" ? node.language.slice(0, 100) : null,
      topics: safeTopics(node.topics),
      stargazers_count: finiteNonNegative(node.stars),
      forks_count: finiteNonNegative(node.forks),
      fork: node.fork === true,
      archived: node.archived === true,
      updated_at: typeof node.updatedAt === "string" ? node.updatedAt.slice(0, 64) : "",
    });
  }

  const graph = buildGraph(username.toLowerCase(), repos, true, true);
  if (typeof candidate.generatedAt === "string" && Number.isFinite(Date.parse(candidate.generatedAt))) {
    graph.generatedAt = candidate.generatedAt;
  }
  return graph;
}

async function graphFromResponse(response: Response, username: string): Promise<GalaxyGraph | null> {
  if (!response.ok) return null;
  const length = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(length) && length > MAX_STATIC_BYTES) return null;
  const text = await response.text();
  if (text.length > MAX_STATIC_BYTES) return null;
  try {
    return sanitizeStaticGraph(JSON.parse(text), username);
  } catch {
    return null;
  }
}

export async function fetchStaticProfileGraph(username: string): Promise<GalaxyGraph | null> {
  const owner = encodeURIComponent(username);
  for (const ref of ["main", "master"]) {
    const url = `https://raw.githubusercontent.com/${owner}/${owner}/${ref}/project-map/graph.json`;
    try {
      const graph = await graphFromResponse(await fetch(url), username);
      if (graph) return graph;
    } catch {
      // A missing/unreachable static file is not fatal; the hosted API can fall back to GitHub REST.
    }
  }
  return null;
}
