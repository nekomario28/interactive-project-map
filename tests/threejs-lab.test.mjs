import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { buildThreejsLab, renderThreejsLabPage } from "../scripts/build-threejs-lab.mjs";

test("Three.js lab is isolated from the existing viewer and uses a pinned engine", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-threejs-lab-"));
  try {
    await buildThreejsLab({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    const [html, runtime, css] = await Promise.all([
      readFile(join(root, "three", "index.html"), "utf8"),
      readFile(join(root, "threejs-viewer.js"), "utf8"),
      readFile(join(root, "threejs-viewer.css"), "utf8"),
    ]);

    assert.match(html, /data-map-style="threejs-cosmic"/);
    assert.match(html, /script-src 'self' https:\/\/cdn\.jsdelivr\.net/);
    assert.match(html, /<script type="module" src="\.\.\/threejs-viewer\.js"><\/script>/);
    assert.match(html, /href="\.\.\/viewer\.css"/);
    assert.match(runtime, /three@0\.185\.1\/build\/three\.module\.min\.js/);
    assert.match(runtime, /canonicalGraphMutation: false/);
    assert.match(runtime, /relation === "contributed"/);
    assert.match(runtime, /raw\.githubusercontent\.com/);
    assert.doesNotMatch(runtime, /api\.github\.com/);
    assert.match(css, /perspective: 1200px/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Three.js lab source files pass Node syntax checks", () => {
  for (const path of ["scripts/build-threejs-lab.mjs", "scripts/public-threejs-viewer.js"]) {
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
