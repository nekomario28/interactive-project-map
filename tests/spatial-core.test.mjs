import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FORCE_SETTINGS,
  TAU,
  adaptGalaxyGraph,
  adaptVisualBlockIr,
  clamp,
  createForceNodes,
  deterministicScatter,
  hashText,
  linkForceEdges,
  normalizeSpatialGraph,
  normalizeWeightedEdges,
  settleForceLayout,
  stepForceLayout,
  wrapAngle,
} from "../packages/spatial-core/src/index.js";

test("math helpers preserve the existing galaxy contracts", () => {
  assert.equal(TAU, Math.PI * 2);
  assert.equal(clamp(8, 0, 5), 5);
  assert.equal(hashText("interactive-project-map"), hashText("interactive-project-map"));
  assert.notEqual(hashText("interactive-project-map"), hashText("flowdeck"));
  assert.ok(Math.abs(wrapAngle(Math.PI * 3) - Math.PI) < 1e-12);
});

test("deterministicScatter is stable and bounded", () => {
  const first = deterministicScatter("repo:a", 3, 12);
  const second = deterministicScatter("repo:a", 3, 12);
  assert.deepEqual(first, second);
  assert.ok(Number.isFinite(first.x));
  assert.ok(Number.isFinite(first.y));
  assert.ok(Math.hypot(first.x, first.y) >= 42);
  assert.ok(Math.hypot(first.x, first.y) <= 307 + 1e-9);
});

test("normalizeWeightedEdges validates, deduplicates and sorts sparse relations", () => {
  const edges = normalizeWeightedEdges([
    { source: "a", target: "b", score: 0.75 },
    { source: "b", target: "a", score: 0.91 },
    { source: "a", target: "c", score: 0.82 },
    { source: "a", target: "missing", score: 0.99 },
    { source: "a", target: "a", score: 1 },
    { source: "b", target: "c", score: Number.NaN },
  ], new Set(["a", "b", "c"]), { type: "semantic", minScore: 0.8, maxOutput: 2 });

  assert.deepEqual(edges, [
    { source: "a", target: "b", type: "semantic", score: 0.91 },
    { source: "a", target: "c", type: "semantic", score: 0.82 },
  ]);
});

test("force core settles a generic graph, honors position hints and respects a dragged node", () => {
  const hinted = createForceNodes([{ id: "hinted", positionHint: { x: 17, y: -23 } }]);
  assert.deepEqual({ x: hinted[0].x, y: hinted[0].y }, { x: 17, y: -23 });

  const rawNodes = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const rawEdges = [{ source: "a", target: "b" }, { source: "b", target: "c" }];
  const settled = settleForceLayout(rawNodes, rawEdges, { steps: 8 });
  assert.equal(settled.length, 3);
  assert.ok(settled.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)));

  const nodes = settled.map((node) => ({ ...node, vx: 0, vy: 0 }));
  const edges = linkForceEdges(rawEdges, nodes);
  const dragged = nodes[0];
  const before = { x: dragged.x, y: dragged.y };
  assert.equal(stepForceLayout(nodes, edges, 0.5, { draggingId: dragged.id }), true);
  assert.deepEqual({ x: dragged.x, y: dragged.y }, before);
  assert.equal(DEFAULT_FORCE_SETTINGS.linkDistance, 138);
});

test("generic spatial graph keeps structural and relation edges separate", () => {
  const graph = normalizeSpatialGraph({
    nodes: [
      { id: "project:a", label: "A", kind: "project", status: "active", positionHint: { x: 12, y: -8 } },
      { id: "project:b", label: "B", kind: "project", parentId: "missing" },
      { id: "project:b", label: "duplicate" },
    ],
    structuralEdges: [
      { source: "project:a", target: "project:b", kind: "contains", directed: true },
      { source: "project:a", target: "missing", kind: "contains" },
    ],
    relationEdges: [
      { source: "project:b", target: "project:a", kind: "research", weight: 0.8 },
    ],
  });

  assert.equal(graph.version, 1);
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.nodes[0].status, "active");
  assert.deepEqual(graph.nodes[0].positionHint, { x: 12, y: -8 });
  assert.equal(graph.nodes[1].parentId, undefined);
  assert.equal(graph.structuralEdges.length, 1);
  assert.equal(graph.relationEdges.length, 1);
  assert.equal(graph.relationEdges[0].kind, "research");
});

