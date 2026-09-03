import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import vm from "node:vm";
import {
  DEFAULT_FORCE_SETTINGS,
  linkForceEdges,
  normalizeWeightedEdges,
  stepForceLayout,
} from "../packages/spatial-core/src/index.js";
import { buildPublicPages } from "../scripts/build-public-pages.mjs";
import { postprocessPublicPages } from "../scripts/postprocess-public-pages.mjs";
import { spatialCoreRuntimeSource } from "../scripts/public-spatial-core-runtime.mjs";

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

test("public builder owns Spatial Core runtime emission and postprocess keeps it byte-identical", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-spatial-core-owner-"));
  try {
    await buildPublicPages(root);
    const runtimePath = join(root, "spatial-core-runtime.js");
    const built = await readFile(runtimePath, "utf8");
    assert.equal(built, spatialCoreRuntimeSource());

    await postprocessPublicPages(root);
    const postprocessed = await readFile(runtimePath, "utf8");
    assert.equal(postprocessed, built);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("canonical Obsidian and interaction runtimes avoid duplicated Spatial Core kernels", async () => {
  const [obsidianSource, polishSource, postprocessSource] = await Promise.all([
    readFile(new URL("../scripts/public-obsidian-runtime.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/public-interaction-polish.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/postprocess-public-pages.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(obsidianSource, /ProjectMapSpatialCore\.DEFAULT_FORCE_SETTINGS/);
  assert.match(obsidianSource, /ProjectMapSpatialCore\.linkForceEdges/);
  assert.match(obsidianSource, /ProjectMapSpatialCore\.stepForceLayout/);
  assert.doesNotMatch(obsidianSource, /for \(let first = 0; first < nodes\.length; first \+= 1\)/);
  assert.doesNotMatch(postprocessSource, /tuneObsidianRuntime/);
  assert.match(postprocessSource, /copyFile\(join\(sourceDir, "public-obsidian-runtime\.js"\), join\(outputDir, "obsidian-runtime\.js"\)\)/);

  assert.match(polishSource, /ProjectMapSpatialCore/);
  assert.match(polishSource, /normalizeWeightedEdges/);
  assert.match(polishSource, /semanticCandidates/);
  assert.doesNotMatch(polishSource, /const deduped = new Map\(\)/);
  assert.match(polishSource, /maxInput: 2400/);
  assert.match(polishSource, /maxOutput: 1200/);
  assert.doesNotMatch(postprocessSource, /tuneInteractionPolish/);
  assert.match(postprocessSource, /copyFile\(sourcePath, join\(outputDir, "interaction-polish\.js"\)\)/);

  assert.doesNotMatch(postprocessSource, /emitSpatialCoreRuntime|spatialCoreRuntimeSource/);
  assert.doesNotMatch(postprocessSource, /DEFAULT_FORCE_SETTINGS|normalizeWeightedEdges|linkForceEdges|stepForceLayout/);
});
