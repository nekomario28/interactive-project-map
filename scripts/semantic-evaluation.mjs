export const SEMANTIC_EVALUATION_VERSION = 1;
export const SEMANTIC_EVALUATION_EXPECTED_VERSION = 1;

const REPO_NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;
const CATEGORY_ID_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const ASSIGNMENT_METHODS = new Set(["override", "deterministic", "semantic", "llm"]);

function rounded(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function ratio(numerator, denominator) {
  return denominator > 0 ? rounded(numerator / denominator) : null;
}

function normalizedRepoName(value) {
  const name = String(value ?? "").normalize("NFKC").trim();
  if (!REPO_NAME_RE.test(name)) throw new Error(`Invalid evaluation repository name: ${name || "(empty)"}`);
  return name;
}

function normalizedCategoryId(value) {
  const id = String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en-US");
  if (!CATEGORY_ID_RE.test(id)) throw new Error(`Invalid evaluation category id: ${id || "(empty)"}`);
  return id;
}

function normalizedTags(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error("Expected secondaryTags must be an array when present");
  const seen = new Set();
  const tags = [];
  for (const raw of value.slice(0, 16)) {
    const tag = String(raw ?? "").normalize("NFKC").replace(/\s+/gu, " ").trim().slice(0, 60);
    if (!tag) continue;
    const key = tag.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= 8) break;
  }
  return tags;
}

export function normalizeSemanticEvaluationExpected(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Semantic evaluation expected fixture must be an object");
  if (value.version !== SEMANTIC_EVALUATION_EXPECTED_VERSION) throw new Error(`Semantic evaluation expected fixture version must be ${SEMANTIC_EVALUATION_EXPECTED_VERSION}`);
  if (!value.repositories || typeof value.repositories !== "object" || Array.isArray(value.repositories)) throw new Error("Semantic evaluation expected fixture requires a repositories object");

  const repositories = {};
  const seen = new Set();
  const entries = Object.entries(value.repositories);
  if (!entries.length || entries.length > 400) throw new Error("Semantic evaluation expected fixture must contain 1-400 repositories");
  for (const [rawName, rawExpected] of entries) {
    const repoName = normalizedRepoName(rawName);
    const key = repoName.toLocaleLowerCase("en-US");
    if (seen.has(key)) throw new Error(`Duplicate evaluation repository name: ${repoName}`);
    seen.add(key);
    if (!rawExpected || typeof rawExpected !== "object" || Array.isArray(rawExpected)) throw new Error(`Expected label for ${repoName} must be an object`);
    repositories[repoName] = {
      categoryId: normalizedCategoryId(rawExpected.categoryId),
      secondaryTags: normalizedTags(rawExpected.secondaryTags),
    };
  }
  return { version: SEMANTIC_EVALUATION_EXPECTED_VERSION, repositories };
}

function repositoryNodes(graph) {
  if (!graph || typeof graph !== "object" || !Array.isArray(graph.nodes)) throw new Error("Evaluation graph must contain a nodes array");
  const byName = new Map();
  for (const node of graph.nodes) {
    if (!node || typeof node !== "object" || node.type !== "repository") continue;
    const name = String(node.label ?? "").normalize("NFKC").trim();
    if (!REPO_NAME_RE.test(name)) continue;
    const key = name.toLocaleLowerCase("en-US");
    if (!byName.has(key)) byName.set(key, node);
  }
  return byName;
}

function safeAssignment(node, taxonomyIds) {
  const raw = node?.taxonomyAssignment;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const categoryId = String(raw.categoryId ?? "").normalize("NFKC").trim().toLocaleLowerCase("en-US");
  if (!CATEGORY_ID_RE.test(categoryId)) return null;
  if (taxonomyIds && !taxonomyIds.has(categoryId)) return null;
  const method = String(raw.method ?? "");
  if (!ASSIGNMENT_METHODS.has(method)) return null;
  const confidence = typeof raw.confidence === "number" && Number.isFinite(raw.confidence) && raw.confidence >= 0 && raw.confidence <= 1 ? rounded(raw.confidence) : null;
  return { categoryId, method, confidence };
}

