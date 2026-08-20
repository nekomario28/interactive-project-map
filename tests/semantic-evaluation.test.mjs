import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  collectSemanticRunMetrics,
  evaluateSemanticGraph,
  evaluateSemanticThresholds,
  normalizeSemanticEvaluationExpected,
} from "../scripts/semantic-evaluation.mjs";

function taxonomy(categories, fingerprint = "a".repeat(64)) {
  return {
    schemaVersion: 1,
    corpusFingerprint: fingerprint,
    repositories: [],
    categories: categories.map(([id, label]) => ({ id, label, description: `${label} projects`, aliases: [] })),
    source: { providerId: "fixture", model: "fixture" },
  };
}

function assignment(categoryId, method, confidence = 0.9) {
  return { categoryId, categoryLabel: categoryId, secondaryTags: [], confidence, method, evidence: [] };
}

function repo(label, taxonomyAssignment) {
  return { id: `repo:${label}`, label, type: "repository", ...(taxonomyAssignment ? { taxonomyAssignment } : {}) };
}

const expected = {
  version: 1,
  repositories: {
    alpha: { categoryId: "robotics" },
    beta: { categoryId: "web" },
    gamma: { categoryId: "data" },
    delta: { categoryId: "robotics" },
    missing: { categoryId: "web" },
  },
};

const graph = {
  owner: "fixture",
  nodes: [
    repo("alpha", assignment("robotics", "deterministic", 0.96)),
    repo("beta", assignment("data", "semantic", 0.81)),
    repo("gamma"),
    repo("delta", assignment("robotics", "llm", 0.77)),
  ],
  taxonomy: taxonomy([["robotics", "Robotics"], ["web", "Web"], ["data", "Data"]], "b".repeat(64)),
};

const previousGraph = {
  owner: "fixture",
  nodes: [
    repo("alpha", assignment("robotics", "deterministic", 0.95)),
    repo("beta", assignment("web", "semantic", 0.79)),
    repo("gamma"),
    repo("delta", assignment("robotics", "llm", 0.75)),
  ],
  taxonomy: taxonomy([["robotics", "Robotics Old"], ["web", "Web"], ["legacy", "Legacy"]], "a".repeat(64)),
};

const diagnostics = {
  semantic: { embedding: { cacheHits: 4, embedded: 1, dimension: 3 }, diagnostics: { comparisons: 6, retainedCandidates: 4, emittedEdges: 3 } },
  taxonomy: { diagnostics: { discovered: false, reused: true, overridden: false, driftRatio: 0.1, changedRepositories: 1, reason: "small-drift" } },
  taxonomyAssignment: { diagnostics: { assigned: 3, ambiguous: 1, overridden: 0, deterministic: 1, semantic: 1, repositoryCacheHits: 2, repositoryEmbedded: 0, categoryCacheHits: 3, categoryEmbedded: 0 } },
  taxonomyAdjudication: { diagnostics: { eligible: 2, attempted: 1, accepted: 1, declined: 0, invalid: 0, remaining: 1, calls: 1, capped: false } },
};

test("semantic evaluation measures accuracy, coverage, ambiguity, category use, churn, and run metrics", () => {
  const report = evaluateSemanticGraph(graph, expected, { previousGraph, runDiagnostics: diagnostics });
  assert.deepEqual(report.summary, {
    expected: 5,
    present: 4,
    missing: 1,
    assigned: 3,
    ambiguous: 1,
    correct: 2,
    incorrect: 1,
    coverage: 0.75,
    assignedAccuracy: 0.666667,
    endToEndAccuracy: 0.5,
    ambiguityRate: 0.25,
    missingRate: 0.2,
  });
  assert.deepEqual(report.methods, { override: 0, deterministic: 1, semantic: 1, llm: 1 });
  assert.deepEqual(report.mismatches, [{ repository: "beta", expectedCategoryId: "web", actualCategoryId: "data", method: "semantic", confidence: 0.81 }]);
  assert.deepEqual(report.ambiguous, ["gamma"]);
  assert.deepEqual(report.missing, ["missing"]);
  assert.equal(report.taxonomy.usage.largestCategoryShare, 0.666667);
  assert.deepEqual(report.taxonomy.usage.unusedCategories, ["web"]);
  assert.deepEqual(report.taxonomy.usage.singletonCategories, ["data"]);
  assert.equal(report.taxonomy.churn.churnRate, 0.75);
  assert.equal(report.taxonomy.churn.corpusFingerprintChanged, true);
  assert.equal(report.assignmentChurn.comparable, 3);
  assert.equal(report.assignmentChurn.changed, 1);
  assert.equal(report.assignmentChurn.churnRate, 0.333333);
  assert.equal(report.runMetrics.assignment.repositoryCacheHits, 2);
  assert.equal(report.runMetrics.assignment.repositoryEmbedded, 0);
  assert.equal(report.runMetrics.adjudication.calls, 1);
});