test("GalaxyGraph adapter preserves hierarchy while exposing semantics as relations", () => {
  const spatial = adaptGalaxyGraph({
    nodes: [
      { id: "user:yuu", label: "yuu", type: "owner" },
      { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 1 },
      { id: "repository:dual", label: "dual", type: "repository", stars: 7, archived: false, fork: false },
      { id: "repository:real2sim", label: "real2sim", type: "repository", stars: 3, archived: false, fork: false },
    ],
    edges: [
      { source: "user:yuu", target: "group:robotics", type: "ownership" },
      { source: "group:robotics", target: "repository:dual", type: "membership" },
      { source: "group:robotics", target: "repository:real2sim", type: "membership" },
    ],
    semanticEdges: [
      { source: "repository:dual", target: "repository:real2sim", type: "semantic", score: 0.91 },
    ],
  });

  const dual = spatial.nodes.find((node) => node.id === "repository:dual");
  assert.equal(dual.parentId, "group:robotics");
  assert.equal(dual.status, "original");
  assert.ok(dual.weight > 1);
  assert.equal(spatial.structuralEdges.length, 3);
  assert.equal(spatial.relationEdges.length, 1);
  assert.equal(spatial.relationEdges[0].kind, "semantic");
  assert.equal(spatial.relationEdges[0].weight, 0.91);
});

test("Visual Block IR adapter namespaces repeated item ids and preserves relations", () => {
  const spatial = adaptVisualBlockIr({
    schemaVersion: 1,
    documentId: "incubator",
    title: "Project Incubator",
    themeRef: "semantic-galaxy-v1",
    sources: [{ id: "ideas", kind: "REGISTRY", locator: "registry/ideas.yaml", authority: "CANONICAL" }],
    blocks: [
      {
        id: "status",
        kind: "STATUS_GRID",
        title: "Research Status",
        items: [
          { id: "IDEA-001", label: "Flight Recorder", status: "EXPERIMENT_READY", value: 1, weight: 4 },
        ],
      },
      {
        id: "portfolio",
        kind: "RELATION_GRAPH",
        title: "Portfolio Systems",
        items: [
          { id: "IDEA-001", label: "Flight Recorder", status: "PILOT_DRAFT", group: "pilot", weight: 2 },
          { id: "repo:map", label: "interactive-project-map", status: "NATIVE_EXISTING", group: "native", href: "https://github.com/nekomario28/interactive-project-map" },
        ],
        edges: [
          { source: "IDEA-001", target: "repo:map", kind: "projects-to", weight: 0.9, directed: true },
        ],
      },
    ],
  });

  assert.equal(spatial.version, 1);
  assert.equal(spatial.nodes.length, 6);
  assert.equal(spatial.structuralEdges.length, 5);
  assert.equal(spatial.relationEdges.length, 1);

  const statusIdea = spatial.nodes.find((node) => node.id === "visual:status:IDEA-001");
  const portfolioIdea = spatial.nodes.find((node) => node.id === "visual:portfolio:IDEA-001");
  const repo = spatial.nodes.find((node) => node.id === "visual:portfolio:repo:map");

  assert.ok(statusIdea);
  assert.ok(portfolioIdea);
  assert.notEqual(statusIdea.id, portfolioIdea.id);
  assert.equal(statusIdea.parentId, "visual-block:status");
  assert.equal(statusIdea.status, "EXPERIMENT_READY");
  assert.equal(statusIdea.weight, 4);
  assert.equal(statusIdea.metadata.value, 1);
  assert.equal(portfolioIdea.parentId, "visual-block:portfolio");
  assert.equal(repo.metadata.href, "https://github.com/nekomario28/interactive-project-map");

  const relation = spatial.relationEdges[0];
  assert.equal(relation.source, "visual:portfolio:IDEA-001");
  assert.equal(relation.target, "visual:portfolio:repo:map");
  assert.equal(relation.kind, "projects-to");
  assert.equal(relation.weight, 0.9);
  assert.equal(relation.directed, true);
});
