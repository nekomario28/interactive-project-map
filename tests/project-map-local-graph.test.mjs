import test from "node:test";
import assert from "node:assert/strict";

import { ProjectMapViewModel } from "../packages/project-map-view-model/src/index.js";
import { ProjectMapLocalGraph } from "../packages/project-map-view-model/src/local-graph.js";
import { projectMapViewModelRuntimeSource } from "../scripts/project-map-view-model-runtime.mjs";

function fixture() {
  return {
    owner: "example",
    generatedAt: "2026-08-26T00:00:00Z",
    nodes: [
      { id: "user:example", label: "example", type: "owner" },
      { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 3 },
      { id: "group:web", label: "Web", type: "group", repositoryCount: 1 },
      { id: "repository:alpha", label: "alpha", type: "repository", url: "https://github.com/example/alpha", groupId: "robotics", groupLabel: "Robotics" },
      { id: "repository:beta", label: "beta", type: "repository", url: "https://github.com/example/beta", groupId: "robotics", groupLabel: "Robotics", fork: true },
      { id: "repository:gamma", label: "gamma", type: "repository", url: "https://github.com/example/gamma", groupId: "robotics", groupLabel: "Robotics", archived: true },
      { id: "repository:delta", label: "delta", type: "repository", url: "https://github.com/example/delta", groupId: "web", groupLabel: "Web" },
    ],
    edges: [
      { source: "user:example", target: "group:robotics", type: "ownership" },
      { source: "user:example", target: "group:web", type: "ownership" },
      { source: "group:robotics", target: "repository:alpha", type: "membership" },
      { source: "group:robotics", target: "repository:beta", type: "membership" },
      { source: "group:robotics", target: "repository:gamma", type: "membership" },
      { source: "group:web", target: "repository:delta", type: "membership" },
    ],
    semanticEdges: [
      { source: "repository:alpha", target: "repository:beta", type: "semantic", score: 0.95 },
      { source: "repository:beta", target: "repository:gamma", type: "semantic", score: 0.9 },
    ],
  };
}

function ids(graph, type) {
  return graph.nodes.filter((node) => node.type === type).map((node) => node.id).sort();
}

test("Local Graph depth counts repository relations only and restores owner/category context", () => {
  const graph = ProjectMapViewModel.sanitizeGraph(fixture(), "example");
  const depth1 = ProjectMapLocalGraph.project(graph, "repository:alpha", 1, ["original", "fork", "archived"]);
  const depth2 = ProjectMapLocalGraph.project(graph, "repository:alpha", 2, ["original", "fork", "archived"]);

  assert.deepEqual(ids(depth1, "repository"), ["repository:alpha", "repository:beta"]);
  assert.deepEqual(ids(depth1, "group"), ["group:robotics"]);
  assert.deepEqual(ids(depth1, "owner"), ["user:example"]);
  assert.equal(depth1.nodes.some((node) => node.id === "repository:delta"), false);
  assert.equal(depth1.edges.some((edge) => edge.target === "repository:delta"), false);
  assert.deepEqual(ids(depth2, "repository"), ["repository:alpha", "repository:beta", "repository:gamma"]);
  assert.equal(depth2.semanticEdges.length, 2);
});

test("Local Graph applies status visibility before relation traversal", () => {
  const graph = ProjectMapViewModel.sanitizeGraph(fixture(), "example");
  const projected = ProjectMapLocalGraph.project(graph, "repository:alpha", 3, ["original", "fork"]);

  assert.deepEqual(ids(projected, "repository"), ["repository:alpha", "repository:beta"]);
  assert.equal(projected.nodes.some((node) => node.id === "repository:gamma"), false);
  assert.equal(projected.semanticEdges.length, 1);
  assert.equal(ProjectMapLocalGraph.project(graph, "repository:gamma", 1, ["original", "fork"]), null);
});

test("Local Graph clamps depth and no-focus mode is the same structural status projection", () => {
  const graph = ProjectMapViewModel.sanitizeGraph(fixture(), "example");
  const noFocus = ProjectMapLocalGraph.project(graph, "", 99, ["original", "fork"]);
  const statusOnly = ProjectMapViewModel.projectByStatuses(graph, ["original", "fork"]);
  const clamped = ProjectMapLocalGraph.project(graph, "repository:alpha", 99, ["original", "fork", "archived"]);

  assert.deepEqual(noFocus.nodes.map((node) => node.id), statusOnly.nodes.map((node) => node.id));
  assert.equal(ProjectMapLocalGraph.normalizeDepth(99), 3);
  assert.equal(ProjectMapLocalGraph.normalizeDepth(0), 1);
  assert.deepEqual(ids(clamped, "repository"), ["repository:alpha", "repository:beta", "repository:gamma"]);
});

test("generated browser view model exposes the same Local Graph factory", () => {
  const runtime = projectMapViewModelRuntimeSource();
  assert.match(runtime, /projectLocalGraph: localGraph\.project/);
  assert.match(runtime, /relationEdges/);
  assert.match(runtime, /projectByStatuses: base\.projectByStatuses/);
});
