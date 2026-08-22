import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildPublicPages } from "../scripts/build-public-pages.mjs";

test("shared exploratory viewer emits one reusable view-state layer", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "project-map-view-state-"));
  try {
    await buildPublicPages(outputDir);
    const html = await readFile(join(outputDir, "u", "index.html"), "utf8");
    const dedicated = await readFile(join(outputDir, "tree", "index.html"), "utf8");
    const runtime = await readFile(join(outputDir, "view-state.js"), "utf8");

    for (const status of ["original", "fork", "archived"]) assert.ok(html.includes(`data-status-filter="${status}"`));
    assert.ok(html.includes('id="motionToggle"'));
    assert.ok(html.includes('id="activityToggle"'));
    assert.ok(html.includes('data-focus-depth="1"'));
    assert.ok(html.includes('data-focus-depth="3"'));
    assert.ok(html.includes('id="shareView"'));
    assert.ok(html.includes('id="focusButton"'));
    assert.ok(html.indexOf('../viewer.js') < html.indexOf('../view-state.js'));
    assert.ok(!dedicated.includes('data-status-filter="original"'));
    assert.doesNotThrow(() => new Function(runtime));
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("focus depth traverses repository relations only", async () => {
  const source = await readFile(new URL("../scripts/public-view-state.js", import.meta.url), "utf8");

  assert.match(source, /\["relation", "semantic"\]\.includes\(edge\?\.type\)/);
  assert.match(source, /edge\?\.type === "membership" && repositoryIds\.has\(edge\.target\)/);
  assert.match(source, /current\.depth >= focusDepth/);
  assert.match(source, /Math\.max\(1, Math\.min\(3,/);
  assert.doesNotMatch(source, /adjacency[^\n]*membership/);
});

test("motion stays in view-state while Activity rendering stays in the canonical render adapter", async () => {
  const viewState = await readFile(new URL("../scripts/public-view-state.js", import.meta.url), "utf8");
  const renderAdapter = await readFile(new URL("../scripts/public-tree-router.js", import.meta.url), "utf8");

  assert.match(viewState, /\(prefers-reduced-motion: reduce\)/);
  assert.match(viewState, /target\.matches \|\| userMotionOff/);
  assert.match(renderAdapter, /node\.updatedAt/);
  assert.match(renderAdapter, /state\.graph\?\.generatedAt/);
  assert.doesNotMatch(viewState, /drawEdges|drawNodesAndLabels|hitTest|worldToScreen|nodeRadius/);
  assert.doesNotMatch(viewState, /fetch\(/);
  assert.doesNotMatch(renderAdapter, /fetch\(/);
});

test("style routing preserves semantic view parameters", async () => {
  for (const path of ["../scripts/public-tree-router.js", "../scripts/public-tree-nav.js"]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /currentUrl\.searchParams/);
    assert.match(source, /key === "style" \|\| key === "username"/);
    assert.match(source, /url\.searchParams\.append\(key, value\)/);
  }
});