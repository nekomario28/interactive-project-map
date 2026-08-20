import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateStaticMap } from "../scripts/action.mjs";
import {
  DEFAULT_TAXONOMY_ADJUDICATION_MAX_CASES,
  DISABLED_TAXONOMY_ADJUDICATOR as SCRIPT_DISABLED,
  HARD_TAXONOMY_ADJUDICATION_MAX_CASES,
  adjudicateAmbiguousTaxonomyAssignments as adjudicateScript,
} from "../scripts/taxonomy-adjudication.mjs";
import {
  DISABLED_TAXONOMY_ADJUDICATOR as SOURCE_DISABLED,
  adjudicateAmbiguousTaxonomyAssignments as adjudicateSource,
} from "../src/taxonomy-adjudication.ts";
import { resolvePortfolioTaxonomy } from "../scripts/taxonomy.mjs";
import { buildGraph } from "../src/graph.ts";
import { sanitizeStaticGraph } from "../src/static-graph.ts";

function repo(id, name, overrides = {}) {
  return {
    id, name, html_url: `https://github.com/example/${name}`, description: `${name} project`, language: "TypeScript", topics: [],
    stargazers_count: 0, forks_count: 0, fork: false, archived: false, updated_at: "2026-08-20T00:00:00Z",
    readmeExcerpt: `${name} README`, frameworks: [], manifests: [], ...overrides,
  };
}

const categories = [
  { id: "robotics", label: "Robotics", description: "Robot control simulation", aliases: ["ROS2"] },
  { id: "web-apps", label: "Web / Apps", description: "Web applications", aliases: ["React"] },
];

async function taxonomyFor(repos) {
  const result = await resolvePortfolioTaxonomy(repos, { id: "fixture-taxonomy", model: "v1", async discover() { return { categories }; } });
  assert.ok(result.taxonomy);
  return result.taxonomy;
}

function baseAssignment(ambiguous, assignments = {}) {
  return {
    assignments,
    ambiguous,
    diagnostics: {
      documents: ambiguous.length + Object.keys(assignments).length, categories: 2, assigned: Object.keys(assignments).length, ambiguous: ambiguous.length,
      overridden: 0, deterministic: Object.keys(assignments).length, semantic: 0, providerId: "disabled", model: "disabled", disabled: true,
      repositoryCacheHits: 0, repositoryEmbedded: 0, categoryCacheHits: 0, categoryEmbedded: 0,
    },
  };
}

function adjudicator(handler) {
  const state = { calls: 0, cases: [] };
  return {
    id: "fake-adjudicator", model: "fixture-v1", state,
    async adjudicate(cases) { state.calls += 1; state.cases.push(...structuredClone(cases)); return handler(cases); },
  };
}

function accepted(cases) {
  return cases.map((item) => ({ repoName: item.repoName, categoryId: item.repoName.includes("web") ? "web-apps" : "robotics", confidence: 0.91, secondaryTags: ["judged"], reason: `Ambiguous evidence resolved for ${item.repoName}` }));
}

test("disabled adjudicator makes zero calls and source/script implementations match", async () => {
  const repos = [repo(1, "mixed")]; const taxonomy = await taxonomyFor(repos); const base = baseAssignment(["mixed"]);
  const script = await adjudicateScript(repos, taxonomy, base, SCRIPT_DISABLED);
  const source = await adjudicateSource(repos, taxonomy, base, SOURCE_DISABLED);
  assert.deepEqual(source, script);
  assert.deepEqual(script.assignments, {});
  assert.deepEqual(script.ambiguous, ["mixed"]);
  assert.equal(script.diagnostics.attempted, 0);
  assert.equal(script.diagnostics.calls, 0);
  assert.equal(script.diagnostics.disabled, true);
});

test("only P3B1 ambiguous repositories are sent to adjudicator and accepted decisions become llm assignments", async () => {
  const repos = [repo(1, "already"), repo(2, "mixed"), repo(3, "web-mixed")];
  const taxonomy = await taxonomyFor(repos);
  const existing = { already: { categoryId: "robotics", categoryLabel: "Robotics", secondaryTags: [], confidence: 0.95, method: "semantic", evidence: [] } };
  const base = baseAssignment(["mixed", "web-mixed"], existing);
  const provider = adjudicator(accepted);
  const result = await adjudicateScript(repos, taxonomy, base, provider);
  assert.equal(provider.state.calls, 1);
  assert.deepEqual(provider.state.cases.map((item) => item.repoName).sort(), ["mixed", "web-mixed"]);
  assert.equal(provider.state.cases.some((item) => item.repoName === "already"), false);
  assert.equal(result.assignments.already.method, "semantic");
  assert.equal(result.assignments.mixed.method, "llm");
  assert.equal(result.assignments.mixed.categoryId, "robotics");
  assert.equal(result.assignments["web-mixed"].categoryId, "web-apps");
  assert.deepEqual(result.ambiguous, []);
  assert.equal(result.diagnostics.accepted, 2);
});

