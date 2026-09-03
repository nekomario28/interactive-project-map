import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [builder, postprocess, canonical] = await Promise.all([
  readFile(new URL("../scripts/build-public-pages.mjs", import.meta.url), "utf8"),
  readFile(new URL("../scripts/postprocess-public-pages.mjs", import.meta.url), "utf8"),
  readFile(new URL("../scripts/public-spatial-core-runtime.mjs", import.meta.url), "utf8"),
]);

test("canonical builder owns Spatial Core runtime emission", () => {
  assert.match(canonical, /export function spatialCoreRuntimeSource/);
  assert.match(builder, /spatial-core-runtime\.js/);
  assert.match(builder, /spatialCoreRuntimeSource\(\)/);
  assert.doesNotMatch(postprocess, /emitSpatialCoreRuntime|spatialCoreRuntimeSource/);
  assert.doesNotMatch(postprocess, /packages\/spatial-core|DEFAULT_FORCE_SETTINGS|normalizeWeightedEdges|linkForceEdges|stepForceLayout/);
});
