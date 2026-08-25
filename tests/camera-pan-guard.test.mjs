import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cameraSourceUrl = new URL("../scripts/public-camera-coherence.js", import.meta.url);

test("camera coherence keeps base pan ownership behind an elastic scene guard", async () => {
  const source = await readFile(cameraSourceUrl, "utf8");
  assert.match(source, /PAN_GUARD_FRACTION = 0\.18/);
  assert.match(source, /PAN_OVERSCROLL_RESISTANCE = 0\.2/);
  assert.match(source, /function sceneBounds\(\)/);
  assert.match(source, /function panBounds\(zoom = state\.zoom\)/);
  assert.match(source, /function constrainPan\(\{ elastic = false, redraw = true \} = \{\}\)/);
  assert.match(source, /resistedPanValue/);
  assert.match(source, /pointerCount === 1 && state\.panning/);
  assert.match(source, /queueMicrotask\(\(\) => constrainPan\(\{ elastic: true \}\)\)/);
  assert.match(source, /canvas\.addEventListener\("pointerup", handlePointerEndBounds/);
  assert.match(source, /canvas\.addEventListener\("pointercancel", handlePointerEndBounds/);
  assert.match(source, /canvas\.addEventListener\("lostpointercapture", handlePointerEndBounds/);
  assert.match(source, /panLimits: panBounds\(\)/);
  assert.match(source, /panBounds,/);
  assert.match(source, /constrainPan,/);
});
