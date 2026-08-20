import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateStaticMap } from "../scripts/action.mjs";
import { MemoryEmbeddingCache } from "../scripts/embedding.mjs";
import {
  assignRepositoriesToTaxonomy as assignScript,
  canonicalTaxonomyCategory as canonicalScriptCategory,
  taxonomyCategoryEmbeddingCacheKey as scriptCategoryKey,
  taxonomyCategoryText as scriptCategoryText,
} from "../scripts/taxonomy-assignment.mjs";
import { normalizeTaxonomyRepositoryOverrides as normalizeScriptRepoOverrides } from "../scripts/taxonomy-overrides.mjs";
import {
  assignRepositoriesToTaxonomy as assignSource,
  canonicalTaxonomyCategory as canonicalSourceCategory,
  taxonomyCategoryEmbeddingCacheKey as sourceCategoryKey,
  taxonomyCategoryText as sourceCategoryText,
} from "../src/taxonomy-assignment.ts";
import { normalizeTaxonomyRepositoryOverrides as normalizeSourceRepoOverrides } from "../src/taxonomy-overrides.ts";
import { buildGraph } from "../src/graph.ts";
import { sanitizeStaticGraph } from "../src/static-graph.ts";
import { resolvePortfolioTaxonomy } from "../scripts/taxonomy.mjs";

function repo(id, name, overrides = {}) {
  return {
    id, name, html_url: `https://github.com/example/${name}`, description: `${name} project`, language: "TypeScript", topics: [],
    stargazers_count: 0, forks_count: 0, fork: false, archived: false, updated_at: "2026-08-20T00:00:00Z",
    readmeExcerpt: `${name} README`, frameworks: [], manifests: [], ...overrides,
  };
}

const categories = [
  { id: "robotics", label: "Robotics", description: "Robot simulation control navigation manipulation ROS2 Gazebo", aliases: ["ROS2", "Gazebo"] },
  { id: "web-apps", label: "Web / Apps", description: "Web applications frontends APIs React interactive product experiences", aliases: ["React", "Web"] },
];

async function taxonomyFor(repos) {
  const resolved = await resolvePortfolioTaxonomy(repos, { id: "fixture-taxonomy", model: "v1", async discover() { return { categories }; } });
  assert.ok(resolved.taxonomy);
  return resolved.taxonomy;
}

function classification(categoryId, confidence, secondaryTags = []) {
  return { categoryId, categoryLabel: categoryId === "robotics" ? "Robotics / ROS 2" : "Other", secondaryTags, confidence, method: "deterministic", evidence: [{ categoryId, source: "description", value: `${categoryId} evidence`, weight: confidence }] };
}

function vectorForText(text) {
  if (/^category: robotics$/m.test(text)) return [1, 0];
  if (/^category: web-apps$/m.test(text)) return [0, 1];
  if (/^name: (robot|alpha)$/m.test(text)) return [0.995, 0.05];
  if (/^name: (web|beta)$/m.test(text)) return [0.05, 0.995];
  if (/^name: weak$/m.test(text)) return [-0.45, -0.20];
  if (/^name: mixed$/m.test(text)) return [0.70, 0.71];
  if (/^name: tie$/m.test(text)) return [1, 1];
  return [0.55, 0.45];
}

function embeddingProvider(id = "fake-embedding", model = "fixture-v1") {
  const state = { calls: 0, texts: [] };
  return { id, model, state, async embed(texts) { state.calls += 1; state.texts.push(...texts); return texts.map(vectorForText); } };
}

function config() {
  return { username: "example", theme: "dark", style: "galaxy-systems", maxRepos: 100, includeForks: true, includeArchived: true, width: 740, height: 420, outputDir: "project-map" };
}

test("taxonomy category canonical text/cache identity is stable and source/script implementations match", async () => {
  const category = { ...categories[0], aliases: ["Gazebo", "ROS2"] };
  assert.equal(canonicalSourceCategory(category), canonicalScriptCategory(category));
  assert.equal(sourceCategoryText(category), scriptCategoryText(category));
  const provider = embeddingProvider();
  const scriptKey = await scriptCategoryKey(category, provider);
  assert.equal(await sourceCategoryKey(category, provider), scriptKey);
  assert.match(scriptKey, /^embedding:taxonomy-category-v1:/);
  assert.equal(await scriptCategoryKey({ ...category, aliases: ["ROS2", "Gazebo"] }, provider), scriptKey);
  assert.notEqual(await scriptCategoryKey({ ...category, description: `${category.description} sim-to-real` }, provider), scriptKey);
  assert.notEqual(await scriptCategoryKey(category, embeddingProvider("other-provider")), scriptKey);
  assert.notEqual(await scriptCategoryKey(category, embeddingProvider("fake-embedding", "other-model")), scriptKey);
});