test("expected fixture is strict, case-insensitive for duplicate repository names, and category ids are normalized", () => {
  const normalized = normalizeSemanticEvaluationExpected({ version: 1, repositories: { Alpha: { categoryId: "ROBOTICS", secondaryTags: ["Sim", "sim", "  Real  "] } } });
  assert.deepEqual(normalized.repositories.Alpha, { categoryId: "robotics", secondaryTags: ["Sim", "Real"] });
  assert.throws(() => normalizeSemanticEvaluationExpected({ version: 1, repositories: { Alpha: { categoryId: "robotics" }, alpha: { categoryId: "robotics" } } }), /Duplicate evaluation repository name/);
  assert.throws(() => normalizeSemanticEvaluationExpected({ version: 2, repositories: { alpha: { categoryId: "robotics" } } }), /version must be 1/);
});

test("threshold gate only enforces explicitly configured quality, churn, balance, and call limits", () => {
  const report = evaluateSemanticGraph(graph, expected, { previousGraph, runDiagnostics: diagnostics });
  const pass = evaluateSemanticThresholds(report, { minCoverage: 0.7, maxAmbiguityRate: 0.3, maxAdjudicatorCalls: 1 });
  assert.equal(pass.passed, true);
  const fail = evaluateSemanticThresholds(report, { minAssignedAccuracy: 0.8, maxTaxonomyChurnRate: 0.2, maxLargestCategoryShare: 0.5, maxAdjudicatorCalls: 0 });
  assert.equal(fail.passed, false);
  assert.equal(fail.failures.length, 4);
});

test("run metric collector accepts generation-result diagnostics without provider-specific code", () => {
  const metrics = collectSemanticRunMetrics(diagnostics);
  assert.deepEqual(metrics.semanticEdges, { comparisons: 6, retainedCandidates: 4, emittedEdges: 3 });
  assert.deepEqual(metrics.embedding, { cacheHits: 4, embedded: 1, dimension: 3 });
  assert.equal(metrics.taxonomy.reason, "small-drift");
  assert.equal(metrics.adjudication.accepted, 1);
});

test("public portfolio candidate fixture stays strict, complete, profile-excluded, and intentionally five-category", async () => {
  const raw = JSON.parse(await readFile("docs/semantic-evaluation-nekomario28.candidate.json", "utf8"));
  const candidate = normalizeSemanticEvaluationExpected(raw);
  const names = Object.keys(candidate.repositories);
  assert.equal(names.length, 12);
  assert.equal(names.some((name) => name.toLowerCase() === "nekomario28"), false);
  assert.deepEqual(new Set(names.map((name) => name.toLowerCase())).size, 12);
  const counts = {};
  for (const item of Object.values(candidate.repositories)) counts[item.categoryId] = (counts[item.categoryId] ?? 0) + 1;
  assert.deepEqual(counts, {
    "hardware-integration": 1,
    robotics: 2,
    "game-development": 1,
    "minecraft-modding": 7,
    "developer-tools": 1,
  });
});

test("CLI writes a machine-readable report and exits 2 only when an explicit gate fails", async () => {
  const dir = await mkdtemp(join(tmpdir(), "project-map-semantic-eval-"));
  try {
    const graphPath = join(dir, "graph.json");
    const expectedPath = join(dir, "expected.json");
    const previousPath = join(dir, "previous.json");
    const diagnosticsPath = join(dir, "diagnostics.json");
    const outputPath = join(dir, "report.json");
    await Promise.all([
      writeFile(graphPath, JSON.stringify(graph)),
      writeFile(expectedPath, JSON.stringify(expected)),
      writeFile(previousPath, JSON.stringify(previousGraph)),
      writeFile(diagnosticsPath, JSON.stringify(diagnostics)),
    ]);

    const ok = spawnSync(process.execPath, ["scripts/evaluate-semantic.mjs", "--graph", graphPath, "--expected", expectedPath, "--previous", previousPath, "--diagnostics", diagnosticsPath, "--output", outputPath, "--min-coverage", "0.7", "--max-adjudicator-calls", "1"], { encoding: "utf8" });
    assert.equal(ok.status, 0, ok.stderr);
    const written = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(written.gate.passed, true);
    assert.equal(written.summary.assignedAccuracy, 0.666667);

    const failed = spawnSync(process.execPath, ["scripts/evaluate-semantic.mjs", "--graph", graphPath, "--expected", expectedPath, "--min-assigned-accuracy", "0.9"], { encoding: "utf8" });
    assert.equal(failed.status, 2);
    assert.match(failed.stderr, /assignedAccuracy/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
