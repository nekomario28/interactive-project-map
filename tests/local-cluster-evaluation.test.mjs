import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLargePortfolioFixture,
  localGraphScopeStats,
  runLocalClusterEvaluation,
  thresholdComponents,
  triangleSupportedComponents,
} from "../scripts/local-cluster-evaluation.mjs";

function sortedEntries(value) {
  return Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
}

test("large-portfolio fixtures cover 80, 150, and 300 repositories with bounded sparse relations", () => {
  for (const config of [
    { repositories: 80, categories: 4, localsPerCategory: 2 },
    { repositories: 150, categories: 5, localsPerCategory: 3 },
    { repositories: 300, categories: 6, localsPerCategory: 5 },
  ]) {
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
