import { buildGraph } from "./graph.ts";
import type {
  ClassificationEvidence,
  ClassificationEvidenceSource,
  GalaxyGraph,
  GalaxyNode,
  GitHubRepo,
  RepositoryClassification,
  SemanticEdge,
} from "./types.ts";

const REPO_NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;
const CATEGORY_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const MAX_STATIC_BYTES = 2_000_000;
const MAX_REPOSITORIES = 400;
const MAX_CLASSIFICATION_EVIDENCE = 24;
const MAX_SEMANTIC_EDGES = 1200;
const EVIDENCE_SOURCES = new Set<ClassificationEvidenceSource>([
  "name", "description", "topic", "readme", "manifest", "dependency", "fork-source", "embedding", "llm", "override",
]);
const CLASSIFICATION_METHODS = new Set<RepositoryClassification["method"]>(["deterministic", "semantic", "llm", "override"]);

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

function safeClassificationEvidence(value: unknown): ClassificationEvidence[] {
  if (!Array.isArray(value)) return [];
  const evidence: ClassificationEvidence[] = [];
  for (const raw of value.slice(0, MAX_CLASSIFICATION_EVIDENCE)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const categoryId = safeString(item.categoryId, 80);
    const source = item.source;
    const evidenceValue = safeString(item.value, 120);
    const weight = item.weight;
    if (!CATEGORY_ID_RE.test(categoryId)) continue;
    if (typeof source !== "string" || !EVIDENCE_SOURCES.has(source as ClassificationEvidenceSource)) continue;
    if (!evidenceValue) continue;
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0 || weight > 10) continue;
    const path = safeString(item.path, 160);
    evidence.push({
      categoryId,
      source: source as ClassificationEvidenceSource,
      value: evidenceValue,
      weight,
      ...(path ? { path } : {}),
    });
  }
  return evidence;
}

function safeClassification(value: unknown): RepositoryClassification | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  const categoryId = safeString(candidate.categoryId, 80);
  const categoryLabel = safeString(candidate.categoryLabel, 100);
  const confidence = candidate.confidence;
  const method = candidate.method;
  if (!CATEGORY_ID_RE.test(categoryId) || !categoryLabel) return undefined;
  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) return undefined;
  if (typeof method !== "string" || !CLASSIFICATION_METHODS.has(method as RepositoryClassification["method"])) return undefined;
  const secondaryTags = Array.isArray(candidate.secondaryTags)
    ? candidate.secondaryTags.filter((tag): tag is string => typeof tag === "string").slice(0, 8).map((tag) => tag.slice(0, 60))
    : [];
  return {
    categoryId,
    categoryLabel,
    secondaryTags,
    confidence,
    method: method as RepositoryClassification["method"],
    evidence: safeClassificationEvidence(candidate.evidence),
  };
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

function safeSemanticEdges(value: unknown, repositoryIds: Set<string>): SemanticEdge[] {
  if (!Array.isArray(value)) return [];
  const byPair = new Map<string, SemanticEdge>();
  for (const raw of value.slice(0, MAX_SEMANTIC_EDGES * 2)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const source = safeString(item.source, 220);
    const target = safeString(item.target, 220);
    const score = item.score;
    if (item.type !== "semantic" || source === target) continue;
    if (!repositoryIds.has(source) || !repositoryIds.has(target)) continue;
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) continue;
    const left = source < target ? source : target;
    const right = source < target ? target : source;
    const key = `${left}\u0000${right}`;
    const edge: SemanticEdge = { source: left, target: right, type: "semantic", score: Math.round(score * 1_000_000) / 1_000_000 };
    const existing = byPair.get(key);
    if (!existing || edge.score > existing.score) byPair.set(key, edge);
  }
  return [...byPair.values()]
    .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source) || a.target.localeCompare(b.target))
    .slice(0, MAX_SEMANTIC_EDGES);
}

export function sanitizeStaticGraph(value: unknown, username: string): GalaxyGraph | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { owner?: unknown; generatedAt?: unknown; nodes?: unknown; classificationVersion?: unknown; semanticEdges?: unknown };
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
    const classification = safeClassification(node.classification);
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
      ...(classification ? { classification } : {}),
    });
  }

  const graph = buildGraph(username.toLowerCase(), repos, true, true);
  if (typeof candidate.generatedAt === "string" && Number.isFinite(Date.parse(candidate.generatedAt))) {
    graph.generatedAt = candidate.generatedAt;
  }
  if (typeof candidate.classificationVersion === "number"
    && Number.isInteger(candidate.classificationVersion)
    && candidate.classificationVersion >= 1
    && candidate.classificationVersion <= 100) {
    graph.classificationVersion = candidate.classificationVersion;
  }
  const repositoryIds = new Set(graph.nodes.filter((node) => node.type === "repository").map((node) => node.id));
  const semanticEdges = safeSemanticEdges(candidate.semanticEdges, repositoryIds);
  if (semanticEdges.length) graph.semanticEdges = semanticEdges;
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
  const url = `https://raw.githubusercontent.com/${owner}/${owner}/HEAD/project-map/graph.json`;
  try {
    return await graphFromResponse(await fetch(url), username);
  } catch {
    return null;
  }
}
