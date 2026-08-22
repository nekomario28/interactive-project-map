import { attachContributedRepositories, type ContributedRepositoryRecord } from "./contributed-graph.ts";
import { buildGraph } from "./graph.ts";
import { promoteStandardHierarchy } from "./standard-hierarchy.ts";
import { sanitizePortfolioTaxonomy } from "./taxonomy.ts";
import type { ClassificationEvidence, ClassificationEvidenceSource, ExternalContributionDiagnostics, GalaxyGraph, GalaxyNode, GitHubRepo, PortfolioTaxonomy, RepositoryClassification, RepositoryTaxonomyAssignment, SemanticEdge } from "./types.ts";

const REPO_NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;
const OWNER_NAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const CATEGORY_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const MAX_STATIC_BYTES = 2_000_000;
const MAX_REPOSITORIES = 400;
const MAX_CONTRIBUTED_REPOSITORIES = 12;
const MAX_CONTRIBUTION_COUNT = 1_000_000;
const MAX_CLASSIFICATION_EVIDENCE = 24;
const MAX_SEMANTIC_EDGES = 1200;
const EVIDENCE_SOURCES = new Set<ClassificationEvidenceSource>(["name", "description", "topic", "readme", "manifest", "dependency", "fork-source", "embedding", "llm", "override"]);
const CLASSIFICATION_METHODS = new Set<RepositoryClassification["method"]>(["deterministic", "semantic", "llm", "override"]);
const TAXONOMY_ASSIGNMENT_METHODS = new Set<RepositoryTaxonomyAssignment["method"]>(["override", "deterministic", "semantic", "llm"]);

function finiteNonNegative(value: unknown): number { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0; }
function safeString(value: unknown, maxLength: number): string { return typeof value === "string" ? value.slice(0, maxLength) : ""; }
function safeTopics(value: unknown): string[] { if (!Array.isArray(value)) return []; return value.filter((topic): topic is string => typeof topic === "string").slice(0, 20).map((topic) => topic.slice(0, 50)); }
function safeTags(value: unknown): string[] { if (!Array.isArray(value)) return []; return value.filter((tag): tag is string => typeof tag === "string").slice(0, 8).map((tag) => tag.slice(0, 60)); }
function safeBoundedInt(value: unknown, max: number): number | null { return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max ? value : null; }
function validIso(value: unknown): value is string { return typeof value === "string" && Number.isFinite(Date.parse(value)); }

function safeClassificationEvidence(value: unknown): ClassificationEvidence[] {
  if (!Array.isArray(value)) return [];
  const evidence: ClassificationEvidence[] = [];
  for (const raw of value.slice(0, MAX_CLASSIFICATION_EVIDENCE)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const categoryId = safeString(item.categoryId, 80); const source = item.source; const evidenceValue = safeString(item.value, 120); const weight = item.weight;
    if (!CATEGORY_ID_RE.test(categoryId)) continue;
    if (typeof source !== "string" || !EVIDENCE_SOURCES.has(source as ClassificationEvidenceSource)) continue;
    if (!evidenceValue) continue;
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0 || weight > 10) continue;
    const path = safeString(item.path, 160);
    evidence.push({ categoryId, source: source as ClassificationEvidenceSource, value: evidenceValue, weight, ...(path ? { path } : {}) });
  }
  return evidence;
}

function safeClassification(value: unknown): RepositoryClassification | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  const categoryId = safeString(candidate.categoryId, 80); const categoryLabel = safeString(candidate.categoryLabel, 100); const confidence = candidate.confidence; const method = candidate.method;
  if (!CATEGORY_ID_RE.test(categoryId) || !categoryLabel) return undefined;
  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) return undefined;
  if (typeof method !== "string" || !CLASSIFICATION_METHODS.has(method as RepositoryClassification["method"])) return undefined;
  return { categoryId, categoryLabel, secondaryTags: safeTags(candidate.secondaryTags), confidence, method: method as RepositoryClassification["method"], evidence: safeClassificationEvidence(candidate.evidence) };
}

function safeTaxonomyAssignment(value: unknown, taxonomy: PortfolioTaxonomy): RepositoryTaxonomyAssignment | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  const categoryId = safeString(candidate.categoryId, 80).toLowerCase(); const category = taxonomy.categories.find((item) => item.id === categoryId); const confidence = candidate.confidence; const method = candidate.method;
  if (!category) return undefined;
  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) return undefined;
  if (typeof method !== "string" || !TAXONOMY_ASSIGNMENT_METHODS.has(method as RepositoryTaxonomyAssignment["method"])) return undefined;
  const evidence = safeClassificationEvidence(candidate.evidence).filter((item) => item.categoryId === categoryId);
  const assignment: RepositoryTaxonomyAssignment = { categoryId, categoryLabel: category.label, secondaryTags: safeTags(candidate.secondaryTags), confidence, method: method as RepositoryTaxonomyAssignment["method"], evidence };
  if (typeof candidate.score === "number" && Number.isFinite(candidate.score) && candidate.score >= -1 && candidate.score <= 1) assignment.score = candidate.score;
  if (typeof candidate.margin === "number" && Number.isFinite(candidate.margin) && candidate.margin >= 0 && candidate.margin <= 2) assignment.margin = candidate.margin;
  return assignment;
}

