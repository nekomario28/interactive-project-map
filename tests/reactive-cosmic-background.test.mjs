import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { applyReactiveCosmicBackground } from "../scripts/apply-reactive-cosmic-background.mjs";

const cosmicSourceUrl = new URL("../scripts/public-cosmic-background.js", import.meta.url);
const cameraSourceUrl = new URL("../scripts/public-camera-coherence.js", import.meta.url);

test("camera coherence normalizes input and derives shared scene-aware zoom bounds", async () => {
  const source = await readFile(cameraSourceUrl, "utf8");
  assert.match(source, /WheelEvent\.DOM_DELTA_LINE/);
  assert.match(source, /WheelEvent\.DOM_DELTA_PAGE/);
  assert.match(source, /MAX_WHEEL_PIXELS = 140/);
  assert.match(source, /sceneFitZoom/);
  assert.match(source, /fit \* 0\.46/);
  assert.match(source, /stopImmediatePropagation/);
  assert.match(source, /screenToWorld\(screenX, screenY\)/);
  assert.match(source, /worldToScreen\(before\.x, before\.y\)/);
  assert.match(source, /function enforceZoomBoundsAt/);
  assert.match(source, /queueMicrotask/);
  assert.match(source, /state\.pointers\?\.size !== 2/);
  assert.match(source, /canvas\.addEventListener\("keydown", handleKeyboard, \{ capture: true \}\)/);
  assert.match(source, /canvas\.addEventListener\("pointermove", handlePointerMoveBounds, \{ capture: true, passive: true \}\)/);
  assert.match(source, /ProjectMapCameraCoherence/);
});

test("reactive cosmic background composes camera deltas across depth while preserving world and screen-space layers", async () => {
  const source = await readFile(cosmicSourceUrl, "utf8");
  assert.match(source, /depth: 0\.08/);
  assert.match(source, /depth: 0\.18/);
  assert.match(source, /depth: 0\.32/);
  assert.match(source, /depthTransforms: new Map\(\)/);
  assert.match(source, /function syncDepthTransforms\(size = canvasSize\(\)\)/);
  assert.match(source, /const ratio = current\.zoom \/ previous\.zoom/);
  assert.match(source, /const deltaX = current\.originX - ratio \* previous\.originX/);
  assert.match(source, /Math\.pow\(ratio, depth\)/);
  assert.match(source, /\(depthScale - 1\) \/ \(ratio - 1\)/);
  assert.match(source, /scale: depthScale \* old\.scale/);
  assert.match(source, /translateX: depthScale \* old\.translateX \+ translatedX/);
  assert.match(source, /translateY: depthScale \* old\.translateY \+ translatedY/);
  assert.match(source, /viewportChanged/);
  assert.match(source, /resetDepthTransforms\(current, reduced\)/);
  assert.match(source, /function cameraFixedPoint/);
  assert.match(source, /function drawGalaxyEnvelope\(width, height\)/);
  assert.match(source, /worldToScreen\(0, 0\)/);
  assert.match(source, /function measuredSceneWorldRadius\(\)/);
  assert.match(source, /runtime\.envelopeGraph !== state\.graph/);
  assert.match(source, /runtime\.envelopeStyle !== style/);
  assert.match(source, /GALAXY_DUST_COUNT = 64/);
  assert.match(source, /function drawGalaxyDust\(radius, core\)/);
  assert.doesNotMatch(source, /ctx\.ellipse\(/);
  assert.match(source, /function wrap\(value, size\)/);
  assert.match(source, /METEOR_MIN_DELAY = 22_000/);
  assert.match(source, /METEOR_DELAY_SPAN = 34_000/);
  assert.match(source, /runtime\.meteor\) return false/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /width < 720/);
  assert.match(source, /ProjectMapCosmicBackground/);
});

test("Pages build adapter installs camera then cosmic before style runtimes only on the shared viewer", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "ipm-cosmic-"));
  try {
    await mkdir(join(outputDir, "u"), { recursive: true });
    await mkdir(join(outputDir, "radial"), { recursive: true });
    await writeFile(
      join(outputDir, "u", "index.html"),
      '<body><script src="../viewer.js" defer></script>\n<script src="../galaxy-systems-runtime.js" defer></script>\n<script src="../view-state.js" defer></script></body>',
    );
    await writeFile(join(outputDir, "radial", "index.html"), '<body><script src="../radial-viewer.js" defer></script></body>');

    await applyReactiveCosmicBackground(outputDir);
    await applyReactiveCosmicBackground(outputDir);

    const shared = await readFile(join(outputDir, "u", "index.html"), "utf8");
    const dedicated = await readFile(join(outputDir, "radial", "index.html"), "utf8");
    const camera = await readFile(join(outputDir, "camera-coherence.js"), "utf8");
    const cosmic = await readFile(join(outputDir, "cosmic-background.js"), "utf8");
    assert.equal((shared.match(/camera-coherence\.js/g) || []).length, 1);
    assert.equal((shared.match(/cosmic-background\.js/g) || []).length, 1);
    assert.ok(shared.indexOf("viewer.js") < shared.indexOf("camera-coherence.js"));
    assert.ok(shared.indexOf("camera-coherence.js") < shared.indexOf("cosmic-background.js"));
    assert.ok(shared.indexOf("cosmic-background.js") < shared.indexOf("galaxy-systems-runtime.js"));
    assert.ok(shared.indexOf("galaxy-systems-runtime.js") < shared.indexOf("view-state.js"));
    assert.doesNotMatch(dedicated, /camera-coherence\.js|cosmic-background\.js/);
    assert.match(camera, /ProjectMapCameraCoherence/);
    assert.match(cosmic, /reactiveCosmicBackground/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
