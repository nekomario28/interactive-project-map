import assert from "node:assert/strict";
import test from "node:test";

import { createRendererSnapshot } from "../packages/project-map-view-model/src/renderer-snapshot.js";
import { patchThreeDRendererSnapshot, patchTwoDRendererSnapshot } from "../scripts/apply-renderer-snapshot.mjs";

test("renderer snapshot normalizes a stable evidence shape", () => {
  const snapshot = createRendererSnapshot({
    rendererId: "threejs",
    styleId: "aurora",
    experimental: true,
    semantic: { repositories: 12.9, groups: 3.8 },
    selectedId: "repository:demo",
    capabilities: { selection: 1, search: true, "bad key": true, motion: false },
    viewport: { width: 800, height: 600 },
    backingStore: { width: 1160, height: 870 },
  });

  assert.deepEqual(snapshot, {
    version: 1,
    rendererId: "threejs",
    styleId: "aurora",
    experimental: true,
    semantic: { repositories: 12, groups: 3 },
    selectedId: "repository:demo",
    capabilities: { motion: false, search: true, selection: false },
    viewport: { width: 800, height: 600 },
    backingStore: { width: 1160, height: 870, pixelRatio: 1.45 },
  });
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.capabilities));
  assert.ok(Object.isFrozen(snapshot.backingStore));
});

test("renderer snapshot fails closed without a renderer id and bounds malformed metrics", () => {
  assert.throws(() => createRendererSnapshot({}), /rendererId is required/);
  const snapshot = createRendererSnapshot({
    rendererId: " canvas2d ",
    semantic: { repositories: -2, groups: Number.NaN },
    viewport: { width: -1, height: "bad" },
    backingStore: { width: Infinity, height: -4 },
  });
  assert.equal(snapshot.rendererId, "canvas2d");
  assert.deepEqual(snapshot.semantic, { repositories: 0, groups: 0 });
  assert.deepEqual(snapshot.viewport, { width: 0, height: 0 });
  assert.deepEqual(snapshot.backingStore, { width: 0, height: 0, pixelRatio: 0 });
});

test("renderer adapters patch exactly once and fail closed when their insertion point drifts", () => {
  const twoD = "before\n  }\n\n  window.ProjectMapViewState = Object.freeze({ motionOff, snapshot: () => ({ motionOff: motionOff() }) });after";
  const patchedTwoD = patchTwoDRendererSnapshot(twoD);
  assert.match(patchedTwoD, /IPM_COMMON_RENDERER_SNAPSHOT_2D_V1/);
  assert.match(patchedTwoD, /window\.ProjectMapRenderer/);
  assert.equal(patchTwoDRendererSnapshot(patchedTwoD), patchedTwoD);
  assert.throws(() => patchTwoDRendererSnapshot("drift"), /2D view-state adapter insertion point/);

  const initial = 'rebuildEdges();applyVisibility();fitScene(true);resize();ui.motion.setAttribute("aria-pressed",String(motionEnabled));ui.motion.textContent=motionEnabled?"Motion On":"Motion Off";animationFrame=requestAnimationFrame(animate);';
  const patchedThreeD = patchThreeDRendererSnapshot(initial);
  assert.match(patchedThreeD, /IPM_COMMON_RENDERER_SNAPSHOT_3D_V1/);
  assert.match(patchedThreeD, /rendererId:"threejs"/);
  assert.equal(patchThreeDRendererSnapshot(patchedThreeD), patchedThreeD);
  assert.throws(() => patchThreeDRendererSnapshot("drift"), /Three\.js renderer snapshot insertion point/);
});
