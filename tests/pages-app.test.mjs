import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { renderPagesHome, renderPagesViewer } from "../scripts/pages-app.mjs";
import { buildPublicPages, PUBLIC_ACTION_REF } from "../scripts/build-public-pages.mjs";

test("Pages generator source retains distributed static installation URLs and isolated permissions", () => {
  const html = renderPagesHome();
  assert.match(html, /raw\.githubusercontent\.com/);
  assert.match(html, /HEAD\/project-map/);
  assert.match(html, /new URL\('u\/'/);
  assert.match(html, /nekomario28\/interactive-project-map@v1/);
  assert.match(html, /contents: read/);
  assert.match(html, /contents: write/);
  assert.match(html, /actions\/upload-artifact@/);
  assert.doesNotMatch(html, /api\.github\.com/);
});

test("legacy viewer render source remains static-only before public shell replacement", () => {
  const html = renderPagesViewer();
  assert.match(html, /raw\.githubusercontent\.com/);
  assert.match(html, /HEAD\/project-map\/graph\.json/);
  assert.doesNotMatch(html, /\/api\/graph/);
  assert.doesNotMatch(html, /api\.github\.com/);
});

test("public Pages build emits Galaxy and Obsidian-like style presets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "project-map-pages-"));
  try {
    await buildPublicPages(dir);
    const home = await readFile(join(dir, "index.html"), "utf8");
    const viewer = await readFile(join(dir, "u", "index.html"), "utf8");
    const appJs = await readFile(join(dir, "app.js"), "utf8");
    const viewerJs = await readFile(join(dir, "viewer.js"), "utf8");
    const viewerCss = await readFile(join(dir, "viewer.css"), "utf8");
    const noJekyll = await readFile(join(dir, ".nojekyll"), "utf8");

    assert.match(home, /Create your map/);
    assert.match(home, /id="mapStyle"/);
    assert.match(home, /Obsidian-like/);
    assert.match(home, /<script src="\.\/app\.js" defer><\/script>/);
    assert.match(home, /script-src 'self'/);
    assert.doesNotMatch(home, /<script>\s*const USERNAME_RE/);

    assert.match(viewer, /Interactive Project Map/);
    assert.match(viewer, /id="search"/);
    assert.match(viewer, /id="style"/);
    assert.match(viewer, />Original</);
    assert.match(viewer, />Fork</);
    assert.match(viewer, />Archived</);
    assert.match(viewer, /<link rel="stylesheet" href="\.\.\/viewer\.css">/);
    assert.match(viewer, /<script src="\.\.\/viewer\.js" defer><\/script>/);
    assert.match(viewer, /script-src 'self'/);

    assert.match(appJs, new RegExp(`PROJECT_MAP_ACTION_REF=['"]${PUBLIC_ACTION_REF}['"]`));
    assert.match(appJs, /uses: nekomario28\/interactive-project-map@'\+PROJECT_MAP_ACTION_REF/);
    assert.match(appJs, /style: '\+v\.style/);
    assert.match(appJs, /viewer\.searchParams\.set\('style',v\.style\)/);
    assert.doesNotMatch(appJs, /__PROJECT_MAP_ACTION_REF__/);

    assert.match(viewerJs, /buildGalaxyLayout/);
    assert.match(viewerJs, /buildObsidianLayout/);
    assert.match(viewerJs, /boxesOverlap/);
    assert.match(viewerJs, /node\.archived \? "archived"/);
    assert.match(viewerJs, /node\.fork \? "fork" : "original"/);
    assert.match(viewerJs, /raw\.githubusercontent\.com/);
    assert.doesNotMatch(viewerJs, /\/api\/graph|api\.github\.com/);

    assert.match(viewerCss, /body\[data-map-style="obsidian"\]/);
    assert.match(viewerCss, /--original:/);
    assert.match(viewerCss, /--fork:/);
    assert.match(viewerCss, /--archived:/);
    assert.equal(noJekyll, "\n");

    for (const script of [join(dir, "app.js"), join(dir, "viewer.js")]) {
      const checked = spawnSync(process.execPath, ["--check", script], { encoding: "utf8" });
      assert.equal(checked.status, 0, `${script} failed syntax check:\n${checked.stderr}`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
