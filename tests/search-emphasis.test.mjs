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

test("builder emits search emphasis and postprocess attaches it after shared search semantics for every dedicated viewer", () => {
  assert.match(builder, /public-search-emphasis\.js/);
  assert.match(builder, /search-emphasis\.js/);
  assert.doesNotMatch(postprocess, /public-search-emphasis\.js/);
  assert.match(postprocess, /search-emphasis\.js/);
  assert.match(postprocess, /SEARCH_EMPHASIS_SCRIPT/);
  assert.match(postprocess, /POLISH_SCRIPT.*SEARCH_EMPHASIS_SCRIPT/s);
  for (const style of ["radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"]) {
    assert.match(postprocess, new RegExp(`\\[\\"${style}\\"`));
  }
});