test("repository assignment overrides are normalized strictly and source/script implementations match", () => {
  const input = { Robot: { categoryId: "ROBOTICS", secondaryTags: ["sim-to-real", "SIM-TO-REAL", "manipulation"] } };
  const script = normalizeScriptRepoOverrides(input);
  assert.deepEqual(normalizeSourceRepoOverrides(input), script);
  assert.deepEqual(script, { robot: { categoryId: "robotics", secondaryTags: ["sim-to-real", "manipulation"] } });
  assert.throws(() => normalizeScriptRepoOverrides({ "bad repo!": { categoryId: "robotics" } }), /Invalid repository override name/);
  assert.throws(() => normalizeScriptRepoOverrides({ robot: { categoryId: "../../bad" } }), /invalid categoryId/);
});

test("human repo override wins, while high-confidence exact P1 taxonomy match assigns deterministically without embedding", async () => {
  const repos = [repo(1, "robot", { classification: classification("robotics", 0.99, ["control"]) }), repo(2, "web", { classification: classification("uncategorized", 0.2) })];
  const taxonomy = await taxonomyFor(repos);
  const provider = embeddingProvider();
  const result = await assignScript(repos, taxonomy, provider, undefined, { overrides: { version: 1, repositories: { web: { categoryId: "web-apps", secondaryTags: ["frontend"] } } } });
  assert.equal(provider.state.calls, 0);
  assert.equal(result.assignments.robot.method, "deterministic");
  assert.equal(result.assignments.robot.categoryId, "robotics");
  assert.equal(result.assignments.web.method, "override");
  assert.equal(result.assignments.web.categoryId, "web-apps");
  assert.deepEqual(result.assignments.web.secondaryTags, ["frontend"]);
  assert.equal(result.diagnostics.deterministic, 1);
  assert.equal(result.diagnostics.overridden, 1);
  assert.deepEqual(result.ambiguous, []);
  await assert.rejects(assignScript([repo(3, "bad")], taxonomy, provider, undefined, { overrides: { version: 1, repositories: { bad: { categoryId: "missing" } } } }), /unknown category/);
});

test("semantic assignment uses absolute score plus top-vs-second margin and leaves weak/mixed repositories ambiguous", async () => {
  const repos = [repo(1, "robot"), repo(2, "web"), repo(3, "weak"), repo(4, "mixed")];
  const taxonomy = await taxonomyFor(repos);
  const script = await assignScript(repos, taxonomy, embeddingProvider());
  const source = await assignSource(repos, taxonomy, embeddingProvider());
  assert.deepEqual(source.assignments, script.assignments);
  assert.deepEqual(source.ambiguous, script.ambiguous);
  assert.equal(script.assignments.robot.categoryId, "robotics");
  assert.equal(script.assignments.web.categoryId, "web-apps");
  assert.equal(script.assignments.robot.method, "semantic");
  assert.ok(script.assignments.robot.score >= 0.62);
  assert.ok(script.assignments.robot.margin >= 0.08);
  assert.deepEqual(script.ambiguous, ["mixed", "weak"]);
  assert.equal(script.diagnostics.semantic, 2);
  assert.equal(script.diagnostics.ambiguous, 2);
});

test("lexicographic category tie-break is deterministic when margin gate is explicitly zero", async () => {
  const repos = [repo(1, "tie")]; const taxonomy = await taxonomyFor(repos);
  const result = await assignScript(repos, taxonomy, embeddingProvider(), undefined, { minScore: 0.5, minMargin: 0 });
  assert.equal(result.assignments.tie.categoryId, "robotics");
  const defaultGate = await assignScript(repos, taxonomy, embeddingProvider());
  assert.equal(defaultGate.assignments.tie, undefined);
  assert.deepEqual(defaultGate.ambiguous, ["tie"]);
});

test("embedding cache avoids repeated repository/category provider calls", async () => {
  const repos = [repo(1, "robot"), repo(2, "web")]; const taxonomy = await taxonomyFor(repos); const provider = embeddingProvider(); const cache = new MemoryEmbeddingCache();
  const first = await assignScript(repos, taxonomy, provider, cache);
  assert.equal(first.diagnostics.repositoryEmbedded, 2); assert.equal(first.diagnostics.categoryEmbedded, 2);
  const calls = provider.state.calls;
  const second = await assignScript(repos, taxonomy, provider, cache);
  assert.equal(provider.state.calls, calls);
  assert.equal(second.diagnostics.repositoryCacheHits, 2); assert.equal(second.diagnostics.categoryCacheHits, 2);
  assert.equal(second.diagnostics.repositoryEmbedded, 0); assert.equal(second.diagnostics.categoryEmbedded, 0);
});

