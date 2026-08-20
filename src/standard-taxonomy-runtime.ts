import standardSignalProfile from "../data/standard-taxonomy-signals.v1.json" with { type: "json" };
import { STANDARD_TAXONOMY_CATEGORIES, STANDARD_TAXONOMY_ID } from "./standard-taxonomy.ts";
import { promoteStandardHierarchy } from "./standard-hierarchy.ts";
import { buildTaxonomyDiscoveryInput } from "./taxonomy.ts";
import { assignRepositoriesToTaxonomy, TAXONOMY_ASSIGNMENT_VERSION } from "./taxonomy-assignment.ts";
import type { GalaxyGraph, GitHubRepo, PortfolioTaxonomy, RepositoryClassification } from "./types";

const P1_STANDARD_PRIORS = standardSignalProfile.p1Priors as Record<string, string>;
const STANDARD_SIGNALS = standardSignalProfile.signals as Record<string, string[]>;
const CATEGORY_BY_ID = new Map(STANDARD_TAXONOMY_CATEGORIES.map((category) => [category.id, category]));

function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{M}\p{N}+#.-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function canonicalSignal(value: unknown): string {
  return normalize(value).replace(/[._-]+/gu, " ").replace(/\s+/gu, " ").trim();
}

function keywordMatches(text: unknown, keyword: unknown): boolean {
  const haystack = normalize(text);
  const needle = normalize(keyword);
  if (!needle) return false;
  if (/[^\x00-\x7F]/u.test(needle)) return haystack.includes(needle);
  if (needle.length <= 2) return haystack.split(" ").includes(needle);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\ /g, "\\s+");
  return new RegExp(`(^|[^a-z0-9+#.-])${escaped}(?=$|[^a-z0-9+#.-])`, "u").test(haystack);
}

function repoText(repo: GitHubRepo): string {
  return [
    repo.name,
    repo.description,
    ...(repo.topics ?? []),
    repo.readmeExcerpt,
    ...(repo.frameworks ?? []),
    ...(repo.manifests ?? []),
    repo.classification?.categoryLabel,
    ...(repo.classification?.secondaryTags ?? []),
  ].filter(Boolean).join("\n");
}

function signalScores(repo: GitHubRepo): Map<string, number> {
  const scores = new Map(STANDARD_TAXONOMY_CATEGORIES.map((category) => [category.id, 0]));
  const prior = P1_STANDARD_PRIORS[repo.classification?.categoryId ?? ""];
  if (prior) scores.set(prior, (scores.get(prior) ?? 0) + 4);

  const name = repo.name;
  const description = repo.description ?? "";
  const readme = repo.readmeExcerpt ?? "";
  const canonicalTopics = new Set((repo.topics ?? []).map(canonicalSignal).filter(Boolean));
  const frameworkText = [...(repo.frameworks ?? []), ...(repo.manifests ?? [])].join(" ");

  for (const [categoryId, aliases] of Object.entries(STANDARD_SIGNALS)) {
    for (const alias of aliases) {
      if (canonicalTopics.has(canonicalSignal(alias))) scores.set(categoryId, (scores.get(categoryId) ?? 0) + 3);
      if (keywordMatches(frameworkText, alias)) scores.set(categoryId, (scores.get(categoryId) ?? 0) + 2.5);
      if (keywordMatches(description, alias)) scores.set(categoryId, (scores.get(categoryId) ?? 0) + 2);
      if (keywordMatches(name, alias)) scores.set(categoryId, (scores.get(categoryId) ?? 0) + 1.5);
      if (keywordMatches(readme, alias)) scores.set(categoryId, (scores.get(categoryId) ?? 0) + 1);
    }
  }
  return scores;
}

function canonicalFacet(value: unknown): string {
  return normalize(value).replace(/[ ._/]+/gu, "-").replace(/^-+|-+$/g, "");
}

