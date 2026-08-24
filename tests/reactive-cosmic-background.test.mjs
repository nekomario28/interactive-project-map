import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { applyReactiveCosmicBackground } from "../scripts/apply-reactive-cosmic-background.mjs";

const sourceUrl = new URL("../scripts/public-cosmic-background.js", import.meta.url);

test("reactive cosmic background keeps pan-linked wrapped layers and sparse meteors", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /parallax: 0\.08/);
  assert.match(source, /parallax: 0\.18/);
  assert.match(source, /parallax: 0\.32/);
  assert.match(source, /state\.pan\.x \* parallax/);
  assert.match(source, /state\.pan\.y \* parallax/);
  assert.match(source, /function wrap\(value, size\)/);
  assert.match(source, /METEOR_MIN_DELAY = 22_000/);
  assert.match(source, /METEOR_DELAY_SPAN = 34_000/);
  assert.match(source, /runtime\.meteor\) return false/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /width < 720/);
  assert.match(source, /ProjectMapCosmicBackground/);
});

test("Pages build adapter installs the cosmic runtime only on the shared viewer", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "ipm-cosmic-"));
  try {
    await mkdir(join(outputDir, "u"), { recursive: true });
    await mkdir(join(outputDir, "radial"), { recursive: true });
    await writeFile(
      join(outputDir, "u", "index.html"),
      '<body><script src="../viewer.js" defer></script>\n<script src="../view-state.js" defer></script></body>',
    );
    await writeFile(join(outputDir, "radial", "index.html"), '<body><script src="../radial-viewer.js" defer></script></body>');

    await applyReactiveCosmicBackground(outputDir);
    await applyReactiveCosmicBackground(outputDir);

    const shared = await readFile(join(outputDir, "u", "index.html"), "utf8");
    const dedicated = await readFile(join(outputDir, "radial", "index.html"), "utf8");
    const runtime = await readFile(join(outputDir, "cosmic-background.js"), "utf8");
    assert.equal((shared.match(/cosmic-background\.js/g) || []).length, 1);
    assert.ok(shared.indexOf("view-state.js") < shared.indexOf("cosmic-background.js"));
    assert.doesNotMatch(dedicated, /cosmic-background\.js/);
    assert.match(runtime, /reactiveCosmicBackground/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
