import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import {
  DEFAULT_FORCE_SETTINGS,
  linkForceEdges,
  normalizeWeightedEdges,
  stepForceLayout,
} from "../packages/spatial-core/src/index.js";
import {
  spatialCoreRuntimeSource,
  tuneInteractionPolish,
  tuneObsidianRuntime,
} from "../scripts/postprocess-public-pages.mjs";

test("generated classic Spatial Core runtime delegates to the canonical package primitives", () => {
  const sandbox = { window: {} };
  vm.runInNewContext(spatialCoreRuntimeSource(), sandbox);
  const browserCore = sandbox.window.ProjectMapSpatialCore;

  assert.ok(browserCore);
  assert.equal(browserCore.DEFAULT_FORCE_SETTINGS.linkDistance, DEFAULT_FORCE_SETTINGS.linkDistance);
  assert.equal(browserCore.DEFAULT_FORCE_SETTINGS.repel, DEFAULT_FORCE_SETTINGS.repel);

  const raw = [
    { source: "a", target: "b", score: 0.72 },
    { source: "b", target: "a", score: 0.91 },
    { source: "a", target: "c", score: 0.84 },
    { source: "a", target: "missing", score: 0.99 },
  ];
  const ids = new Set(["a", "b", "c"]);
  const options = { type: "semantic", maxInput: 2400, maxOutput: 1200, minScore: 0 };
  assert.deepEqual(
    JSON.parse(JSON.stringify(browserCore.normalizeWeightedEdges(raw, ids, options))),
    normalizeWeightedEdges(raw, ids, options),
  );

  const browserNodes = [
    { id: "a", x: -30, y: 0, vx: 0, vy: 0 },
    { id: "b", x: 30, y: 0, vx: 0, vy: 0 },
  ];
  const canonicalNodes = browserNodes.map((node) => ({ ...node }));
  const rawEdges = [{ source: "a", target: "b" }];
  const browserEdges = browserCore.linkForceEdges(rawEdges, browserNodes);
  const canonicalEdges = linkForceEdges(rawEdges, canonicalNodes);
  const radius = () => 8;
  browserCore.stepForceLayout(browserNodes, browserEdges, 0.6, { settings: browserCore.DEFAULT_FORCE_SETTINGS, radius });
  stepForceLayout(canonicalNodes, canonicalEdges, 0.6, { settings: DEFAULT_FORCE_SETTINGS, radius });
  assert.deepEqual(
    browserNodes.map(({ x, y, vx, vy }) => ({ x, y, vx, vy })),
    canonicalNodes.map(({ x, y, vx, vy }) => ({ x, y, vx, vy })),
  );
});

test("Pages emission removes duplicated semantic and Obsidian force kernels", async () => {
  const [obsidianSource, polishSource] = await Promise.all([
    readFile(new URL("../scripts/public-obsidian-runtime.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/public-interaction-polish.js", import.meta.url), "utf8"),
  ]);

  const obsidian = tuneObsidianRuntime(obsidianSource);
  assert.match(obsidian, /ProjectMapSpatialCore\.DEFAULT_FORCE_SETTINGS/);
  assert.match(obsidian, /ProjectMapSpatialCore\.linkForceEdges/);
  assert.match(obsidian, /ProjectMapSpatialCore\.stepForceLayout/);
  assert.doesNotMatch(obsidian, /for \(let first = 0; first < nodes\.length; first \+= 1\)/);

  const polish = tuneInteractionPolish(polishSource);
  assert.match(polish, /ProjectMapSpatialCore/);
  assert.match(polish, /normalizeWeightedEdges/);
  assert.doesNotMatch(polish, /const deduped = new Map\(\)/);
  assert.match(polish, /maxInput: 2400/);
  assert.match(polish, /maxOutput: 1200/);
});
