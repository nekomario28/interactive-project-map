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

test("public Pages build emits Radial, Galaxy, Obsidian-like and Tree presets with examples", async () => {
  const dir = await mkdtemp(join(tmpdir(), "project-map-pages-"));
  try {
    await buildPublicPages(dir);
    const home = await readFile(join(dir, "index.html"), "utf8");
    const viewer = await readFile(join(dir, "u", "index.html"), "utf8");
    const radialViewer = await readFile(join(dir, "radial", "index.html"), "utf8");
    const treeViewer = await readFile(join(dir, "tree", "index.html"), "utf8");
    const appJs = await readFile(join(dir, "app.js"), "utf8");
    const viewerJs = await readFile(join(dir, "viewer.js"), "utf8");
    const radialViewerJs = await readFile(join(dir, "radial-viewer.js"), "utf8");
    const treeViewerJs = await readFile(join(dir, "tree-viewer.js"), "utf8");
    const treeRouterJs = await readFile(join(dir, "tree-router.js"), "utf8");
    const treeNavJs = await readFile(join(dir, "tree-nav.js"), "utf8");
    const viewerCss = await readFile(join(dir, "viewer.css"), "utf8");
    const presetCss = await readFile(join(dir, "presets.css"), "utf8");
    const noJekyll = await readFile(join(dir, ".nojekyll"), "utf8");

    assert.match(home, /Create your map/);
    assert.match(home, /id="mapStyle"/);
    assert.match(home, /Radial Tree \(Classic\)/);
    assert.match(home, /Obsidian-like/);
    assert.match(home, />Tree</);
    for (const style of ["radial", "galaxy", "obsidian", "tree"]) {
      assert.match(home, new RegExp(`data-style-preset="${style}"`));
    }
    assert.match(home, /<link rel="stylesheet" href="\.\/presets\.css">/);
    assert.match(home, /<script src="\.\/app\.js" defer><\/script>/);
    assert.match(home, /script-src 'self'/);
    assert.doesNotMatch(home, /<script>\s*const USERNAME_RE/);

    assert.match(viewer, /Interactive Project Map/);
    assert.match(viewer, /id="search"/);
    assert.match(viewer, /id="style"/);
    assert.match(viewer, /value="radial"/);
    assert.match(viewer, /value="tree"/);
    assert.match(viewer, />Original</);
    assert.match(viewer, />Fork</);
    assert.match(viewer, />Archived</);
    assert.match(viewer, /<link rel="stylesheet" href="\.\.\/viewer\.css">/);
    assert.match(viewer, /<script src="\.\.\/tree-router\.js" defer><\/script>/);
    assert.match(viewer, /<script src="\.\.\/viewer\.js" defer><\/script>/);

    assert.match(radialViewer, /data-map-style="radial"/);
    assert.match(radialViewer, /value="radial" selected/);
    assert.match(radialViewer, /<script src="\.\.\/radial-viewer\.js" defer><\/script>/);
    assert.match(treeViewer, /data-map-style="tree"/);
    assert.match(treeViewer, /value="tree" selected/);
    assert.match(treeViewer, /<script src="\.\.\/tree-nav\.js" defer><\/script>/);
    assert.match(treeViewer, /<script src="\.\.\/tree-viewer\.js" defer><\/script>/);

    assert.match(appJs, new RegExp(`PROJECT_MAP_ACTION_REF=['"]${PUBLIC_ACTION_REF}['"]`));
    assert.match(appJs, /STYLE_VALUES=new Set\(\['radial','galaxy','obsidian','tree'\]\)/);
    assert.match(appJs, /v\.style==='tree'\?'tree\/':v\.style==='radial'\?'radial\/':'u\/'/);
    assert.match(appJs, /uses: nekomario28\/interactive-project-map@'\+PROJECT_MAP_ACTION_REF/);
    assert.match(appJs, /style: '\+v\.style/);
    assert.match(appJs, /data-style-preset/);
    assert.doesNotMatch(appJs, /__PROJECT_MAP_ACTION_REF__/);

    assert.match(viewerJs, /buildGalaxyLayout/);
    assert.match(viewerJs, /buildObsidianLayout/);
    assert.match(viewerJs, /boxesOverlap/);
    assert.match(viewerJs, /raw\.githubusercontent\.com/);
    assert.doesNotMatch(viewerJs, /\/api\/graph|api\.github\.com/);
    assert.match(radialViewerJs, /buildRadialLayout/);
    assert.match(radialViewerJs, /Radial Tree/);
    assert.match(radialViewerJs, /raw\.githubusercontent\.com/);
    assert.doesNotMatch(radialViewerJs, /\/api\/graph|api\.github\.com/);
    assert.match(treeRouterJs, /dedicatedViewerUrl/);
    assert.match(treeRouterJs, /radial/);
    assert.match(treeRouterJs, /location\.replace/);
    assert.match(treeNavJs, /radial/);
    assert.match(treeViewerJs, /buildTreeLayout/);
    assert.match(treeViewerJs, /Owner → Category → Repository/);
    assert.match(treeViewerJs, /raw\.githubusercontent\.com/);
    assert.doesNotMatch(treeViewerJs, /\/api\/graph|api\.github\.com/);

    assert.match(viewerCss, /body\[data-map-style="obsidian"\]/);
    assert.match(viewerCss, /--original:/);
    assert.match(viewerCss, /--fork:/);
    assert.match(viewerCss, /--archived:/);
    assert.match(presetCss, /\.preset-gallery/);
    assert.match(presetCss, /\.preview-ring/);
    assert.match(presetCss, /\.tree-line/);
    assert.equal(noJekyll, "\n");

    for (const script of [join(dir, "app.js"), join(dir, "viewer.js"), join(dir, "radial-viewer.js"), join(dir, "tree-viewer.js"), join(dir, "tree-router.js"), join(dir, "tree-nav.js")]) {
      const checked = spawnSync(process.execPath, ["--check", script], { encoding: "utf8" });
      assert.equal(checked.status, 0, `${script} failed syntax check:\n${checked.stderr}`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
