import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { applyReactiveCosmicBackground } from "../scripts/apply-reactive-cosmic-background.mjs";

const sourceUrl = new URL("../scripts/public-cosmic-background.js", import.meta.url);

test("Galaxy background restores the profile-local world-space donor instead of screen-space decoration", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /ead72debca2a16608ebc5b799993c0234ea10cab/);
  assert.match(source, /Y_FLATTEN = 0\.63/);
  assert.match(source, /STAR_COUNT = 92/);
  assert.match(source, /RINGS = Object\.freeze\(\[132, 194, 256\]\)/);
  assert.match(source, /ARM_START = 92/);
  assert.match(source, /ARM_END = 294/);
  assert.match(source, /\(\(radius - 128\) \/ 148\) \* 0\.38/);
  assert.match(source, /associationLobes: 4/);
  assert.match(source, /associationStars: 7/);
  assert.match(source, /worldToScreen\(star\.x, star\.y\)/);
  assert.match(source, /profileLocalGalaxyBackground/);
  assert.doesNotMatch(source, /parallax:/);
  assert.doesNotMatch(source, /METEOR_MIN_DELAY/);
  assert.doesNotMatch(source, /spawnMeteor/);
  assert.doesNotMatch(source, /HAZE_TILE/);
});

test("Pages build adapter installs the restored galaxy world before style runtimes only on the shared viewer", async () => {
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
    const runtime = await readFile(join(outputDir, "cosmic-background.js"), "utf8");
    assert.equal((shared.match(/cosmic-background\.js/g) || []).length, 1);
    assert.ok(shared.indexOf("viewer.js") < shared.indexOf("cosmic-background.js"));
    assert.ok(shared.indexOf("cosmic-background.js") < shared.indexOf("galaxy-systems-runtime.js"));
    assert.ok(shared.indexOf("galaxy-systems-runtime.js") < shared.indexOf("view-state.js"));
    assert.doesNotMatch(dedicated, /cosmic-background\.js/);
    assert.match(runtime, /profileLocalGalaxyBackground/);
    assert.match(runtime, /profile-local-common-center-galaxy/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