test("embedding provider failure preserves override/deterministic assignments and leaves unresolved repositories ambiguous", async () => {
  const repos = [repo(1, "robot", { classification: classification("robotics", 0.97) }), repo(2, "web")]; const taxonomy = await taxonomyFor(repos);
  const result = await assignScript(repos, taxonomy, { id: "failing", model: "v1", async embed() { throw new Error("embedding unavailable"); } });
  assert.equal(result.assignments.robot.categoryId, "robotics"); assert.equal(result.assignments.web, undefined); assert.deepEqual(result.ambiguous, ["web"]); assert.match(result.error ?? "", /embedding unavailable/);
});

test("Action shares repository embedding cache between semantic edges and taxonomy assignment", async () => {
  const dir = await mkdtemp(join(tmpdir(), "project-map-p3b1-cache-"));
  const repos = [repo(1, "alpha"), repo(2, "beta")]; const provider = embeddingProvider();
  try {
    const result = await generateStaticMap(config(), { cwd: dir, fetchRepos: async () => repos, embeddingProvider: provider, taxonomyOverrides: { version: 1, categories }, semanticOptions: { minSimilarity: -1, topK: 1 } });
    assert.equal(result.taxonomy.diagnostics.reason, "override");
    assert.equal(result.taxonomyAssignment.diagnostics.repositoryCacheHits, 2);
    assert.equal(result.taxonomyAssignment.diagnostics.repositoryEmbedded, 0);
    assert.equal(result.taxonomyAssignment.diagnostics.categoryEmbedded, 2);
    assert.equal(result.graph.taxonomyAssignmentVersion, 1);
    const alpha = result.graph.nodes.find((node) => node.type === "repository" && node.label === "alpha");
    const beta = result.graph.nodes.find((node) => node.type === "repository" && node.label === "beta");
    assert.equal(alpha?.taxonomyAssignment?.categoryId, "robotics");
    assert.equal(beta?.taxonomyAssignment?.categoryId, "web-apps");
    assert.equal(alpha?.groupId, "uncategorized");
    assert.equal(beta?.groupId, "uncategorized");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("Action applies programmatic repository override with provider disabled", async () => {
  const dir = await mkdtemp(join(tmpdir(), "project-map-p3b1-override-"));
  try {
    const result = await generateStaticMap(config(), { cwd: dir, fetchRepos: async () => [repo(1, "robot")], taxonomyOverrides: { version: 1, categories, repositories: { robot: { categoryId: "web-apps", secondaryTags: ["manual"] } } } });
    const node = result.graph.nodes.find((item) => item.type === "repository" && item.label === "robot");
    assert.equal(node?.taxonomyAssignment?.method, "override"); assert.equal(node?.taxonomyAssignment?.categoryId, "web-apps");
    assert.equal(result.taxonomyAssignment.diagnostics.providerId, "disabled"); assert.equal(result.taxonomyAssignment.diagnostics.overridden, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("static sanitizer preserves valid taxonomyAssignment, replaces spoofed label, and drops assignments to unknown taxonomy categories", async () => {
  const repos = [{ ...repo(1, "robot"), html_url: "https://github.com/octocat/robot" }, { ...repo(2, "web"), html_url: "https://github.com/octocat/web" }];
  const taxonomy = await taxonomyFor(repos); const input = buildGraph("octocat", repos, true, true); input.taxonomy = taxonomy; input.taxonomyAssignmentVersion = 1;
  const robot = input.nodes.find((node) => node.type === "repository" && node.label === "robot"); const web = input.nodes.find((node) => node.type === "repository" && node.label === "web");
  robot.taxonomyAssignment = { categoryId: "robotics", categoryLabel: "SPOOFED", secondaryTags: ["control"], confidence: 0.95, method: "semantic", score: 0.95, margin: 0.3, evidence: [{ categoryId: "robotics", source: "embedding", value: "cosine=0.95", weight: 0.95 }] };
  web.taxonomyAssignment = { categoryId: "missing", categoryLabel: "Missing", secondaryTags: [], confidence: 1, method: "override", evidence: [{ categoryId: "missing", source: "override", value: "bad", weight: 1 }] };
  const clean = sanitizeStaticGraph(input, "octocat"); assert.ok(clean);
  const cleanRobot = clean.nodes.find((node) => node.type === "repository" && node.label === "robot"); const cleanWeb = clean.nodes.find((node) => node.type === "repository" && node.label === "web");
  assert.equal(cleanRobot?.taxonomyAssignment?.categoryLabel, "Robotics"); assert.equal(cleanRobot?.taxonomyAssignment?.categoryId, "robotics"); assert.equal(cleanWeb?.taxonomyAssignment, undefined); assert.equal(clean.taxonomyAssignmentVersion, 1);
});
