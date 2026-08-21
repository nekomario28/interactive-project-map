import { evaluateTaxonomyPartition } from "./taxonomy-partition-evaluation.mjs";

const FIXTURES = Object.freeze([
  { repositories: 80, categories: 4, localsPerCategory: 2 },
  { repositories: 150, categories: 5, localsPerCategory: 3 },
  { repositories: 300, categories: 6, localsPerCategory: 5 },
]);
const PROFILES = Object.freeze(["clear", "blurred"]);
const DEFAULT_THRESHOLD = 0.82;

function hash32(text) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function noise(text) {
  return (hash32(text) % 10_000) / 10_000;
}

function rounded(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function quantile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[index];
}

function repoId(category, local, index) {
  return `repository:c${category}-l${local}-r${String(index).padStart(2, "0")}`;
}

function pairKey(a, b) {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

function addEdge(edges, seen, source, target, weight, kind) {
  if (source === target) return;
  const key = pairKey(source, target);
  if (seen.has(key)) return;
  seen.add(key);
  const [a, b] = source < target ? [source, target] : [target, source];
  edges.push({ source: a, target: b, type: "semantic", weight: rounded(weight), syntheticKind: kind });
}

export function buildLargePortfolioFixture(config, profile = "clear") {
  if (!PROFILES.includes(profile)) throw new Error(`Unknown profile: ${profile}`);
  const perCategory = config.repositories / config.categories;
  const perLocal = perCategory / config.localsPerCategory;
  if (!Number.isInteger(perCategory) || !Number.isInteger(perLocal)) throw new Error("Fixture dimensions must divide evenly");

  const nodes = [];
  const semanticEdges = [];
  const seen = new Set();
  for (let category = 0; category < config.categories; category += 1) {
    for (let local = 0; local < config.localsPerCategory; local += 1) {
      for (let index = 0; index < perLocal; index += 1) {
        const id = repoId(category, local, index);
        nodes.push({
          id,
          label: id.slice("repository:".length),
          type: "repository",
          groupId: `standard-${category}`,
          groupLabel: `Standard ${category}`,
          taxonomyAssignment: { categoryId: `standard-${category}`, label: `Standard ${category}` },
          latentLocalCluster: `local-${category}-${local}`,
        });
      }

      // Three local offsets create redundant triangles so one changed edge does not
      // automatically disconnect a planted local community.
      for (let index = 0; index < perLocal; index += 1) {
        for (const offset of [1, 2, 3]) {
          const source = repoId(category, local, index);
          const target = repoId(category, local, (index + offset) % perLocal);
          const n = noise(`${profile}:${source}:${target}:within`);
          const weight = profile === "clear" ? 0.88 + n * 0.11 : 0.74 + n * 0.2;
          addEdge(semanticEdges, seen, source, target, weight, "within-local");
        }
      }
    }

    // Cross-local semantic similarity exists, but is intentionally weaker than
    // planted local structure. The blurred profile deliberately overlaps the
    // threshold to test whether clustering becomes brittle.
    for (let local = 0; local < config.localsPerCategory; local += 1) {
      const nextLocal = (local + 1) % config.localsPerCategory;
      for (let index = 0; index < perLocal; index += 2) {
        const source = repoId(category, local, index);
        const target = repoId(category, nextLocal, (index + category + 1) % perLocal);
        const n = noise(`${profile}:${source}:${target}:cross-local`);
        const weight = profile === "clear" ? 0.52 + n * 0.22 : 0.68 + n * 0.18;
        addEdge(semanticEdges, seen, source, target, weight, "cross-local");
      }
    }
  }

  // Sparse cross-category relations model shared technologies/projects. Local
  // clustering never uses them, but Local Graph focus does, matching the viewer.
  for (let category = 0; category < config.categories; category += 1) {
    const nextCategory = (category + 1) % config.categories;
    for (let local = 0; local < config.localsPerCategory; local += 1) {
      const source = repoId(category, local, 0);
      const target = repoId(nextCategory, local % config.localsPerCategory, 0);
      addEdge(semanticEdges, seen, source, target, 0.44 + noise(`${source}:${target}:cross-category`) * 0.16, "cross-category");
    }
  }

  return {
    owner: "synthetic",
    generatedAt: "2026-08-22T00:00:00Z",
    repositoryCount: nodes.length,
    nodes,
    edges: [],
    semanticEdges,
    synthetic: { ...config, profile, perCategory, perLocal },
  };
}

function repositoryMap(graph) {
  return new Map(graph.nodes.filter((node) => node?.type === "repository").map((node) => [node.id, node]));
}

function highAdjacency(graph, threshold) {
  const repos = repositoryMap(graph);
  const adjacency = new Map([...repos.keys()].map((id) => [id, new Set()]));
  for (const edge of graph.semanticEdges || []) {
    if (Number(edge.weight) < threshold) continue;
    const source = repos.get(edge.source);
    const target = repos.get(edge.target);
    if (!source || !target) continue;
    if (source.taxonomyAssignment?.categoryId !== target.taxonomyAssignment?.categoryId) continue;
    adjacency.get(edge.source).add(edge.target);
    adjacency.get(edge.target).add(edge.source);
  }
  return adjacency;
}

function connectedAssignments(graph, threshold, requireTriangle) {
  const repos = repositoryMap(graph);
  const adjacency = highAdjacency(graph, threshold);
  const retained = new Map([...adjacency.keys()].map((id) => [id, new Set()]));

  for (const [source, neighbors] of adjacency) {
    for (const target of neighbors) {
      if (source > target) continue;
      if (requireTriangle) {
        const targetNeighbors = adjacency.get(target) || new Set();
        let supported = false;
        for (const candidate of neighbors) {
          if (candidate !== target && targetNeighbors.has(candidate)) {
            supported = true;
            break;
          }
        }
        if (!supported) continue;
      }
      retained.get(source).add(target);
      retained.get(target).add(source);
    }
  }

  const assignments = {};
  const byCategory = new Map();
  for (const node of repos.values()) {
    const category = node.taxonomyAssignment?.categoryId || "uncategorized";
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(node.id);
  }

  for (const [category, ids] of [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const unvisited = new Set(ids.sort());
    let ordinal = 0;
    while (unvisited.size) {
      const root = [...unvisited][0];
      const queue = [root];
      const members = [];
      unvisited.delete(root);
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const current = queue[cursor];
        members.push(current);
        for (const neighbor of [...(retained.get(current) || [])].sort()) {
          if (!unvisited.has(neighbor)) continue;
          unvisited.delete(neighbor);
          queue.push(neighbor);
        }
      }
      const clusterId = `cluster-${category}-${String(ordinal).padStart(2, "0")}`;
      for (const id of members) assignments[id] = clusterId;
      ordinal += 1;
    }
  }
  return assignments;
}

export function thresholdComponents(graph, threshold = DEFAULT_THRESHOLD) {
  return connectedAssignments(graph, threshold, false);
}

export function triangleSupportedComponents(graph, threshold = DEFAULT_THRESHOLD) {
  return connectedAssignments(graph, threshold, true);
}

function expectedFixture(graph, categoryForNode) {
  const repositories = {};
  for (const node of graph.nodes.filter((value) => value?.type === "repository")) {
    repositories[node.label] = { categoryId: categoryForNode(node) };
  }
  return { version: 1, taxonomyId: "synthetic-local-clusters", repositories };
}

function graphWithAssignments(graph, assignments) {
  return {
    nodes: graph.nodes.map((node) => node?.type !== "repository" ? node : {
      ...node,
      taxonomyAssignment: { categoryId: assignments[node.id], label: assignments[node.id] },
    }),
  };
}

function partitionAgainstTruth(graph, assignments) {
  return evaluateTaxonomyPartition(
    graphWithAssignments(graph, assignments),
    expectedFixture(graph, (node) => node.latentLocalCluster),
  );
}

function compareAssignments(graph, reference, actual) {
  return evaluateTaxonomyPartition(
    graphWithAssignments(graph, actual),
    expectedFixture(graph, (node) => reference[node.id]),
  );
}

function clusterSizes(assignments) {
  const sizes = new Map();
  for (const cluster of Object.values(assignments)) sizes.set(cluster, (sizes.get(cluster) || 0) + 1);
  return [...sizes.values()].sort((a, b) => a - b);
}

function categorySizes(graph) {
  const sizes = new Map();
  for (const node of graph.nodes.filter((value) => value?.type === "repository")) {
    const category = node.taxonomyAssignment?.categoryId || "uncategorized";
    sizes.set(category, (sizes.get(category) || 0) + 1);
  }
  return [...sizes.values()];
}

function fullRelationAdjacency(graph) {
  const ids = new Set(graph.nodes.filter((node) => node?.type === "repository").map((node) => node.id));
  const adjacency = new Map([...ids].map((id) => [id, new Set()]));
  for (const edge of graph.semanticEdges || []) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
    adjacency.get(edge.source).add(edge.target);
    adjacency.get(edge.target).add(edge.source);
  }
  return adjacency;
}

