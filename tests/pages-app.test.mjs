import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { renderPagesHome, renderPagesViewer } from "../scripts/pages-app.mjs";
import { buildPublicPages, PUBLIC_ACTION_REF } from "../scripts/build-public-pages.mjs";

const styles = ["radial", "galaxy", "obsidian", "tree", "treemap"];

test("Pages generator source retains distributed static installation URLs and isolated permissions", () => {
  const html = renderPagesHome();
  assert.match(html, /raw\.githubusercontent\.com/); assert.match(html, /HEAD\/project-map/); assert.match(html, /new URL\('u\/'/); assert.match(html, /nekomario28\/interactive-project-map@v1/); assert.match(html, /contents: read/); assert.match(html, /contents: write/); assert.match(html, /actions\/upload-artifact@/); assert.doesNotMatch(html, /api\.github\.com/);
});

test("legacy viewer render source remains static-only before public shell replacement", () => {
  const html = renderPagesViewer();
  assert.match(html, /raw\.githubusercontent\.com/); assert.match(html, /HEAD\/project-map\/graph\.json/); assert.doesNotMatch(html, /\/api\/graph/); assert.doesNotMatch(html, /api\.github\.com/);
});

test("public Pages build emits five map presets with visual examples", async () => {
  const dir = await mkdtemp(join(tmpdir(), "project-map-pages-"));
  try {
    await buildPublicPages(dir);
    const home = await readFile(join(dir, "index.html"), "utf8");
    const viewer = await readFile(join(dir, "u", "index.html"), "utf8");
    const radialViewer = await readFile(join(dir, "radial", "index.html"), "utf8");
    const treeViewer = await readFile(join(dir, "tree", "index.html"), "utf8");
    const treemapViewer = await readFile(join(dir, "treemap", "index.html"), "utf8");
    const appJs = await readFile(join(dir, "app.js"), "utf8");
    const viewerJs = await readFile(join(dir, "viewer.js"), "utf8");
    const radialViewerJs = await readFile(join(dir, "radial-viewer.js"), "utf8");
    const treeViewerJs = await readFile(join(dir, "tree-viewer.js"), "utf8");
    const treemapViewerJs = await readFile(join(dir, "treemap-viewer.js"), "utf8");
    const treeRouterJs = await readFile(join(dir, "tree-router.js"), "utf8");
    const treeNavJs = await readFile(join(dir, "tree-nav.js"), "utf8");
    const viewerCss = await readFile(join(dir, "viewer.css"), "utf8");
    const presetCss = await readFile(join(dir, "presets.css"), "utf8");
    const noJekyll = await readFile(join(dir, ".nojekyll"), "utf8");

    assert.match(home, /Create your map/); assert.match(home, /id="mapStyle"/); assert.match(home, /Radial Tree \(Classic\)/); assert.match(home, /Obsidian-like/); assert.match(home, />Treemap</);
    for (const style of styles) assert.match(home, new RegExp(`data-style-preset="${style}"`));
    assert.match(home, /<link rel="stylesheet" href="\.\/presets\.css">/); assert.match(home, /<script src="\.\/app\.js" defer><\/script>/); assert.match(home, /script-src 'self'/); assert.doesNotMatch(home, /<script>\s*const USERNAME_RE/);

    for (const html of [viewer, radialViewer, treeViewer, treemapViewer]) for (const style of styles) assert.match(html, new RegExp(`value="${style}"`));
    assert.match(viewer, /<script src="\.\.\/tree-router\.js" defer><\/script>/); assert.match(viewer, /<script src="\.\.\/viewer\.js" defer><\/script>/);
    assert.match(radialViewer, /data-map-style="radial"/); assert.match(radialViewer, /value="radial" selected/); assert.match(radialViewer, /radial-viewer\.js/);
    assert.match(treeViewer, /data-map-style="tree"/); assert.match(treeViewer, /value="tree" selected/); assert.match(treeViewer, /tree-nav\.js/); assert.match(treeViewer, /tree-viewer\.js/);
    assert.match(treemapViewer, /data-map-style="treemap"/); assert.match(treemapViewer, /value="treemap" selected/); assert.match(treemapViewer, /treemap-viewer\.js/);

    assert.match(appJs, new RegExp(`PROJECT_MAP_ACTION_REF=['"]${PUBLIC_ACTION_REF}['"]`));
    assert.match(appJs, /STYLE_VALUES=new Set\(\['radial','galaxy','obsidian','tree','treemap'\]\)/); assert.match(appJs, /v\.style==='treemap'\?'treemap\/'/); assert.match(appJs, /uses: nekomario28\/interactive-project-map@'\+PROJECT_MAP_ACTION_REF/); assert.match(appJs, /style: '\+v\.style/); assert.doesNotMatch(appJs, /__PROJECT_MAP_ACTION_REF__/);

    assert.match(viewerJs, /buildGalaxyLayout/); assert.match(viewerJs, /buildObsidianLayout/); assert.match(viewerJs, /raw\.githubusercontent\.com/); assert.doesNotMatch(viewerJs, /\/api\/graph|api\.github\.com/);
    assert.match(radialViewerJs, /buildRadialLayout/); assert.match(radialViewerJs, /Radial Tree/); assert.doesNotMatch(radialViewerJs, /\/api\/graph|api\.github\.com/);
    assert.match(treeViewerJs, /buildTreeLayout/); assert.match(treeViewerJs, /Owner → Category → Repository/); assert.doesNotMatch(treeViewerJs, /\/api\/graph|api\.github\.com/);
    assert.match(treemapViewerJs, /buildLayout/); assert.match(treemapViewerJs, /Project treemap/); assert.match(treemapViewerJs, /raw\.githubusercontent\.com/); assert.doesNotMatch(treemapViewerJs, /\/api\/graph|api\.github\.com/);
    assert.match(treeRouterJs, /treemap/); assert.match(treeNavJs, /treemap/);

    assert.match(viewerCss, /body\[data-map-style="obsidian"\]/); assert.match(viewerCss, /--original:/); assert.match(viewerCss, /--fork:/); assert.match(viewerCss, /--archived:/);
    assert.match(presetCss, /\.preset-gallery/); assert.match(presetCss, /\.preview-ring/); assert.match(presetCss, /\.preview-group-box/); assert.equal(noJekyll, "\n");

    for (const script of ["app.js", "viewer.js", "radial-viewer.js", "tree-viewer.js", "treemap-viewer.js", "tree-router.js", "tree-nav.js"].map((name) => join(dir, name))) {
      const checked = spawnSync(process.execPath, ["--check", script], { encoding: "utf8" });
      assert.equal(checked.status, 0, `${script} failed syntax check:\n${checked.stderr}`);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
