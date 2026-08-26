import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { buildThreejsLab, renderThreejsLabPage } from "../scripts/build-threejs-lab.mjs";

test("Three.js lab consumes shared semantic and transferable state runtimes", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-threejs-lab-"));
  try {
    await buildThreejsLab({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    const [html, viewStateRuntime, viewModelRuntime, runtime, css] = await Promise.all([
      readFile(join(root, "three", "index.html"), "utf8"),
      readFile(join(root, "project-map-view-state.js"), "utf8"),
      readFile(join(root, "project-map-view-model.js"), "utf8"),
      readFile(join(root, "threejs-viewer.js"), "utf8"),
      readFile(join(root, "threejs-viewer.css"), "utf8"),
    ]);

    assert.match(html, /data-map-style="threejs-cosmic"/);
    assert.match(html, /script-src 'self' https:\/\/cdn\.jsdelivr\.net/);
    assert.match(html, /<script src="\.\.\/project-map-view-state\.js"><\/script>\s*<script src="\.\.\/project-map-view-model\.js"><\/script>\s*<script type="module" src="\.\.\/threejs-viewer\.js"><\/script>/);
    assert.match(html, /href="\.\.\/viewer\.css"/);
    assert.match(html, /id="renderDensityToggle"/);
    assert.match(html, />Render Auto</);
    assert.doesNotMatch(html, /id="qualityToggle"/);

    assert.match(viewStateRuntime, /window\.ProjectMapTransferableState/);
    assert.match(viewModelRuntime, /window\.ProjectMapViewModel/);
    assert.match(viewModelRuntime, /projectByStatuses/);
    assert.match(runtime, /three@0\.185\.1\/build\/three\.module\.min\.js/);
    assert.match(runtime, /window\.ProjectMapViewModel\?\.sanitizeGraph/);
    assert.match(runtime, /window\.ProjectMapViewModel\?\.projectByStatuses/);
    assert.match(runtime, /window\.ProjectMapTransferableState/);
    assert.match(runtime, /statusCounts\(graph\)/);
    assert.match(runtime, /data\.renderDensity/);
    assert.match(runtime, /searchParams\.set\("render",next\)/);
    assert.match(runtime, /fallback\.searchParams\.delete\("render"\)/);
    assert.match(runtime, /canonicalGraphMutation\s*:\s*false/);
    assert.match(runtime, /relation\s*===\s*"contributed"/);
    assert.match(runtime, /raw\.githubusercontent\.com/);
    assert.doesNotMatch(runtime, /api\.github\.com/);
    assert.doesNotMatch(runtime, /Quality Auto/);
    assert.match(css, /perspective: 1200px/);

    for (const path of [
      join(root, "project-map-view-state.js"),
      join(root, "project-map-view-model.js"),
      join(root, "threejs-viewer.js"),
    ]) {
      const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
      assert.equal(result.status, 0, `${path} failed generated syntax check:\n${result.stderr}`);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Three.js lab source files pass Node syntax checks", () => {
  for (const path of [
    "packages/project-map-view-model/src/index.js",
    "packages/project-map-view-model/src/view-state.js",
    "scripts/project-map-view-model-runtime.mjs",
    "scripts/project-map-view-state-runtime.mjs",
    "scripts/build-threejs-lab.mjs",
    "scripts/public-threejs-viewer.js",
  ]) {
    const result = spawnSync(process.execPath, ["--check", path], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(result.status, 0, `${path} failed syntax check:\n${result.stderr}`);
  }
});

test("rendered lab page does not register a new production preset", () => {
  const html = renderThreejsLabPage();
  assert.doesNotMatch(html, /data-style-preset=/);
  assert.doesNotMatch(html, /id="style"/);
  assert.match(html, />2D Map</);
});
