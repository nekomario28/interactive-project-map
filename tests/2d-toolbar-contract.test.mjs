import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPublicPages } from "../scripts/build-public-pages.mjs";

test("all nine 2D views expose secondary controls without post-build mutation", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-2d-toolbar-"));
  try {
    await buildPublicPages(root);
    for (const route of ["u", "radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"]) {
      const html = await readFile(join(root, route, "index.html"), "utf8");
      assert.ok(html.includes('src="../2d-toolbar.js" defer'), route);
    }
    const script = await readFile(join(root, "2d-toolbar.js"), "utf8");
    assert.ok(script.includes('className = "view-options-menu"'));
    assert.ok(script.includes('["fit", "reset", "motionToggle", "activityToggle", "shareView"]'));
    assert.ok(script.includes('getElementById("qualityToggle")'));
    const sharedViewer = await readFile(new URL("../scripts/public-viewer.js", import.meta.url), "utf8");
    assert.ok(sharedViewer.includes("function revealSelectionOutsidePanel(node)"));
    assert.ok(sharedViewer.includes("ProjectMapCameraCoherence?.constrainPan({ redraw: false })"));
    const home = await readFile(join(root, "index.html"), "utf8");
    assert.ok(home.includes("Published SVG from your profile repository"));
    assert.ok(home.includes('<optgroup label="Exploratory graph views">'));
    assert.ok(home.includes('<optgroup label="Structured analytical views">'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
