import type {
  ClassificationEvidence,
  ClassificationEvidenceSource,
  GitHubRepo,
  RepositoryClassification,
} from "./types";

export const CLASSIFICATION_VERSION = 1;
export const UNCATEGORIZED_CATEGORY = Object.freeze({ id: "uncategorized", label: "Uncategorized" });
export const MIN_CATEGORY_SCORE = 0.7;
export const MAX_CLASSIFICATION_EVIDENCE = 24;

export const EVIDENCE_WEIGHTS: Readonly<Partial<Record<ClassificationEvidenceSource, number>>> = Object.freeze({
  topic: 1.0,
  manifest: 0.9,
  dependency: 0.9,
  description: 0.7,
  readme: 0.7,
  name: 0.5,
  "fork-source": 0.4,
});

type GroupRule = {
  id: string;
  label: string;
  aliases: string[];
  manifestNames: string[];
};

type FrameworkHint = {
  id: string;
  categoryId: string;
  aliases: string[];
};

const GROUP_RULES: GroupRule[] = [
  {
    id: "robotics",
    label: "Robotics / ROS 2",
    aliases: [
      "robot", "robotics", "ros", "ros2", "ros-2", "gazebo", "isaac", "mujoco", "slam", "lidar",
      "moveit", "moveit2", "nav2", "manipulation", "rclpy", "rclcpp", "ament-cmake", "ament-python", "ros-gz",
      "ロボット", "ロボティクス", "自律走行", "経路計画", "マニピュレーション", "移動ロボット",
    ],
    manifestNames: ["package.xml"],
  },
  {
    id: "ai-ml",
    label: "AI / Machine Learning",
    aliases: [
      "ai", "machine-learning", "deep-learning", "pytorch", "torch", "tensorflow", "llm", "vlm", "vla",
      "vision", "computer-vision", "opencv", "transformer", "transformers", "ultralytics", "diffusers",
      "人工知能", "機械学習", "深層学習", "画像認識", "生成ai",
    ],
    manifestNames: [],
  },
  {
    id: "minecraft",
    label: "Minecraft Modding",
    aliases: [
      "minecraft", "forge", "neoforge", "neoforged", "fabric", "fabric-loader", "fabric-api", "fabric-loom",
      "forgegradle", "minecraftforge", "ftb-chunks", "ftbchunks", "modding", "minecraft-modding",
      "マインクラフト", "minecraft mod",
    ],
    manifestNames: ["mods.toml", "neoforge.mods.toml", "fabric.mod.json"],
  },
  {
    id: "hardware",
    label: "Hardware / Embedded",
    aliases: [
      "arduino", "esp32", "esp-idf", "embedded", "raspberry", "raspberry-pi", "jetson", "iot", "firmware",
      "hardware", "sensor", "platformio", "gpiozero", "pyserial", "serial", "usb-c",
      "組み込み", "組込み", "電子工作", "マイコン", "センサー",
    ],
    manifestNames: ["platformio.ini"],
  },
  {
    id: "web-apps",
    label: "Web / Apps",
    aliases: [
      "web", "frontend", "backend", "nextjs", "next", "react", "vue", "svelte", "express", "fastapi", "api",
      "website", "app", "web-app", "ウェブ", "webアプリ",
    ],
    manifestNames: [],
  },
  {
    id: "coursework",
    label: "Coursework / Learning",
    aliases: [
      "course", "coursework", "homework", "assignment", "tutorial", "learning", "study", "school", "university",
      "課題", "授業", "演習", "大学", "学習",
    ],
    manifestNames: [],
  },
];

const RULE_BY_ID = new Map(GROUP_RULES.map((rule) => [rule.id, rule]));