export function localGraphScopeStats(graph, depth) {
  const adjacency = fullRelationAdjacency(graph);
  const counts = [];
  for (const root of [...adjacency.keys()].sort()) {
    const seen = new Set([root]);
    const queue = [{ id: root, depth: 0 }];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      if (current.depth >= depth) continue;
      for (const neighbor of adjacency.get(current.id) || []) {
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        queue.push({ id: neighbor, depth: current.depth + 1 });
      }
    }
    counts.push(seen.size);
  }
  return {
    mean: rounded(counts.reduce((sum, value) => sum + value, 0) / counts.length),
    p50: quantile(counts, 0.5),
    p95: quantile(counts, 0.95),
    max: Math.max(...counts),
  };
}

export function perturbSemanticEdges(graph) {
  const semanticEdges = (graph.semanticEdges || []).filter((edge) => hash32(`${edge.source}:${edge.target}:remove`) % 50 !== 0);
  const seen = new Set(semanticEdges.map((edge) => pairKey(edge.source, edge.target)));
  const perLocal = graph.synthetic.perLocal;
  for (let category = 0; category < graph.synthetic.categories; category += 1) {
    for (let local = 0; local < graph.synthetic.localsPerCategory; local += 1) {
      // One high-weight accidental cross-local bridge per local community tests
      // whether a candidate collapses because of a single new semantic edge.
      const nextLocal = (local + 1) % graph.synthetic.localsPerCategory;
      const source = repoId(category, local, (category + local) % perLocal);
      const target = repoId(category, nextLocal, (category + local + 4) % perLocal);
      addEdge(semanticEdges, seen, source, target, 0.91, "perturb-high-bridge");
    }
  }
  return { ...graph, semanticEdges };
}

