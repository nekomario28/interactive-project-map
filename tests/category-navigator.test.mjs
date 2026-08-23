import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { applyCategoryNavigator } from "../scripts/apply-category-navigator.mjs";

const VIEWER_DIRS = ["u", "radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"];

test("category navigator is attached once to every interactive viewer", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-category-nav-"));
  try {
    for (const mode of VIEWER_DIRS) {
      const dir = join(root, mode);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "index.html"), "<!doctype html><html><head></head><body><main></main></body></html>");
    }

    await applyCategoryNavigator(root);
    await applyCategoryNavigator(root);

    for (const mode of VIEWER_DIRS) {
      const html = await readFile(join(root, mode, "index.html"), "utf8");
      assert.equal((html.match(/category-navigator\.css/g) || []).length, 1, `${mode} should load navigator CSS once`);
      assert.equal((html.match(/category-navigator\.js/g) || []).length, 1, `${mode} should load navigator JS once`);
    }

    const runtime = await readFile(join(root, "category-navigator.js"), "utf8");
    const css = await readFile(join(root, "category-navigator.css"), "utf8");
    assert.match(runtime, /categoryNavigatorToggle/);
    assert.match(runtime, /category-navigator-primary/);
    assert.match(runtime, /manualExpanded/);
    assert.match(runtime, /toggleFocusNode/);
    assert.match(runtime, /activeFocusId\(\) === id/);
    assert.match(runtime, /focusCategory/);
    assert.match(runtime, /externalRepositories/);
    assert.match(runtime, /externalContributions/);
    assert.match(runtime, /not owned/);
    assert.match(css, /\.category-navigator-primary/);
    assert.match(css, /\.category-navigator/);
    assert.match(css, /aria-pressed="true"\]\:\:after/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
