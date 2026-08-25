import standardSignalProfile from "../data/standard-taxonomy-signals.v1.json" with { type: "json" };
import { buildTaxonomyDiscoveryInput } from "./taxonomy.mjs";
import { STANDARD_TAXONOMY_CATEGORIES, STANDARD_TAXONOMY_ID } from "./standard-taxonomy.mjs";

const P1_STANDARD_PRIORS = standardSignalProfile.p1Priors;
const STANDARD_SIGNALS = standardSignalProfile.signals;
const CATEGORY_BY_ID = new Map(STANDARD_TAXONOMY_CATEGORIES.map((category) => [category.id, category]));

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{M}\p{N}+#.-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function canonicalSignal(value) {
  return normalize(value).replace(/[._-]+/gu, " ").replace(/\s+/gu, " ").trim();
}

function keywordMatches(text, keyword) {
  const haystack = normalize(text);
  const needle = normalize(keyword);
  if (!needle) return false;
  if (/[^\x00-\x7F]/u.test(needle)) return haystack.includes(needle);
  if (needle.length <= 2) return haystack.split(" ").includes(needle);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\ /g, "\\s+");
  return new RegExp(`(^|[^a-z0-9+#.-])${escaped}(?=$|[^a-z0-9+#.-])`, "u").test(haystack);
}

function repoText(repo) {
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

function repoIdentityText(repo) {
  return [
    repo.name,
    repo.description,
    ...(repo.topics ?? []),
    ...(repo.frameworks ?? []),
    ...(repo.manifests ?? []),
    repo.classification?.categoryLabel,
    ...(repo.classification?.secondaryTags ?? []),
  ].filter(Boolean).join("\n");
}

function signalScores(repo) {
  const scores = new Map(STANDARD_TAXONOMY_CATEGORIES.map((category) => [category.id, 0]));
  const prior = P1_STANDARD_PRIORS[repo.classification?.categoryId ?? ""];
  if (prior) scores.set(prior, (scores.get(prior) ?? 0) + 4);

  const name = String(repo.name ?? "");
  const description = String(repo.description ?? "");
  const readme = String(repo.readmeExcerpt ?? "");
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

function canonicalFacet(value) {
  return normalize(value).replace(/[ ._/]+/gu, "-").replace(/^-+|-+$/g, "");
}

function standardFacets(repo, categoryId) {
  const text = normalize(repoText(repo));
  const identityText = normalize(repoIdentityText(repo));
  const tags = [];
  const add = (tag) => { if (tag && !tags.includes(tag)) tags.push(tag); };

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
  else if (/\b(?:documentation|docs site)\b/u.test(identityText)) add("artifact:documentation");
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

export function standardizeRepositoryClassification(repo) {
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
  return {
    ...repo,
    classification: {
      categoryId: category.id,
      categoryLabel: category.label,
      secondaryTags: standardFacets(repo, category.id),
      confidence,
      method: "deterministic",
      evidence: [],
    },
  };
}

export function standardizeRepositoriesForAssignment(repos) {
  return repos.map(standardizeRepositoryClassification);
}

export async function resolveStandardTaxonomy(repos) {
  const corpus = await buildTaxonomyDiscoveryInput(repos);
  const taxonomy = {
    schemaVersion: 1,
    corpusFingerprint: corpus.input.corpusFingerprint,
    repositories: corpus.repositories.map((item) => ({ ...item })),
    categories: STANDARD_TAXONOMY_CATEGORIES.map((category) => ({ ...category, aliases: [...category.aliases] })),
    source: { providerId: "standard", model: STANDARD_TAXONOMY_ID },
  };
  return {
    taxonomy,
    diagnostics: {
      documents: repos.length,
      providerId: "standard",
      model: STANDARD_TAXONOMY_ID,
      previousAvailable: false,
      exactCorpusMatch: false,
      changedRepositories: 0,
      driftRatio: 0,
      reused: true,
      discovered: false,
      overridden: false,
      stale: false,
      reason: "standard-v1",
    },
  };
}