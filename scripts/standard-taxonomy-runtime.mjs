import { buildTaxonomyDiscoveryInput } from "./taxonomy.mjs";
import { STANDARD_TAXONOMY_CATEGORIES, STANDARD_TAXONOMY_ID } from "./standard-taxonomy.mjs";

const P1_STANDARD_PRIORS = Object.freeze({
  "ai-ml": "ai-ml",
  robotics: "robotics-automation",
  minecraft: "game-modding",
  hardware: "hardware-embedded",
  "web-apps": "applications-services",
  coursework: "education-learning",
});

const STANDARD_SIGNALS = Object.freeze({
  "ai-ml": ["machine learning", "deep learning", "generative ai", "computer vision", "pytorch", "tensorflow", "transformers", "llm", "diffusion", "neural network", "機械学習", "深層学習", "画像認識", "生成ai"],
  "data-analytics": ["data analytics", "data engineering", "database", "etl", "data pipeline", "information retrieval", "search engine", "analytics", "データ分析", "データベース"],
  "visualization-knowledge": ["data visualization", "information visualization", "project map", "project-map", "knowledge map", "knowledge graph", "graph visualization", "force directed", "force-directed", "treemap", "sunburst", "sankey", "heatmap", "visual analytics", "portfolio map", "可視化", "プロジェクトマップ"],
  "developer-tools": ["developer tool", "devtool", "build tool", "debugger", "linter", "formatter", "code generator", "codegen", "test runner", "package manager", "sdk", "compiler", "開発ツール"],
  "systems-infrastructure": ["operating system", "kernel", "container runtime", "kubernetes", "docker", "cloud infrastructure", "observability", "deployment", "storage engine", "system daemon", "インフラ"],
  "security-privacy": ["security", "privacy", "authentication", "authorization", "cryptography", "malware", "anti-cheat", "anti cheat", "xray detection", "exploit", "セキュリティ", "暗号"],
  "networking-distributed": ["distributed system", "distributed systems", "network protocol", "networking", "peer to peer", "peer-to-peer", "rpc", "message broker", "transport bridge", "network transport", "分散システム", "ネットワーク"],
  "hardware-embedded": ["embedded", "firmware", "microcontroller", "arduino", "esp32", "platformio", "gpio", "usb display", "usb-c display", "hardware integration", "device integration", "iot", "組み込み", "マイコン", "電子工作"],
  "robotics-automation": ["robotics", "robot", "ros2", "ros 2", "gazebo", "moveit", "nav2", "slam", "manipulation", "autonomous", "lidar", "ロボット", "ロボティクス", "自律走行", "マニピュレーション"],
  "game-development": ["game development", "game engine", "pygame", "godot", "unity", "unreal", "gameplay", "board game", "othello", "reversi", "オセロ", "ゲーム開発", "対戦型ボードゲーム"],
  "game-modding": ["minecraft mod", "minecraft modding", "neoforge", "minecraft forge", "forgegradle", "fabric loader", "fabric-api", "fabric api", "ftb chunks", "modrinth", "curseforge", "mod loader", "マインクラフト"],
  "science-engineering": ["scientific computing", "numerical simulation", "numerical analysis", "engineering analysis", "physics simulation", "mathematics", "research software", "数値計算", "科学計算"],
  "education-learning": ["coursework", "homework", "assignment", "tutorial", "learning project", "teaching", "university course", "課題", "授業", "演習", "学習"],
  "media-creative": ["audio", "video editing", "image editor", "graphics", "animation", "creative coding", "music", "media production", "画像編集", "動画編集"],
  "business-productivity": ["productivity", "business workflow", "collaboration", "project management", "crm", "office automation", "commerce", "inventory management", "業務", "生産性"],
});

const CATEGORY_BY_ID = new Map(STANDARD_TAXONOMY_CATEGORIES.map((category) => [category.id, category]));

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{M}\p{N}+#.-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
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

function signalScores(repo) {
  const scores = new Map(STANDARD_TAXONOMY_CATEGORIES.map((category) => [category.id, 0]));
  const prior = P1_STANDARD_PRIORS[repo.classification?.categoryId ?? ""];
  if (prior) scores.set(prior, (scores.get(prior) ?? 0) + 4);

  const name = String(repo.name ?? "");
  const description = String(repo.description ?? "");
  const readme = String(repo.readmeExcerpt ?? "");
  const topics = repo.topics ?? [];
  const frameworkText = [...(repo.frameworks ?? []), ...(repo.manifests ?? [])].join(" ");

  for (const [categoryId, aliases] of Object.entries(STANDARD_SIGNALS)) {
    for (const alias of aliases) {
      if (topics.some((topic) => normalize(topic) === normalize(alias))) scores.set(categoryId, (scores.get(categoryId) ?? 0) + 3);
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
  const tags = [];
  const add = (tag) => { if (tag && !tags.includes(tag)) tags.push(tag); };

  if (categoryId === "game-modding") {
    add("artifact:game-mod");
    add("platform:game");
    if (/minecraft|neoforge|forgegradle|fabric|ftb[ -]?chunks/u.test(text)) add("ecosystem:minecraft");
    if (/ftb[ -]?chunks|ftbchunks/u.test(text)) add("ecosystem:ftb-chunks");
  }
  if (categoryId === "robotics-automation") {
    if (/\bros2?\b|rclpy|rclcpp|nav2|moveit|ros-gz|ros_gz/u.test(text)) add("ecosystem:ros2");
    if (/gazebo/u.test(text)) add("topic:gazebo");
    if (/manipulation|moveit/u.test(text)) add("topic:manipulation");
  }
  if (categoryId === "game-development") {
    add("artifact:application");
    add("platform:game");
    if (/pygame/u.test(text)) add("ecosystem:pygame");
    if (/othello|reversi|オセロ|board game/u.test(text)) add("topic:board-game");
  }
  if (categoryId === "visualization-knowledge") {
    add("artifact:application");
    if (/github/u.test(text)) add("ecosystem:github");
    if (/project[ -]?map|portfolio map|プロジェクトマップ/u.test(text)) add("topic:project-visualization");
    if (/react|nextjs|svelte|vue|html|css|github pages/u.test(text)) add("platform:web");
  }
  if (categoryId === "hardware-embedded") {
    if (/firmware/u.test(text)) add("artifact:firmware");
    else add("artifact:application");
    if (/usb|serial|display|screen/u.test(text)) add("topic:device-integration");
  }

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
  const confidence = Math.round(Math.max(0.7, Math.min(0.99, 0.68 + Math.min(0.2, topScore * 0.02) + Math.min(0.1, Math.max(0, topScore - secondScore) * 0.02) + priorConfidence * 0.05)) * 1000) / 1000;
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
