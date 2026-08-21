import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adaptivePath = new URL("../scripts/public-adaptive-labels.js", import.meta.url);
const postprocessPath = new URL("../scripts/postprocess-public-pages.mjs", import.meta.url);

test("adaptive label runtime is text-only and bounded to Systems/Hybrid", async () => {
  const source = await readFile(adaptivePath, "utf8");
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /galaxy-systems/);
  assert.match(source, /galaxy-hybrid/);
  assert.match(source, /ctx\.measureText/);
  assert.match(source, /bottom/);
  assert.match(source, /right/);
  assert.match(source, /top/);
  assert.match(source, /left/);
  assert.match(source, /baseDrawNodesAndLabels\(colors\)/);
  assert.match(source, /ctx\.fillText = \(\) => \{\}/);
  assert.match(source, /ctx\.strokeText = \(\) => \{\}/);

  // The runtime may read node geometry to place text, but must never mutate layout/view state.
  assert.doesNotMatch(source, /node\.x\s*=/);
  assert.doesNotMatch(source, /node\.y\s*=/);
  assert.doesNotMatch(source, /node\.vx\s*=/);
  assert.doesNotMatch(source, /node\.vy\s*=/);
  assert.doesNotMatch(source, /state\.pan\.[xy]\s*=/);
  assert.doesNotMatch(source, /state\.zoom\s*=/);
});

test("generated Galaxy page always emits adaptive labels after interaction polish", async () => {
  const source = await readFile(postprocessPath, "utf8");
  assert.match(source, /public-adaptive-labels\.js/);
  assert.match(source, /adaptive-labels\.js/);
  assert.match(source, /POLISH_SCRIPT, ADAPTIVE_LABELS_SCRIPT/);
  assert.match(source, /next\.includes\(ADAPTIVE_LABELS_SCRIPT\)/);
});