export const FRAMEWORK_HINTS: readonly FrameworkHint[] = Object.freeze([
  { id: "rclpy", categoryId: "robotics", aliases: ["rclpy"] },
  { id: "rclcpp", categoryId: "robotics", aliases: ["rclcpp"] },
  { id: "nav2", categoryId: "robotics", aliases: ["nav2", "navigation2"] },
  { id: "moveit2", categoryId: "robotics", aliases: ["moveit2", "moveit"] },
  { id: "ament-cmake", categoryId: "robotics", aliases: ["ament-cmake", "ament_cmake"] },
  { id: "ament-python", categoryId: "robotics", aliases: ["ament-python", "ament_python"] },
  { id: "ros-gz", categoryId: "robotics", aliases: ["ros-gz", "ros_gz"] },
  { id: "torch", categoryId: "ai-ml", aliases: ["torch", "pytorch"] },
  { id: "transformers", categoryId: "ai-ml", aliases: ["transformers", "huggingface-transformers"] },
  { id: "tensorflow", categoryId: "ai-ml", aliases: ["tensorflow"] },
  { id: "opencv", categoryId: "ai-ml", aliases: ["opencv", "opencv-python"] },
  { id: "ultralytics", categoryId: "ai-ml", aliases: ["ultralytics"] },
  { id: "diffusers", categoryId: "ai-ml", aliases: ["diffusers"] },
  { id: "neoforge", categoryId: "minecraft", aliases: ["neoforge", "neoforged", "net.neoforged", "neo_version", "neo-version"] },
  { id: "forge", categoryId: "minecraft", aliases: ["forgegradle", "minecraftforge", "net.minecraftforge", "forge_version", "forge-version"] },
  { id: "fabric", categoryId: "minecraft", aliases: ["fabric-loader", "fabric-api", "fabric-loom", "net.fabricmc", "fabric_version", "fabric-version"] },
  { id: "minecraft", categoryId: "minecraft", aliases: ["minecraft_version", "minecraft-version", "minecraft_version_range"] },
  { id: "ftb-chunks", categoryId: "minecraft", aliases: ["ftb-chunks", "ftbchunks", "ftb chunks"] },
  { id: "platformio", categoryId: "hardware", aliases: ["platformio"] },
  { id: "arduino", categoryId: "hardware", aliases: ["arduino"] },
  { id: "esp-idf", categoryId: "hardware", aliases: ["esp-idf", "esp_idf"] },
  { id: "gpiozero", categoryId: "hardware", aliases: ["gpiozero"] },
  { id: "pyserial", categoryId: "hardware", aliases: ["pyserial"] },
  { id: "react", categoryId: "web-apps", aliases: ["react", "react-dom"] },
  { id: "next", categoryId: "web-apps", aliases: ["next", "nextjs"] },
  { id: "svelte", categoryId: "web-apps", aliases: ["svelte", "sveltekit"] },
  { id: "vue", categoryId: "web-apps", aliases: ["vue", "nuxt"] },
  { id: "express", categoryId: "web-apps", aliases: ["express"] },
  { id: "fastapi", categoryId: "web-apps", aliases: ["fastapi"] },
]);

const FRAMEWORK_BY_ID = new Map(FRAMEWORK_HINTS.map((hint) => [hint.id, hint]));
const MANIFEST_CATEGORY_HINTS = new Map<string, string>();
for (const rule of GROUP_RULES) {
  for (const name of rule.manifestNames) MANIFEST_CATEGORY_HINTS.set(name.toLowerCase(), rule.id);
}

export function normalizeSearch(value: string): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}+#]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function semanticKeywordMatches(text: string, keyword: string): boolean {
  const haystack = normalizeSearch(text);
  const needle = normalizeSearch(keyword);
  if (!needle) return false;
  if (/[^\x00-\x7F]/u.test(needle)) return haystack.includes(needle);
  const pattern = needle.split(/\s+/u).map(escapeRegExp).join("\\s+");
  return new RegExp(`(^|[^a-z0-9+#])${pattern}(?=$|[^a-z0-9+#])`, "u").test(haystack);
}

function canonicalFrameworkId(value: string): string | null {
  const normalized = normalizeSearch(value);
  if (!normalized) return null;
  for (const hint of FRAMEWORK_HINTS) {
    if (hint.id === value || hint.aliases.some((alias) => normalizeSearch(alias) === normalized)) return hint.id;
  }
  return null;
}

export function extractFrameworkIdentifiers(raw: string): string[] {
  const text = normalizeSearch(raw);
  if (!text) return [];
  const found: string[] = [];
  for (const hint of FRAMEWORK_HINTS) {
    if (hint.aliases.some((alias) => semanticKeywordMatches(text, alias))) found.push(hint.id);
  }
  return found;
}

function evidenceKey(evidence: ClassificationEvidence): string {
  return [evidence.categoryId, evidence.source, evidence.path ?? "", normalizeSearch(evidence.value)].join("\u0000");
}

function sourceWeight(source: ClassificationEvidenceSource): number {
  return EVIDENCE_WEIGHTS[source] ?? 0;
}

function addEvidence(
  target: ClassificationEvidence[],
  seen: Set<string>,
  categoryId: string,
  source: ClassificationEvidenceSource,
  value: string,
  path?: string,
): void {
  if (!RULE_BY_ID.has(categoryId)) return;
  const cleanValue = String(value ?? "").slice(0, 120);
  if (!cleanValue) return;
  const evidence: ClassificationEvidence = {
    categoryId,
    source,
    value: cleanValue,
    weight: sourceWeight(source),
    ...(path ? { path: String(path).slice(0, 160) } : {}),
  };
  const key = evidenceKey(evidence);
  if (seen.has(key)) return;
  seen.add(key);
  target.push(evidence);
}