function standardFacets(repo: GitHubRepo, categoryId: string): string[] {
  const text = normalize(repoText(repo));
  const tags: string[] = [];
  const add = (tag: string): void => { if (tag && !tags.includes(tag)) tags.push(tag); };

  if (categoryId === "game-modding") {
    add("artifact:game-mod");
    add("platform:game");
    if (/minecraft|neoforge|forgegradle|fabric|ftb[ -]?chunks/u.test(text)) add("ecosystem:minecraft");
    if (/ftb[ -]?chunks|ftbchunks/u.test(text)) add("ecosystem:ftb-chunks");
  } else if (/\b(?:library|sdk)\b/u.test(text)) add("artifact:library");
  else if (/\bframework\b/u.test(text)) add("artifact:framework");
  else if (/\b(?:cli tool|developer tool|build tool|debugger|linter|formatter|code generator|test runner)\b/u.test(text)) add("artifact:tool");
  else if (/\b(?:dataset|corpus)\b/u.test(text)) add("artifact:dataset");
  else if (/\b(?:model|model weights)\b/u.test(text) && categoryId === "ai-ml") add("artifact:model");
  else if (/\b(?:documentation|docs site)\b/u.test(text)) add("artifact:documentation");
  else if (/\btemplate\b/u.test(text)) add("artifact:template");
  else if (/\bfirmware\b/u.test(text)) add("artifact:firmware");
  else if (/\b(?:service|server|api service)\b/u.test(text)) add("artifact:service");
  else if (categoryId === "science-engineering" && /research|scientific/u.test(text)) add("artifact:research");
  else add("artifact:application");

  if (categoryId === "robotics-automation") {
    if (/\bros2?\b|rclpy|rclcpp|nav2|moveit|ros-gz|ros_gz/u.test(text)) add("ecosystem:ros2");
    if (/gazebo/u.test(text)) add("topic:gazebo");
    if (/manipulation|moveit/u.test(text)) add("topic:manipulation");
  }
  if (categoryId === "game-development") {
    add("platform:game");
    if (/pygame/u.test(text)) add("ecosystem:pygame");
    if (/othello|reversi|オセロ|board game/u.test(text)) add("topic:board-game");
  }
  if (categoryId === "visualization-knowledge") {
    if (/github/u.test(text)) add("ecosystem:github");
    if (/project[ -]?map|portfolio map|プロジェクトマップ/u.test(text)) add("topic:project-visualization");
  }
  if (categoryId === "hardware-embedded" && /usb|serial|display|screen|device/u.test(text)) add("topic:device-integration");

  if (/react|nextjs|next\.js|svelte|vue|browser|web app|github pages/u.test(text)) add("platform:web");
  if (/desktop app|electron|qt|gtk|windows app|macos app/u.test(text)) add("platform:desktop");
  if (/mobile app|android|ios|iphone/u.test(text)) add("platform:mobile");
  if (/\bcli\b|command line/u.test(text)) add("platform:cli");
  if (/rest api|graphql|api service/u.test(text)) add("platform:api");
  if (/server|backend service|self hosted service/u.test(text)) add("platform:server");
  if (/embedded|firmware|microcontroller|arduino|esp32/u.test(text)) add("platform:embedded");

  for (const raw of repo.classification?.secondaryTags ?? []) {
    const tag = canonicalFacet(raw);
    if (!tag) continue;
    if (["neoforge", "forge", "fabric", "minecraft", "ftb-chunks"].includes(tag)) add(`ecosystem:${tag === "neoforge" || tag === "forge" || tag === "fabric" ? "minecraft" : tag}`);
    else if (["rclpy", "rclcpp", "nav2", "moveit2", "ros-gz"].includes(tag)) add("ecosystem:ros2");
    else if (["react", "next", "nextjs", "svelte", "vue"].includes(tag)) add("platform:web");
  }
  return tags.slice(0, 8);
}

export function standardizeRepositoryClassification(repo: GitHubRepo): GitHubRepo {
  const scores = signalScores(repo);
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [topId, topScore] = ranked[0] ?? [null, 0];
  const secondScore = ranked[1]?.[1] ?? 0;
  if (!topId || topScore < 3 || topScore - secondScore < 0.75) return { ...repo, classification: undefined };
  const category = CATEGORY_BY_ID.get(topId);
  if (!category) return { ...repo, classification: undefined };
  const priorConfidence = Number(repo.classification?.confidence ?? 0);
  const rawConfidence = 0.68 + Math.min(0.2, topScore * 0.02) + Math.min(0.1, Math.max(0, topScore - secondScore) * 0.02) + priorConfidence * 0.05;
  const confidence = Math.round(Math.max(0.9, Math.min(0.99, rawConfidence)) * 1000) / 1000;
  const classification: RepositoryClassification = {
    categoryId: category.id,
    categoryLabel: category.label,
    secondaryTags: standardFacets(repo, category.id),
    confidence,
    method: "deterministic",
    evidence: [],
  };
  return { ...repo, classification };
}

export function standardizeRepositoriesForAssignment(repos: GitHubRepo[]): GitHubRepo[] {
  return repos.map(standardizeRepositoryClassification);
}

export async function resolveStandardTaxonomy(repos: GitHubRepo[]): Promise<PortfolioTaxonomy> {
  const corpus = await buildTaxonomyDiscoveryInput(repos);
  return {
    schemaVersion: 1,
    corpusFingerprint: corpus.input.corpusFingerprint,
    repositories: corpus.repositories.map((item) => ({ ...item })),
    categories: STANDARD_TAXONOMY_CATEGORIES.map((category) => ({ ...category, aliases: [...category.aliases] })),
    source: { providerId: "standard", model: STANDARD_TAXONOMY_ID },
  };
}

function semanticReposForGraph(repos: GitHubRepo[], graph: GalaxyGraph): GitHubRepo[] {
  const classificationByName = new Map(
    graph.nodes
      .filter((node) => node.type === "repository")
      .map((node) => [String(node.label).toLocaleLowerCase("en-US"), node.classification]),
  );
  return repos
    .filter((repo) => classificationByName.has(repo.name.toLocaleLowerCase("en-US")))
    .map((repo) => ({ ...repo, classification: classificationByName.get(repo.name.toLocaleLowerCase("en-US")) }));
}

export async function attachStandardTaxonomyToGraph(graph: GalaxyGraph, repos: GitHubRepo[]): Promise<GalaxyGraph> {
  const semanticRepos = semanticReposForGraph(repos, graph);
  const taxonomy = await resolveStandardTaxonomy(semanticRepos);
  const standardized = standardizeRepositoriesForAssignment(semanticRepos);
  const assignment = await assignRepositoriesToTaxonomy(standardized, taxonomy);
  const byName = new Map(Object.entries(assignment.assignments).map(([name, value]) => [name.toLocaleLowerCase("en-US"), value]));
  for (const node of graph.nodes) {
    if (node.type !== "repository") continue;
    const value = byName.get(node.label.toLocaleLowerCase("en-US"));
    if (value) node.taxonomyAssignment = value;
  }
  graph.taxonomy = taxonomy;
  graph.taxonomyAssignmentVersion = TAXONOMY_ASSIGNMENT_VERSION;
  Object.assign(graph, promoteStandardHierarchy(graph));
  return graph;
}
