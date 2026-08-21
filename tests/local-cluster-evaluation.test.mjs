import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLargePortfolioFixture,
  localGraphScopeStats,
  perturbSemanticEdges,
  runLocalClusterEvaluation,
  thresholdComponents,
  triangleSupportedComponents,
} from "../scripts/local-cluster-evaluation.mjs";
import { evaluateTaxonomyPartition } from "../scripts/taxonomy-partition-evaluation.mjs";

const FIXTURES = [
  { repositories: 80, categories: 4, localsPerCategory: 2 },
  { repositories: 150, categories: 5, localsPerCategory: 3 },
  { repositories: 300, categories: 6, localsPerCategory: 5 },
];
const PROFILES = ["clear", "blurred"];
const SWEEP_THRESHOLDS = [0.72, 0.76, 0.8, 0.82, 0.84, 0.86, 0.88, 0.9];

function sortedEntries(value) {
  return Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
}

function expectedFixture(graph, categoryForNode) {
  return {
    version: 1,
    taxonomyId: "synthetic-local-clusters",
    repositories: Object.fromEntries(
      graph.nodes.filter((node) => node?.type === "repository").map((node) => [node.label, { categoryId: categoryForNode(node) }]),
    ),
  };
}

function assignedGraph(graph, assignments) {
  return {
    nodes: graph.nodes.map((node) => node?.type !== "repository" ? node : {
      ...node,
      taxonomyAssignment: { categoryId: assignments[node.id], label: assignments[node.id] },
    }),
  };
}

function partitionReport(graph, assignments, categoryForNode) {
  return evaluateTaxonomyPartition(assignedGraph(graph, assignments), expectedFixture(graph, categoryForNode));
}

function sizes(assignments) {
  const counts = new Map();
  for (const value of Object.values(assignments)) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.values()];
}

function sweepCandidate(name, detector) {
  return SWEEP_THRESHOLDS.map((threshold) => {
    const rows = [];
    for (const config of FIXTURES) {
      for (const profile of PROFILES) {
        const graph = buildLargePortfolioFixture(config, profile);
        const assignments = detector(graph, threshold);
        const truth = partitionReport(graph, assignments, (node) => node.latentLocalCluster);
        const changed = detector(perturbSemanticEdges(graph), threshold);
        const churn = partitionReport(graph, changed, (node) => assignments[node.id]);
        const clusterSizes = sizes(assignments);
        const depth2 = localGraphScopeStats(graph, 2);
        rows.push({
          repositories: config.repositories,
          profile,
          truthAri: truth.partition.adjustedRandIndex,
          churnAri: churn.partition.adjustedRandIndex,
          singletonRate: clusterSizes.filter((value) => value === 1).length / clusterSizes.length,
          maxClusterSize: Math.max(...clusterSizes),
          smallerThanDepth2P95: Math.max(...clusterSizes) < depth2.p95,
        });
      }
    }
    const failures = [];
    for (const row of rows) {
      const prefix = `${row.repositories}/${row.profile}`;
      if ((row.truthAri ?? -1) < 0.85) failures.push(`${prefix}:truth`);
      if ((row.churnAri ?? -1) < 0.9) failures.push(`${prefix}:churn`);
      if (row.singletonRate > 0.05) failures.push(`${prefix}:singletons`);
      if (!row.smallerThanDepth2P95) failures.push(`${prefix}:scope`);
    }
    return {
      name,
      threshold,
      passed: failures.length === 0,
      worstTruthAri: Math.min(...rows.map((row) => row.truthAri ?? -1)),
      worstChurnAri: Math.min(...rows.map((row) => row.churnAri ?? -1)),
      worstSingletonRate: Math.max(...rows.map((row) => row.singletonRate)),
      scopeFailures: rows.filter((row) => !row.smallerThanDepth2P95).length,
      failures,
    };
  });
}

test("large-portfolio fixtures cover 80, 150, and 300 repositories with bounded sparse relations", () => {
  for (const config of FIXTURES) {
    const graph = buildLargePortfolioFixture(config, "clear");
    assert.equal(graph.repositoryCount, config.repositories);
    assert.equal(graph.nodes.length, config.repositories);
    assert.ok(graph.semanticEdges.length > config.repositories);
    assert.ok(graph.semanticEdges.length < config.repositories * 10);
    const depth1 = localGraphScopeStats(graph, 1);
    const depth2 = localGraphScopeStats(graph, 2);
    assert.ok(depth1.mean > 1);
    assert.ok(depth2.mean >= depth1.mean);
  }
});

test("deterministic candidates are invariant to node and edge input order", () => {
  const graph = buildLargePortfolioFixture({ repositories: 150, categories: 5, localsPerCategory: 3 }, "clear");
  const reversed = { ...graph, nodes: [...graph.nodes].reverse(), semanticEdges: [...graph.semanticEdges].reverse() };
  for (const detector of [thresholdComponents, triangleSupportedComponents]) {
    assert.deepEqual(sortedEntries(detector(graph)), sortedEntries(detector(reversed)));
  }
});

test("phase-one report measures truth, churn, balance, and Local Graph interaction scope without promoting a feature", () => {
  const report = runLocalClusterEvaluation();
  assert.equal(report.scenarios.length, 6);
  assert.deepEqual([...new Set(report.scenarios.map((scenario) => scenario.repositories))], [80, 150, 300]);
  assert.deepEqual([...new Set(report.scenarios.map((scenario) => scenario.profile))], ["clear", "blurred"]);
  assert.equal(report.decisions.length, 2);

  for (const scenario of report.scenarios) {
    assert.ok(scenario.baseline.maxCategorySize >= 20);
    assert.ok(scenario.baseline.focusDepth2.p95 >= scenario.baseline.focusDepth1.p95);
    for (const candidate of scenario.candidates) {
      assert.ok(candidate.clusters >= scenario.baseline.categories);
      assert.ok(candidate.maxClusterSize >= 1);
      assert.ok(candidate.singletonRate >= 0 && candidate.singletonRate <= 1);
      assert.equal(candidate.orderAdjustedRandIndex, 1);
      for (const metric of [candidate.truth.pairwiseF1, candidate.truth.adjustedRandIndex, candidate.truth.purity, candidate.churnAdjustedRandIndex]) {
        assert.ok(metric == null || (Number.isFinite(metric) && metric >= -1 && metric <= 1));
      }
    }
  }

  console.log(`LOCAL_CLUSTER_EVAL=${JSON.stringify(report)}`);
});

test("global threshold sweep cannot hide a fragile candidate behind one hand-picked cutoff", () => {
  const sweep = [
    ...sweepCandidate("threshold-components", thresholdComponents),
    ...sweepCandidate("triangle-components", triangleSupportedComponents),
  ];
  assert.equal(sweep.length, SWEEP_THRESHOLDS.length * 2);
  for (const row of sweep) {
    assert.ok(row.worstTruthAri >= -1 && row.worstTruthAri <= 1);
    assert.ok(row.worstChurnAri >= -1 && row.worstChurnAri <= 1);
    assert.ok(row.worstSingletonRate >= 0 && row.worstSingletonRate <= 1);
  }
  console.log(`LOCAL_CLUSTER_THRESHOLD_SWEEP=${JSON.stringify(sweep)}`);
});