function matchRuleAliases(
  value: string,
  source: "name" | "description" | "readme",
  target: ClassificationEvidence[],
  seen: Set<string>,
): void {
  if (!value) return;
  for (const rule of GROUP_RULES) {
    for (const alias of rule.aliases) {
      if (semanticKeywordMatches(value, alias)) addEvidence(target, seen, rule.id, source, alias);
    }
  }
}

function matchTopics(topics: string[] | undefined, target: ClassificationEvidence[], seen: Set<string>): void {
  for (const topic of topics ?? []) {
    const normalized = normalizeSearch(topic);
    if (!normalized) continue;
    for (const rule of GROUP_RULES) {
      for (const alias of rule.aliases) {
        if (normalizeSearch(alias) === normalized) addEvidence(target, seen, rule.id, "topic", topic);
      }
    }
  }
}

function matchManifests(manifests: string[] | undefined, target: ClassificationEvidence[], seen: Set<string>): void {
  for (const path of manifests ?? []) {
    const name = String(path).split("/").pop()?.toLowerCase() ?? "";
    const categoryId = MANIFEST_CATEGORY_HINTS.get(name);
    if (categoryId) addEvidence(target, seen, categoryId, "manifest", name, path);
  }
}

function matchFrameworks(frameworks: string[] | undefined, target: ClassificationEvidence[], seen: Set<string>): void {
  for (const value of frameworks ?? []) {
    const canonical = canonicalFrameworkId(value);
    if (!canonical) continue;
    const hint = FRAMEWORK_BY_ID.get(canonical);
    if (hint) addEvidence(target, seen, hint.categoryId, "dependency", canonical);
  }
}

function scoreEvidence(evidence: ClassificationEvidence[]): Map<string, number> {
  const scores = new Map(GROUP_RULES.map((rule) => [rule.id, 0]));
  for (const item of evidence) scores.set(item.categoryId, (scores.get(item.categoryId) ?? 0) + item.weight);
  return scores;
}

function roundConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
}

function classificationConfidence(topScore: number, secondScore: number, winningEvidence: ClassificationEvidence[]): number {
  if (topScore <= 0) return 0;
  const strength = Math.min(1, topScore / 1.8);
  const margin = Math.max(0, Math.min(1, (topScore - secondScore) / topScore));
  const sourceDiversity = Math.min(1, new Set(winningEvidence.map((item) => item.source)).size / 2);
  return roundConfidence(strength * 0.55 + margin * 0.25 + sourceDiversity * 0.2);
}

function evidenceSort(a: ClassificationEvidence, b: ClassificationEvidence): number {
  return b.weight - a.weight
    || a.categoryId.localeCompare(b.categoryId)
    || a.source.localeCompare(b.source)
    || a.value.localeCompare(b.value);
}

export function classifyRepository(repo: GitHubRepo): RepositoryClassification {
  if (repo.classification) return repo.classification;

  const evidence: ClassificationEvidence[] = [];
  const seen = new Set<string>();
  matchTopics(repo.topics, evidence, seen);
  matchManifests(repo.manifests, evidence, seen);
  matchFrameworks(repo.frameworks, evidence, seen);
  matchRuleAliases(repo.description ?? "", "description", evidence, seen);
  matchRuleAliases(repo.readmeExcerpt ?? "", "readme", evidence, seen);
  matchRuleAliases(repo.name ?? "", "name", evidence, seen);

  const scores = scoreEvidence(evidence);
  const ranked = GROUP_RULES
    .map((rule, index) => ({ rule, index, score: scores.get(rule.id) ?? 0 }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const top = ranked[0];
  const secondScore = ranked[1]?.score ?? 0;
  const sortedEvidence = [...evidence].sort(evidenceSort).slice(0, MAX_CLASSIFICATION_EVIDENCE);

  if (!top || top.score < MIN_CATEGORY_SCORE) {
    return {
      categoryId: UNCATEGORIZED_CATEGORY.id,
      categoryLabel: UNCATEGORIZED_CATEGORY.label,
      secondaryTags: [],
      confidence: 0,
      method: "deterministic",
      evidence: sortedEvidence,
    };
  }

  const winningEvidence = evidence.filter((item) => item.categoryId === top.rule.id);
  const secondaryTags = [...new Set(
    winningEvidence
      .filter((item) => item.source === "topic" || item.source === "dependency")
      .map((item) => normalizeSearch(item.value).replace(/\s+/gu, "-"))
      .filter(Boolean),
  )].slice(0, 8);

  return {
    categoryId: top.rule.id,
    categoryLabel: top.rule.label,
    secondaryTags,
    confidence: classificationConfidence(top.score, secondScore, winningEvidence),
    method: "deterministic",
    evidence: sortedEvidence,
  };
}

export function classificationRuleIds(): string[] {
  return GROUP_RULES.map((rule) => rule.id);
}