test("low-confidence/null decisions decline, malformed decisions stay ambiguous, and taxonomy labels cannot be spoofed", async () => {
  const repos = [repo(1, "low"), repo(2, "null"), repo(3, "bad-category"), repo(4, "bad-reason")];
  const taxonomy = await taxonomyFor(repos);
  const provider = adjudicator((cases) => cases.map((item) => {
    if (item.repoName === "low") return { repoName: item.repoName, categoryId: "robotics", confidence: 0.69, reason: "not enough" };
    if (item.repoName === "null") return { repoName: item.repoName, categoryId: null, confidence: 0.9, reason: "decline" };
    if (item.repoName === "bad-category") return { repoName: item.repoName, categoryId: "invented", confidence: 0.95, reason: "invented" };
    return { repoName: item.repoName, categoryId: "robotics", categoryLabel: "SPOOF", confidence: 0.95, reason: "" };
  }));
  const result = await adjudicateScript(repos, taxonomy, baseAssignment(repos.map((item) => item.name)), provider);
  assert.deepEqual(result.assignments, {});
  assert.deepEqual(result.ambiguous, ["bad-category", "bad-reason", "low", "null"]);
  assert.equal(result.diagnostics.declined, 2);
  assert.equal(result.diagnostics.invalid, 2);
});

test("adjudication has a hard 20-case cap and bounded batching", async () => {
  const repos = Array.from({ length: 35 }, (_, index) => repo(index + 1, `repo-${String(index).padStart(2, "0")}`));
  const taxonomy = await taxonomyFor(repos);
  const provider = adjudicator(accepted);
  const result = await adjudicateScript(repos, taxonomy, baseAssignment(repos.map((item) => item.name)), provider, { maxCases: 999, batchSize: 5 });
  assert.equal(DEFAULT_TAXONOMY_ADJUDICATION_MAX_CASES, 20);
  assert.equal(HARD_TAXONOMY_ADJUDICATION_MAX_CASES, 20);
  assert.equal(result.diagnostics.attempted, 20);
  assert.equal(result.diagnostics.accepted, 20);
  assert.equal(result.diagnostics.calls, 4);
  assert.equal(result.diagnostics.capped, true);
  assert.equal(result.ambiguous.length, 15);
  assert.equal(provider.state.cases.length, 20);
});

test("provider exception/cardinality mismatch preserve P3B1 assignments and ambiguous fallback", async () => {
  const repos = [repo(1, "already"), repo(2, "mixed")]; const taxonomy = await taxonomyFor(repos);
  const existing = { already: { categoryId: "robotics", categoryLabel: "Robotics", secondaryTags: [], confidence: 0.95, method: "deterministic", evidence: [] } };
  const base = baseAssignment(["mixed"], existing);
  const failed = await adjudicateScript(repos, taxonomy, base, { id: "failing", model: "v1", async adjudicate() { throw new Error("judge unavailable"); } });
  assert.equal(failed.assignments.already.method, "deterministic");
  assert.deepEqual(failed.ambiguous, ["mixed"]);
  assert.match(failed.error ?? "", /judge unavailable/);
  const wrong = await adjudicateScript(repos, taxonomy, base, { id: "wrong", model: "v1", async adjudicate() { return []; } });
  assert.deepEqual(wrong.ambiguous, ["mixed"]);
  assert.match(wrong.error ?? "", /decisions for 1 cases/);
});

test("Action invokes adjudicator only after P3B1 leaves a repository ambiguous and attaches accepted llm result without changing P1 group", async () => {
  const dir = await mkdtemp(join(tmpdir(), "project-map-p3b2-"));
  const provider = adjudicator(accepted);
  try {
    const result = await generateStaticMap({ username: "example", theme: "dark", style: "galaxy-systems", maxRepos: 100, includeForks: true, includeArchived: true, width: 740, height: 420, outputDir: "project-map" }, {
      cwd: dir,
      fetchRepos: async () => [repo(1, "mixed")],
      taxonomyOverrides: { version: 1, categories },
      taxonomyAdjudicator: provider,
    });
    assert.equal(result.taxonomyAssignment.ambiguous.length, 1, "disabled embedding stage should leave mixed ambiguous");
    assert.equal(provider.state.calls, 1);
    assert.equal(result.taxonomyAdjudication.diagnostics.accepted, 1);
    const node = result.graph.nodes.find((item) => item.type === "repository" && item.label === "mixed");
    assert.equal(node?.taxonomyAssignment?.method, "llm");
    assert.equal(node?.taxonomyAssignment?.categoryId, "robotics");
    assert.equal(node?.groupId, "uncategorized", "P3B2 must not promote adjudication into P1 hierarchy yet");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("static sanitizer preserves valid llm taxonomy assignment and forces taxonomy-owned label", async () => {
  const repos = [{ ...repo(1, "mixed"), html_url: "https://github.com/octocat/mixed" }];
  const taxonomy = await taxonomyFor(repos);
  const graph = buildGraph("octocat", repos, true, true);
  graph.taxonomy = taxonomy;
  const node = graph.nodes.find((item) => item.type === "repository");
  node.taxonomyAssignment = {
    categoryId: "robotics", categoryLabel: "SPOOF", secondaryTags: ["judge"], confidence: 0.93, method: "llm",
    evidence: [{ categoryId: "robotics", source: "llm", value: "bounded structured adjudication", weight: 0.93 }],
  };
  const clean = sanitizeStaticGraph(graph, "octocat");
  assert.ok(clean);
  const cleanNode = clean.nodes.find((item) => item.type === "repository");
  assert.equal(cleanNode?.taxonomyAssignment?.method, "llm");
  assert.equal(cleanNode?.taxonomyAssignment?.categoryLabel, "Robotics");
});
