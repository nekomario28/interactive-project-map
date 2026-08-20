import { normalizeSemanticEvaluationExpected } from "./semantic-evaluation.mjs";

const CATEGORY_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

function rounded(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function ratio(numerator, denominator) {
  return denominator > 0 ? rounded(numerator / denominator) : null;
}

function choose2(value) {
  return value >= 2 ? (value * (value - 1)) / 2 : 0;
}

function repositoryNodes(graph) {
  if (!graph || typeof graph !== "object" || !Array.isArray(graph.nodes)) throw new Error("Partition evaluation graph must contain a nodes array");
  const nodes = new Map();
  for (const node of graph.nodes) {
    if (!node || typeof node !== "object" || node.type !== "repository") continue;
    const label = String(node.label ?? "").normalize("NFKC").trim();
    if (!label) continue;
    const key = label.toLocaleLowerCase("en-US");
    if (!nodes.has(key)) nodes.set(key, node);
  }
  return nodes;
}

function actualCategory(node) {
  const assignment = node?.taxonomyAssignment;
  if (!assignment || typeof assignment !== "object" || Array.isArray(assignment)) return null;
  const categoryId = String(assignment.categoryId ?? "").normalize("NFKC").trim();
  return CATEGORY_ID_RE.test(categoryId) ? categoryId : null;
}

function adjustedRandIndex(contingency, expectedSizes, actualSizes, total) {
  if (total < 2) return null;
  const totalPairs = choose2(total);
  const sumCells = [...contingency.values()].reduce((sum, count) => sum + choose2(count), 0);
  const sumExpected = [...expectedSizes.values()].reduce((sum, count) => sum + choose2(count), 0);
  const sumActual = [...actualSizes.values()].reduce((sum, count) => sum + choose2(count), 0);
  const expectedIndex = (sumExpected * sumActual) / totalPairs;
  const maxIndex = 0.5 * (sumExpected + sumActual);
  const denominator = maxIndex - expectedIndex;
  if (Math.abs(denominator) < 1e-12) return sumCells === maxIndex ? 1 : 0;
  return rounded((sumCells - expectedIndex) / denominator);
}

function clusterPurity(contingency, actualSizes, total) {
  if (total <= 0) return null;
  let majoritySum = 0;
  for (const actualId of actualSizes.keys()) {
    let maximum = 0;
    for (const [key, count] of contingency) {
      if (key.startsWith(`${actualId}\u0000`)) maximum = Math.max(maximum, count);
    }
    majoritySum += maximum;
  }
  return rounded(majoritySum / total);
}

export function evaluateTaxonomyPartition(graph, expectedValue) {
  const expected = normalizeSemanticEvaluationExpected(expectedValue);
  const nodes = repositoryNodes(graph);
  const rows = [];
  const missing = [];
  const ambiguous = [];

  for (const [repository, truth] of Object.entries(expected.repositories).sort(([a], [b]) => a.localeCompare(b))) {
    const node = nodes.get(repository.toLocaleLowerCase("en-US"));
    if (!node) {
      missing.push(repository);
      continue;
    }
    const actual = actualCategory(node);
    if (!actual) {
      ambiguous.push(repository);
      continue;
    }
    rows.push({ repository, expectedCategoryId: truth.categoryId, actualCategoryId: actual });
  }

  const expectedSizes = new Map();
  const actualSizes = new Map();
  const contingency = new Map();
  for (const row of rows) {
    expectedSizes.set(row.expectedCategoryId, (expectedSizes.get(row.expectedCategoryId) ?? 0) + 1);
    actualSizes.set(row.actualCategoryId, (actualSizes.get(row.actualCategoryId) ?? 0) + 1);
    const key = `${row.actualCategoryId}\u0000${row.expectedCategoryId}`;
    contingency.set(key, (contingency.get(key) ?? 0) + 1);
  }

  const expectedSame = [...expectedSizes.values()].reduce((sum, count) => sum + choose2(count), 0);
  const predictedSame = [...actualSizes.values()].reduce((sum, count) => sum + choose2(count), 0);
  const truePositive = [...contingency.values()].reduce((sum, count) => sum + choose2(count), 0);
  const precision = ratio(truePositive, predictedSame);
  const recall = ratio(truePositive, expectedSame);
  const pairwiseF1 = precision == null || recall == null || precision + recall === 0
    ? (expectedSame === 0 && predictedSame === 0 && rows.length > 0 ? 1 : null)
    : rounded((2 * precision * recall) / (precision + recall));

  const expectedClusterDetails = [...expectedSizes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([categoryId, count]) => {
    const actualClusters = new Set(rows.filter((row) => row.expectedCategoryId === categoryId).map((row) => row.actualCategoryId));
    return { categoryId, repositories: count, actualClusters: actualClusters.size, fragmented: actualClusters.size > 1 };
  });
  const actualClusterDetails = [...actualSizes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([categoryId, count]) => {
    const expectedClusters = new Set(rows.filter((row) => row.actualCategoryId === categoryId).map((row) => row.expectedCategoryId));
    return { categoryId, repositories: count, expectedClusters: expectedClusters.size, mixed: expectedClusters.size > 1 };
  });

  const totalExpected = Object.keys(expected.repositories).length;
  const present = totalExpected - missing.length;
  return {
    version: 1,
    summary: {
      expected: totalExpected,
      present,
      assigned: rows.length,
      ambiguous: ambiguous.length,
      missing: missing.length,
      coverage: ratio(rows.length, present),
      ambiguityRate: ratio(ambiguous.length, present),
      expectedClusters: expectedSizes.size,
      actualClusters: actualSizes.size,
    },
    partition: {
      pairwiseTruePositive: truePositive,
      pairwisePredictedSame: predictedSame,
      pairwiseExpectedSame: expectedSame,
      pairwisePrecision: precision,
      pairwiseRecall: recall,
      pairwiseF1,
      adjustedRandIndex: adjustedRandIndex(contingency, expectedSizes, actualSizes, rows.length),
      purity: clusterPurity(contingency, actualSizes, rows.length),
    },
    expectedClusterDetails,
    actualClusterDetails,
    assignments: rows,
    ambiguous,
    missing,
  };
}

function failure(name, actual, operator, expected) {
  if (actual == null) return `${name} unavailable`;
  if (operator === "min" && actual < expected) return `${name} ${actual} < minimum ${expected}`;
  if (operator === "max" && actual > expected) return `${name} ${actual} > maximum ${expected}`;
  return null;
}

export function evaluateTaxonomyPartitionThresholds(report, thresholds = {}) {
  const checks = [
    ["coverage", report.summary.coverage, "min", thresholds.minCoverage],
    ["ambiguityRate", report.summary.ambiguityRate, "max", thresholds.maxAmbiguityRate],
    ["pairwiseF1", report.partition.pairwiseF1, "min", thresholds.minPairwiseF1],
    ["adjustedRandIndex", report.partition.adjustedRandIndex, "min", thresholds.minAdjustedRandIndex],
    ["purity", report.partition.purity, "min", thresholds.minPurity],
    ["actualClusters", report.summary.actualClusters, "max", thresholds.maxActualClusters],
  ];
  const failures = [];
  for (const [name, actual, operator, expected] of checks) {
    if (expected == null) continue;
    if (typeof expected !== "number" || !Number.isFinite(expected)) throw new Error(`Invalid partition threshold ${name}`);
    const message = failure(name, actual, operator, expected);
    if (message) failures.push(message);
  }
  return { passed: failures.length === 0, failures };
}