function evaluateCandidate(graph, name, detector) {
  const assignments = detector(graph);
  const sizes = clusterSizes(assignments);
  const truth = partitionAgainstTruth(graph, assignments);
  const reordered = { ...graph, nodes: [...graph.nodes].reverse(), semanticEdges: [...graph.semanticEdges].reverse() };
  const reorderedAssignments = detector(reordered);
  const order = compareAssignments(graph, assignments, reorderedAssignments);
  const perturbed = perturbSemanticEdges(graph);
  const changedAssignments = detector(perturbed);
  const churn = compareAssignments(graph, assignments, changedAssignments);
  return {
    name,
    clusters: sizes.length,
    minClusterSize: Math.min(...sizes),
    medianClusterSize: quantile(sizes, 0.5),
    maxClusterSize: Math.max(...sizes),
    singletonRate: rounded(sizes.filter((size) => size === 1).length / sizes.length),
    oversizedRate: rounded(sizes.filter((size) => size > 20).length / sizes.length),
    truth: {
      pairwiseF1: truth.partition.pairwiseF1,
      adjustedRandIndex: truth.partition.adjustedRandIndex,
      purity: truth.partition.purity,
    },
    orderAdjustedRandIndex: order.partition.adjustedRandIndex,
    churnAdjustedRandIndex: churn.partition.adjustedRandIndex,
  };
}

export function evaluateLocalClusters(graph) {
  const categories = categorySizes(graph);
  const focusDepth1 = localGraphScopeStats(graph, 1);
  const focusDepth2 = localGraphScopeStats(graph, 2);
  const candidates = [
    evaluateCandidate(graph, "threshold-components", (value) => thresholdComponents(value)),
    evaluateCandidate(graph, "triangle-components", (value) => triangleSupportedComponents(value)),
  ];
  for (const candidate of candidates) {
    candidate.maxGroupReduction = rounded(1 - candidate.maxClusterSize / Math.max(...categories));
    candidate.smallerThanDepth2P95 = candidate.maxClusterSize < focusDepth2.p95;
  }
  return {
    repositories: graph.repositoryCount,
    profile: graph.synthetic.profile,
    baseline: {
      categories: categories.length,
      maxCategorySize: Math.max(...categories),
      focusDepth1,
      focusDepth2,
    },
    candidates,
  };
}

export function runLocalClusterEvaluation() {
  const scenarios = [];
  for (const fixture of FIXTURES) {
    for (const profile of PROFILES) scenarios.push(evaluateLocalClusters(buildLargePortfolioFixture(fixture, profile)));
  }
  const promotionGate = {
    minTruthAri: 0.85,
    minChurnAri: 0.9,
    minOrderAri: 1,
    maxSingletonRate: 0.05,
    requireBeyondDepth2: true,
  };
  const candidateNames = scenarios[0].candidates.map((candidate) => candidate.name);
  const decisions = candidateNames.map((name) => {
    const rows = scenarios.map((scenario) => ({ scenario, candidate: scenario.candidates.find((value) => value.name === name) }));
    const failures = [];
    for (const { scenario, candidate } of rows) {
      const prefix = `${scenario.repositories}/${scenario.profile}`;
      if ((candidate.truth.adjustedRandIndex ?? -1) < promotionGate.minTruthAri) failures.push(`${prefix}: truth ARI ${candidate.truth.adjustedRandIndex}`);
      if ((candidate.churnAdjustedRandIndex ?? -1) < promotionGate.minChurnAri) failures.push(`${prefix}: churn ARI ${candidate.churnAdjustedRandIndex}`);
      if ((candidate.orderAdjustedRandIndex ?? -1) < promotionGate.minOrderAri) failures.push(`${prefix}: order ARI ${candidate.orderAdjustedRandIndex}`);
      if (candidate.singletonRate > promotionGate.maxSingletonRate) failures.push(`${prefix}: singleton rate ${candidate.singletonRate}`);
      if (promotionGate.requireBeyondDepth2 && !candidate.smallerThanDepth2P95) failures.push(`${prefix}: no scope reduction beyond depth-2 Local Graph`);
    }
    return { name, passedPhase1: failures.length === 0, failures };
  });
  return { version: 1, threshold: DEFAULT_THRESHOLD, promotionGate, scenarios, decisions };
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  process.stdout.write(`${JSON.stringify(runLocalClusterEvaluation(), null, 2)}\n`);
}
