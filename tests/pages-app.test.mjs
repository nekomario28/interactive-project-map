import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { renderPagesHome, renderPagesViewer } from "../scripts/pages-app.mjs";
import { buildPublicPages, PUBLIC_ACTION_REF } from "../scripts/build-public-pages.mjs";

const styles = ["radial", "galaxy", "obsidian", "tree", "treemap", "timeline", "cluster"];
const dedicated = ["radial", "tree", "treemap", "timeline", "cluster"];

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

test("public Pages build emits seven map presets with visual examples", async () => {
  const dir = await mkdtemp(join(tmpdir(), "project-map-pages-"));
  try {
    await buildPublicPages(dir);
    const read = (name) => readFile(join(dir, name), "utf8");
    const home = await read("index.html");
    const shared = await read("u/index.html");
    const appJs = await read("app.js");
    const routerJs = await read("tree-router.js");
    const navJs = await read("tree-nav.js");
    const presetCss = await read("presets.css");
    const noJekyll = await read(".nojekyll");

    assert.match(home, /Radial Tree \(Classic\)/);
    assert.match(home, />Cluster \/ Bubble</);
    for (const style of styles) assert.match(home, new RegExp(`data-style-preset="${style}"`));
    for (const style of styles) assert.match(shared, new RegExp(`value="${style}"`));
    assert.match(shared, /tree-router\.js/);
    assert.match(shared, /viewer\.js/);

    for (const style of dedicated) {
      const html = await read(`${style}/index.html`);
      const script = await read(`${style}-viewer.js`);
      assert.match(html, new RegExp(`data-map-style="${style}"`));
      assert.match(html, new RegExp(`value="${style}" selected`));
      assert.match(html, /tree-nav\.js/);
      assert.match(html, new RegExp(`${style}-viewer\\.js`));
      assert.match(script, /raw\.githubusercontent\.com/);
      assert.doesNotMatch(script, /\/api\/graph|api\.github\.com/);
    }

    assert.match(appJs, new RegExp(`PROJECT_MAP_ACTION_REF=['"]${PUBLIC_ACTION_REF}['"]`));
    assert.match(appJs, /STYLE_VALUES=new Set\(\['radial','galaxy','obsidian','tree','treemap','timeline','cluster'\]\)/);
    assert.match(appJs, /DEDICATED|dedicated/);
    assert.doesNotMatch(appJs, /__PROJECT_MAP_ACTION_REF__/);
    assert.match(routerJs, /cluster/);
    assert.match(navJs, /cluster/);
    assert.match(presetCss, /\.preview-cluster/);
    assert.equal(noJekyll, "\n");

    for (const name of ["app.js", "viewer.js", ...dedicated.map((style) => `${style}-viewer.js`), "tree-router.js", "tree-nav.js"]) {
      const checked = spawnSync(process.execPath, ["--check", join(dir, name)], { encoding: "utf8" });
      assert.equal(checked.status, 0, `${name} failed syntax check:\n${checked.stderr}`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
