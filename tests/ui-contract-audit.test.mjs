import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildPublicPages } from "../scripts/build-public-pages.mjs";
import { postprocessPublicPages } from "../scripts/postprocess-public-pages.mjs";
import { applyDedicatedViewState } from "../scripts/apply-dedicated-view-state.mjs";
import { applyCategoryNavigator } from "../scripts/apply-category-navigator.mjs";
import { applyUiContractFixes } from "../scripts/apply-ui-contract-fixes.mjs";

const VIEWER_DIRS = ["u", "radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"];

test("final Pages build keeps setup copy, legend semantics and Sunburst dense LOD consistent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "project-map-ui-contract-"));
  try {
    await buildPublicPages(dir);
    await postprocessPublicPages(dir);
    await applyDedicatedViewState(dir);
    await applyCategoryNavigator(dir);
    await applyUiContractFixes(dir); // Explicit second pass proves final fixer is idempotent.

    const home = await readFile(join(dir, "index.html"), "utf8");
    assert.match(home, /Profile SVG theme/);
    assert.match(home, /class="style-fallback"/);
    assert.match(home, /Alternative style picker/);
    assert.match(home, /Last 12 months · up to 12 public external repositories/);
    for (const step of ["0 · Profile repo", "1 · Add workflow", "2 · Run first update", "3 · Add README embed"]) {
      assert.equal(home.split(step).length - 1, 1, `expected exactly one ${step}`);
    }
    assert.doesNotMatch(home, /<strong>1 · Copy workflow<\/strong>/);

    const app = await readFile(join(dir, "app.js"), "utf8");
    assert.match(app, /Checking the currently published SVG/);
    assert.match(app, /may reflect previous settings until Step 2 runs/);
    assert.doesNotMatch(app, /Existing static SVG found in the profile repository/);

    const presetCss = await readFile(join(dir, "presets.css"), "utf8");
    assert.match(presetCss, /Project Map UI contract audit fixes/);
    assert.match(presetCss, /\.contributed-option/);

    const viewerCss = await readFile(join(dir, "viewer.css"), "utf8");
    assert.match(viewerCss, /\.legend \.contributed \{ background: #55c7d7; \}/);
    assert.match(viewerCss, /\.repository-filters \.status-chip:disabled \{ display: none; \}/);

    for (const mode of VIEWER_DIRS) {
      const html = await readFile(join(dir, mode, "index.html"), "utf8");
      assert.equal(html.split('<i class="contributed"></i>Contributed').length - 1, 1, `${mode} must expose one Contributed legend item`);
    }

    const polish = await readFile(join(dir, "interaction-polish.js"), "utf8");
    assert.match(polish, /Sunburst dense-label LOD/);
    assert.match(polish, /total > 36 && span < 0\.17/);
    assert.match(polish, /const searched = Boolean\(state\.query && matches\(repo\)\)/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
