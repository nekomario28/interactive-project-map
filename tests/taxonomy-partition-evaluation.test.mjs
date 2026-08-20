import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { evaluateTaxonomyPartition, evaluateTaxonomyPartitionThresholds } from "../scripts/taxonomy-partition-evaluation.mjs";

function repo(label, categoryId) {
  return {
    id: `repo:${label}`,
    label,
    type: "repository",
    ...(categoryId ? { taxonomyAssignment: { categoryId, categoryLabel: categoryId, confidence: 0.9, method: "semantic", secondaryTags: [], evidence: [] } } : {}),
  };
}

const expected = {
  version: 1,
  repositories: {
    alpha: { categoryId: "robotics" },
    beta: { categoryId: "robotics" },
    gamma: { categoryId: "web" },
    delta: { categoryId: "web" },
  },
};

test("partition metrics are invariant to discovered category ids when grouping is identical", () => {
  const graph = { nodes: [repo("alpha", "cluster-a"), repo("beta", "cluster-a"), repo("gamma", "cluster-b"), repo("delta", "cluster-b")] };
  const report = evaluateTaxonomyPartition(graph, expected);
  assert.equal(report.summary.coverage, 1);
  assert.equal(report.summary.expectedClusters, 2);
  assert.equal(report.summary.actualClusters, 2);
  assert.deepEqual(report.partition, {
    pairwiseTruePositive: 2,
    pairwisePredictedSame: 2,
    pairwiseExpectedSame: 2,
    pairwisePrecision: 1,
    pairwiseRecall: 1,
    pairwiseF1: 1,
    adjustedRandIndex: 1,
    purity: 1,
  });
});

test("partition metrics expose split and merged categories without relying on labels", () => {
  const split = evaluateTaxonomyPartition({ nodes: [repo("alpha", "a1"), repo("beta", "a2"), repo("gamma", "b"), repo("delta", "b")] }, expected);
  assert.equal(split.partition.pairwisePrecision, 1);
  assert.equal(split.partition.pairwiseRecall, 0.5);
  assert.equal(split.partition.pairwiseF1, 0.666667);
  assert.equal(split.expectedClusterDetails.find((item) => item.categoryId === "robotics").fragmented, true);

  const merged = evaluateTaxonomyPartition({ nodes: [repo("alpha", "all"), repo("beta", "all"), repo("gamma", "all"), repo("delta", "all")] }, expected);
  assert.equal(merged.partition.pairwisePrecision, 0.333333);
  assert.equal(merged.partition.pairwiseRecall, 1);
  assert.equal(merged.partition.pairwiseF1, 0.5);
  assert.equal(merged.actualClusterDetails[0].mixed, true);
  assert.equal(merged.partition.purity, 0.5);
});

test("partition quality always reports coverage so ambiguity cannot manufacture a perfect clustering score", () => {
  const report = evaluateTaxonomyPartition({ nodes: [repo("alpha", "x"), repo("beta", "x"), repo("gamma"), repo("delta")] }, expected);
  assert.equal(report.summary.coverage, 0.5);
  assert.equal(report.summary.ambiguityRate, 0.5);
  assert.equal(report.partition.pairwiseF1, 1);
  const gate = evaluateTaxonomyPartitionThresholds(report, { minPairwiseF1: 0.9, minCoverage: 0.8 });
  assert.equal(gate.passed, false);
  assert.deepEqual(gate.failures, ["coverage 0.5 < minimum 0.8"]);
});

test("adjusted Rand index and purity remain bounded for mixed nontrivial partitions", () => {
  const report = evaluateTaxonomyPartition({ nodes: [repo("alpha", "x"), repo("beta", "y"), repo("gamma", "x"), repo("delta", "y")] }, expected);
  assert.equal(report.partition.adjustedRandIndex, -0.5);
  assert.equal(report.partition.purity, 0.5);
  assert.ok(report.partition.pairwiseF1 >= 0 && report.partition.pairwiseF1 <= 1);
});

test("partition CLI is machine-readable and exits 2 only for an explicit failed gate", async () => {
  const dir = await mkdtemp(join(tmpdir(), "project-map-partition-eval-"));
  try {
    const graphPath = join(dir, "graph.json");
    const expectedPath = join(dir, "expected.json");
    await writeFile(graphPath, JSON.stringify({ nodes: [repo("alpha", "cluster-a"), repo("beta", "cluster-a"), repo("gamma", "cluster-b"), repo("delta", "cluster-b")] }));
    await writeFile(expectedPath, JSON.stringify(expected));

    const ok = spawnSync(process.execPath, ["scripts/evaluate-taxonomy-partition.mjs", "--graph", graphPath, "--expected", expectedPath, "--min-pairwise-f1", "0.9", "--min-adjusted-rand-index", "0.9"], { encoding: "utf8" });
    assert.equal(ok.status, 0, ok.stderr);
    const report = JSON.parse(ok.stdout);
    assert.equal(report.partition.adjustedRandIndex, 1);

    const failed = spawnSync(process.execPath, ["scripts/evaluate-taxonomy-partition.mjs", "--graph", graphPath, "--expected", expectedPath, "--max-actual-clusters", "1"], { encoding: "utf8" });
    assert.equal(failed.status, 2);
    assert.match(failed.stderr, /actualClusters/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
