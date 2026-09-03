import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const emphasisPath = new URL("../scripts/public-search-emphasis.js", import.meta.url);
const builderPath = new URL("../scripts/build-public-pages.mjs", import.meta.url);
const postprocessPath = new URL("../scripts/postprocess-public-pages.mjs", import.meta.url);

const emphasis = await readFile(emphasisPath, "utf8");
const builder = await readFile(builderPath, "utf8");
const postprocess = await readFile(postprocessPath, "utf8");

test("dedicated search emphasis keeps one shared visual contract", () => {
  assert.match(emphasis, /ProjectMapSearchVisualEmphasis/);
  assert.match(emphasis, /searchAwareAggregateRepoMatches/);
  assert.match(emphasis, /aggregateAwareUpdateDetails/);
  assert.match(emphasis, /searchEmphasisDraw/);
  assert.match(emphasis, /drawMatrixTargets/);
  assert.match(emphasis, /drawSankeyTargets/);
  assert.match(emphasis, /directRepositoryIds/);
  assert.doesNotThrow(() => new Function(emphasis));
});

test("builder owns dedicated Spatial Core → polish → search-emphasis script ordering", () => {
  assert.match(builder, /public-search-emphasis\.js/);
  assert.match(builder, /const DEDICATED_SCRIPT_TAIL = Object\.freeze\(\[[\s\S]*"spatial-core-runtime\.js",[\s\S]*"interaction-polish\.js",[\s\S]*"search-emphasis\.js"/);
  assert.doesNotMatch(postprocess, /public-search-emphasis\.js|search-emphasis\.js|interaction-polish\.js|spatial-core-runtime\.js/);
});