function validatedRepositoryUrl(value: unknown, owner: string, repoName: string): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value); if (url.protocol !== "https:" || url.hostname !== "github.com") return null;
    const segments = url.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
    if (segments.length !== 2 || segments[0].toLowerCase() !== owner.toLowerCase() || segments[1].toLowerCase() !== repoName.toLowerCase()) return null;
    return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`;
  } catch { return null; }
}

function safeSemanticEdges(value: unknown, repositoryIds: Set<string>): SemanticEdge[] {
  if (!Array.isArray(value)) return [];
  const byPair = new Map<string, SemanticEdge>();
  for (const raw of value.slice(0, MAX_SEMANTIC_EDGES * 2)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>; const source = safeString(item.source, 220); const target = safeString(item.target, 220); const score = item.score;
    if (item.type !== "semantic" || source === target || !repositoryIds.has(source) || !repositoryIds.has(target)) continue;
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) continue;
    const left = source < target ? source : target; const right = source < target ? target : source; const key = `${left}\u0000${right}`;
    const edge: SemanticEdge = { source: left, target: right, type: "semantic", score: Math.round(score * 1_000_000) / 1_000_000 };
    const existing = byPair.get(key); if (!existing || edge.score > existing.score) byPair.set(key, edge);
  }
  return [...byPair.values()].sort((a, b) => b.score - a.score || a.source.localeCompare(b.source) || a.target.localeCompare(b.target)).slice(0, MAX_SEMANTIC_EDGES);
}

function safeExternalDiagnostics(value: unknown): ExternalContributionDiagnostics | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const window = candidate.window as Record<string, unknown> | undefined;
  if (!window || !validIso(window.from) || !validIso(window.to) || Date.parse(window.from) > Date.parse(window.to)) return null;
  const cap = safeBoundedInt(candidate.cap, MAX_CONTRIBUTED_REPOSITORIES);
  const candidates = safeBoundedInt(candidate.candidateRepositories, 100);
  const included = safeBoundedInt(candidate.includedRepositories, MAX_CONTRIBUTED_REPOSITORIES);
  const omitted = safeBoundedInt(candidate.omittedRepositories, 100);
  const truncated = safeBoundedInt(candidate.truncatedRepositories, 100);
  if (cap === null || candidates === null || included === null || omitted === null || truncated === null) return null;
  if (included > cap || included > candidates || omitted > candidates) return null;
  return { window: { from: window.from, to: window.to }, cap, candidateRepositories: candidates, includedRepositories: included, omittedRepositories: omitted, truncatedRepositories: truncated };
}

function safeContributedRepository(node: GalaxyNode, username: string): ContributedRepositoryRecord | null {
  if (node.relation !== "contributed") return null;
  const owner = safeString(node.repositoryOwner, 39); const name = safeString(node.repositoryName, 100); const fullName = safeString(node.label, 141);
  if (!OWNER_NAME_RE.test(owner) || !REPO_NAME_RE.test(name) || fullName.toLowerCase() !== `${owner}/${name}`.toLowerCase() || owner.toLowerCase() === username.toLowerCase()) return null;
  const url = validatedRepositoryUrl(node.url, owner, name); if (!url) return null;
  const contribution = node.contribution;
  if (!contribution || typeof contribution !== "object") return null;
  const commits = safeBoundedInt(contribution.commits, MAX_CONTRIBUTION_COUNT);
  const pullRequests = safeBoundedInt(contribution.pullRequests, MAX_CONTRIBUTION_COUNT);
  const mergedPullRequests = safeBoundedInt(contribution.mergedPullRequests, MAX_CONTRIBUTION_COUNT);
  if (commits === null || pullRequests === null || mergedPullRequests === null || mergedPullRequests > pullRequests || (commits === 0 && pullRequests === 0)) return null;
  if (typeof contribution.commitsTruncated !== "boolean" || typeof contribution.pullRequestsTruncated !== "boolean") return null;
  const classification = safeClassification(node.classification);
  return {
    nameWithOwner: `${owner}/${name}`, owner, name, url,
    description: safeString(node.description, 2_000), language: typeof node.language === "string" ? node.language.slice(0, 100) : null, topics: safeTopics(node.topics),
    stars: finiteNonNegative(node.stars), forks: finiteNonNegative(node.forks), fork: node.fork === true, archived: node.archived === true,
    ...(validIso(node.createdAt) ? { createdAt: node.createdAt } : {}), ...(validIso(node.updatedAt) ? { updatedAt: node.updatedAt } : {}),
    commits, pullRequests, mergedPullRequests, commitsTruncated: contribution.commitsTruncated, pullRequestsTruncated: contribution.pullRequestsTruncated,
    ...(classification ? { classification } : {}),
  };
}

export function sanitizeStaticGraph(value: unknown, username: string): GalaxyGraph | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { owner?: unknown; generatedAt?: unknown; nodes?: unknown; classificationVersion?: unknown; semanticEdges?: unknown; taxonomy?: unknown; taxonomyAssignmentVersion?: unknown; externalContributions?: unknown };
  if (typeof candidate.owner !== "string" || candidate.owner.toLowerCase() !== username.toLowerCase() || !Array.isArray(candidate.nodes)) return null;
  const repoNodes = candidate.nodes.filter((node): node is GalaxyNode => Boolean(node && typeof node === "object" && (node as GalaxyNode).type === "repository"));
  if (repoNodes.length > MAX_REPOSITORIES) return null;
  const ownedNodes = repoNodes.filter((node) => node.relation !== "contributed");
  const contributedNodes = repoNodes.filter((node) => node.relation === "contributed");
  if (contributedNodes.length > MAX_CONTRIBUTED_REPOSITORIES) return null;

  const repos: GitHubRepo[] = []; const seen = new Set<string>();
  for (const node of ownedNodes) {
    if (node.relation != null) return null;
    const name = typeof node.label === "string" ? node.label : ""; if (!REPO_NAME_RE.test(name)) return null;
    const key = name.toLowerCase(); if (seen.has(key)) return null; seen.add(key);
    const htmlUrl = validatedRepositoryUrl(node.url, username, name); if (!htmlUrl) return null;
    const classification = safeClassification(node.classification);
    repos.push({ id: repos.length + 1, name, html_url: htmlUrl, description: safeString(node.description, 2_000) || null, language: typeof node.language === "string" ? node.language.slice(0, 100) : null, topics: safeTopics(node.topics), stargazers_count: finiteNonNegative(node.stars), forks_count: finiteNonNegative(node.forks), fork: node.fork === true, archived: node.archived === true, updated_at: validIso(node.updatedAt) ? node.updatedAt : "", ...(classification ? { classification } : {}) });
  }

  let graph = buildGraph(username.toLowerCase(), repos, true, true);
  if (contributedNodes.length) {
    const diagnostics = safeExternalDiagnostics(candidate.externalContributions); if (!diagnostics || diagnostics.includedRepositories !== contributedNodes.length) return null;
    const externalRecords: ContributedRepositoryRecord[] = [];
    const externalIds = new Set<string>();
    for (const node of contributedNodes) {
      const record = safeContributedRepository(node, username); if (!record) return null;
      const id = `${record.owner}/${record.name}`.toLowerCase(); if (externalIds.has(id)) return null; externalIds.add(id); externalRecords.push(record);
    }
    graph = attachContributedRepositories(graph, externalRecords, diagnostics.window, diagnostics);
    if (graph.contributedRepositoryCount !== contributedNodes.length) return null;
  } else if (candidate.externalContributions != null) {
    const diagnostics = safeExternalDiagnostics(candidate.externalContributions); if (!diagnostics || diagnostics.includedRepositories !== 0) return null;
    graph.externalContributions = diagnostics;
    graph.contributedRepositoryCount = 0;
  }

  if (typeof candidate.generatedAt === "string" && Number.isFinite(Date.parse(candidate.generatedAt))) graph.generatedAt = candidate.generatedAt;
  if (typeof candidate.classificationVersion === "number" && Number.isInteger(candidate.classificationVersion) && candidate.classificationVersion >= 1 && candidate.classificationVersion <= 100) graph.classificationVersion = candidate.classificationVersion;
  const repositoryIds = new Set(graph.nodes.filter((node) => node.type === "repository").map((node) => node.id)); const semanticEdges = safeSemanticEdges(candidate.semanticEdges, repositoryIds); if (semanticEdges.length) graph.semanticEdges = semanticEdges;
  const taxonomy = sanitizePortfolioTaxonomy(candidate.taxonomy);
  if (taxonomy) {
    graph.taxonomy = taxonomy;
    const inputByName = new Map(ownedNodes.map((node) => [String(node.label).toLowerCase(), node])); let assignments = 0;
    for (const node of graph.nodes) {
      if (node.type !== "repository" || node.relation === "contributed") continue;
      const assignment = safeTaxonomyAssignment(inputByName.get(String(node.label).toLowerCase())?.taxonomyAssignment, taxonomy);
      if (!assignment) continue; node.taxonomyAssignment = assignment; assignments += 1;
    }
    if (assignments > 0) graph.taxonomyAssignmentVersion = 1;
    Object.assign(graph, promoteStandardHierarchy(graph));
  }
  return graph;
}

async function graphFromResponse(response: Response, username: string): Promise<GalaxyGraph | null> {
  if (!response.ok) return null; const length = Number(response.headers.get("Content-Length")); if (Number.isFinite(length) && length > MAX_STATIC_BYTES) return null;
  const text = await response.text(); if (text.length > MAX_STATIC_BYTES) return null;
  try { return sanitizeStaticGraph(JSON.parse(text), username); } catch { return null; }
}

export async function fetchStaticProfileGraph(username: string): Promise<GalaxyGraph | null> {
  const owner = encodeURIComponent(username); const url = `https://raw.githubusercontent.com/${owner}/${owner}/HEAD/project-map/graph.json`;
  try { return await graphFromResponse(await fetch(url), username); } catch { return null; }
}
