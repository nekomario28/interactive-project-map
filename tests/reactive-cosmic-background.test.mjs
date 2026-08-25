import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { applyReactiveCosmicBackground } from "../scripts/apply-reactive-cosmic-background.mjs";

const cosmicSourceUrl = new URL("../scripts/public-cosmic-background.js", import.meta.url);
const cameraSourceUrl = new URL("../scripts/public-camera-coherence.js", import.meta.url);

test("camera coherence normalizes wheel input and derives scene-aware zoom bounds", async () => {
  const source = await readFile(cameraSourceUrl, "utf8");
  assert.match(source, /WheelEvent\.DOM_DELTA_LINE/);
  assert.match(source, /WheelEvent\.DOM_DELTA_PAGE/);
  assert.match(source, /MAX_WHEEL_PIXELS = 140/);
  assert.match(source, /sceneFitZoom/);
  assert.match(source, /fit \* 0\.46/);
  assert.match(source, /stopImmediatePropagation/);
  assert.match(source, /screenToWorld\(screenX, screenY\)/);
  assert.match(source, /worldToScreen\(before\.x, before\.y\)/);
  assert.match(source, /ProjectMapCameraCoherence/);
});

test("reactive cosmic background keeps pan-linked depth, zoom parallax, galaxy envelope, and sparse meteors", async () => {
  const source = await readFile(cosmicSourceUrl, "utf8");
  assert.match(source, /parallax: 0\.08, zoomParallax: 0\.05/);
  assert.match(source, /parallax: 0\.18, zoomParallax: 0\.12/);
  assert.match(source, /parallax: 0\.32, zoomParallax: 0\.22/);
  assert.match(source, /state\.pan\.x \* parallax/);
  assert.match(source, /state\.pan\.y \* parallax/);
  assert.match(source, /Math\.pow\(clamp\(Number\(state\.zoom\)/);
  assert.match(source, /function drawGalaxyEnvelope\(width, height\)/);
  assert.match(source, /worldToScreen\(0, 0\)/);
  assert.match(source, /function sceneWorldRadius\(\)/);
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
