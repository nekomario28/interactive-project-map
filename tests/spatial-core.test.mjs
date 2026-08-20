import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FORCE_SETTINGS,
  TAU,
  clamp,
  deterministicScatter,
  hashText,
  linkForceEdges,
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

test("force core settles a generic graph and respects a dragged node", () => {
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