function taxonomyCategories(graph) {
  const categories = Array.isArray(graph?.taxonomy?.categories) ? graph.taxonomy.categories : [];
  const result = [];
  const seen = new Set();
  for (const raw of categories) {
    if (!raw || typeof raw !== "object") continue;
    const id = String(raw.id ?? "").normalize("NFKC").trim().toLocaleLowerCase("en-US");
    if (!CATEGORY_ID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    result.push({ id, label: String(raw.label ?? "").normalize("NFKC").trim().slice(0, 100) });
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

function taxonomyChurn(previousGraph, graph) {
  if (!previousGraph) return null;
  const before = taxonomyCategories(previousGraph);
  const after = taxonomyCategories(graph);
  const left = new Map(before.map((item) => [item.id, item]));
  const right = new Map(after.map((item) => [item.id, item]));
  const ids = [...new Set([...left.keys(), ...right.keys()])].sort();
  const added = [], removed = [], renamed = [];
  for (const id of ids) {
    const a = left.get(id), b = right.get(id);
    if (!a && b) added.push(id);
    else if (a && !b) removed.push(id);
    else if (a && b && a.label !== b.label) renamed.push({ id, before: a.label, after: b.label });
  }
  const changedIds = new Set([...added, ...removed, ...renamed.map((item) => item.id)]);
  return {
    previousCategories: before.length,
    currentCategories: after.length,
    added,
    removed,
    renamed,
    changedCategories: changedIds.size,
    churnRate: ratio(changedIds.size, ids.length),
    corpusFingerprintChanged: String(previousGraph?.taxonomy?.corpusFingerprint ?? "") !== String(graph?.taxonomy?.corpusFingerprint ?? ""),
  };
}

function assignmentChurn(previousGraph, graph) {
  if (!previousGraph) return null;
  const beforeNodes = repositoryNodes(previousGraph);
  const afterNodes = repositoryNodes(graph);
  const beforeTaxonomyIds = new Set(taxonomyCategories(previousGraph).map((item) => item.id));
  const afterTaxonomyIds = new Set(taxonomyCategories(graph).map((item) => item.id));
  const commonNames = [...beforeNodes.keys()].filter((key) => afterNodes.has(key)).sort();
  let comparable = 0, changed = 0;
  const changes = [];
  for (const key of commonNames) {
    const before = safeAssignment(beforeNodes.get(key), beforeTaxonomyIds.size ? beforeTaxonomyIds : null);
    const after = safeAssignment(afterNodes.get(key), afterTaxonomyIds.size ? afterTaxonomyIds : null);
    if (!before && !after) continue;
    comparable += 1;
    const beforeId = before?.categoryId ?? null;
    const afterId = after?.categoryId ?? null;
    if (beforeId !== afterId) {
      changed += 1;
      changes.push({ repository: String(afterNodes.get(key)?.label ?? beforeNodes.get(key)?.label ?? key), before: beforeId, after: afterId });
    }
  }
  return { comparable, changed, churnRate: ratio(changed, comparable), changes: changes.slice(0, 100) };
}

function safeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function collectSemanticRunMetrics(resultLike) {
  if (!resultLike || typeof resultLike !== "object") return null;
  const semantic = resultLike.semantic?.diagnostics ?? resultLike.semantic ?? {};
  const semanticEmbedding = resultLike.semantic?.embedding ?? {};
  const taxonomy = resultLike.taxonomy?.diagnostics ?? resultLike.taxonomy ?? {};
  const assignment = resultLike.taxonomyAssignment?.diagnostics ?? resultLike.taxonomyAssignment ?? {};
  const adjudication = resultLike.taxonomyAdjudication?.diagnostics ?? resultLike.taxonomyAdjudication ?? {};
  return {
    semanticEdges: {
      comparisons: safeNumber(semantic.comparisons),
      retainedCandidates: safeNumber(semantic.retainedCandidates),
      emittedEdges: safeNumber(semantic.emittedEdges),
    },
    embedding: {
      cacheHits: safeNumber(semanticEmbedding.cacheHits),
      embedded: safeNumber(semanticEmbedding.embedded),
      dimension: safeNumber(semanticEmbedding.dimension),
    },
    taxonomy: {
      discovered: taxonomy.discovered === true,
      reused: taxonomy.reused === true,
      overridden: taxonomy.overridden === true,
      driftRatio: safeNumber(taxonomy.driftRatio),
      changedRepositories: safeNumber(taxonomy.changedRepositories),
      reason: typeof taxonomy.reason === "string" ? taxonomy.reason.slice(0, 80) : "",
    },
    assignment: {
      assigned: safeNumber(assignment.assigned),
      ambiguous: safeNumber(assignment.ambiguous),
      overridden: safeNumber(assignment.overridden),
      deterministic: safeNumber(assignment.deterministic),
      semantic: safeNumber(assignment.semantic),
      repositoryCacheHits: safeNumber(assignment.repositoryCacheHits),
      repositoryEmbedded: safeNumber(assignment.repositoryEmbedded),
      categoryCacheHits: safeNumber(assignment.categoryCacheHits),
      categoryEmbedded: safeNumber(assignment.categoryEmbedded),
    },
    adjudication: {
      eligible: safeNumber(adjudication.eligible),
      attempted: safeNumber(adjudication.attempted),
      accepted: safeNumber(adjudication.accepted),
      declined: safeNumber(adjudication.declined),
      invalid: safeNumber(adjudication.invalid),
      remaining: safeNumber(adjudication.remaining),
      calls: safeNumber(adjudication.calls),
      capped: adjudication.capped === true,
    },
  };
}

function categoryUsage(graph, taxonomyIds) {
  const usage = new Map([...taxonomyIds].map((id) => [id, 0]));
  for (const node of repositoryNodes(graph).values()) {
    const assignment = safeAssignment(node, taxonomyIds.size ? taxonomyIds : null);
    if (assignment) usage.set(assignment.categoryId, (usage.get(assignment.categoryId) ?? 0) + 1);
  }
  const entries = [...usage.entries()].map(([categoryId, repositories]) => ({ categoryId, repositories })).sort((a, b) => b.repositories - a.repositories || a.categoryId.localeCompare(b.categoryId));
  const assigned = entries.reduce((sum, item) => sum + item.repositories, 0);
  return {
    categories: entries.length,
    assignedRepositories: assigned,
    unusedCategories: entries.filter((item) => item.repositories === 0).map((item) => item.categoryId),
    singletonCategories: entries.filter((item) => item.repositories === 1).map((item) => item.categoryId),
    largestCategoryShare: assigned > 0 ? rounded((entries[0]?.repositories ?? 0) / assigned) : null,
    usage: entries,
  };
}

export function evaluateSemanticGraph(graph, expectedValue, options = {}) {
  const expected = normalizeSemanticEvaluationExpected(expectedValue);
  const nodes = repositoryNodes(graph);
  const categories = taxonomyCategories(graph);
  const taxonomyIds = new Set(categories.map((item) => item.id));
  const expectedEntries = Object.entries(expected.repositories).sort(([a], [b]) => a.localeCompare(b));
  const methods = { override: 0, deterministic: 0, semantic: 0, llm: 0 };
  const perCategory = new Map();
  const mismatches = [], ambiguous = [], missing = [];
  let present = 0, assigned = 0, correct = 0;

  for (const [repoName, truth] of expectedEntries) {
    const bucket = perCategory.get(truth.categoryId) ?? { categoryId: truth.categoryId, expected: 0, present: 0, assigned: 0, correct: 0 };
    bucket.expected += 1;
    const node = nodes.get(repoName.toLocaleLowerCase("en-US"));
    if (!node) {
      missing.push(repoName);
      perCategory.set(truth.categoryId, bucket);
      continue;
    }
    present += 1;
    bucket.present += 1;
    const actual = safeAssignment(node, taxonomyIds.size ? taxonomyIds : null);
    if (!actual) {
      ambiguous.push(repoName);
      perCategory.set(truth.categoryId, bucket);
      continue;
    }
    assigned += 1;
    bucket.assigned += 1;
    methods[actual.method] += 1;
    if (actual.categoryId === truth.categoryId) {
      correct += 1;
      bucket.correct += 1;
    } else {
      mismatches.push({ repository: repoName, expectedCategoryId: truth.categoryId, actualCategoryId: actual.categoryId, method: actual.method, confidence: actual.confidence });
    }
    perCategory.set(truth.categoryId, bucket);
  }

  const incorrect = assigned - correct;
  const total = expectedEntries.length;
  const runMetrics = options.runDiagnostics ? collectSemanticRunMetrics(options.runDiagnostics) : null;
  return {
    version: SEMANTIC_EVALUATION_VERSION,
    summary: {
      expected: total,
      present,
      missing: total - present,
      assigned,
      ambiguous: present - assigned,
      correct,
      incorrect,
      coverage: ratio(assigned, present),
      assignedAccuracy: ratio(correct, assigned),
      endToEndAccuracy: ratio(correct, present),
      ambiguityRate: ratio(present - assigned, present),
      missingRate: ratio(total - present, total),
    },
    methods,
    perCategory: [...perCategory.values()].sort((a, b) => a.categoryId.localeCompare(b.categoryId)).map((item) => ({ ...item, coverage: ratio(item.assigned, item.present), assignedAccuracy: ratio(item.correct, item.assigned) })),
    mismatches,
    ambiguous,
    missing,
    taxonomy: {
      categories,
      usage: categoryUsage(graph, taxonomyIds),
      churn: taxonomyChurn(options.previousGraph, graph),
    },
    assignmentChurn: assignmentChurn(options.previousGraph, graph),
    runMetrics,
  };
}

function thresholdFailure(name, actual, operator, expected) {
  if (actual == null) return `${name} unavailable`;
  if (operator === "min" && actual < expected) return `${name} ${actual} < minimum ${expected}`;
  if (operator === "max" && actual > expected) return `${name} ${actual} > maximum ${expected}`;
  return null;
}

export function evaluateSemanticThresholds(report, thresholds = {}) {
  const failures = [];
  const checks = [
    ["assignedAccuracy", report.summary.assignedAccuracy, "min", thresholds.minAssignedAccuracy],
    ["endToEndAccuracy", report.summary.endToEndAccuracy, "min", thresholds.minEndToEndAccuracy],
    ["coverage", report.summary.coverage, "min", thresholds.minCoverage],
    ["ambiguityRate", report.summary.ambiguityRate, "max", thresholds.maxAmbiguityRate],
    ["missingRate", report.summary.missingRate, "max", thresholds.maxMissingRate],
    ["taxonomyChurnRate", report.taxonomy.churn?.churnRate ?? null, "max", thresholds.maxTaxonomyChurnRate],
    ["assignmentChurnRate", report.assignmentChurn?.churnRate ?? null, "max", thresholds.maxAssignmentChurnRate],
    ["largestCategoryShare", report.taxonomy.usage.largestCategoryShare, "max", thresholds.maxLargestCategoryShare],
    ["adjudicatorCalls", report.runMetrics?.adjudication?.calls ?? null, "max", thresholds.maxAdjudicatorCalls],
  ];
  for (const [name, actual, operator, expected] of checks) {
    if (expected == null) continue;
    if (typeof expected !== "number" || !Number.isFinite(expected)) throw new Error(`Invalid threshold ${name}`);
    const failure = thresholdFailure(name, actual, operator, expected);
    if (failure) failures.push(failure);
  }
  return { passed: failures.length === 0, failures };
}
