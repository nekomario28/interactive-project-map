import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildPublicPages } from "../scripts/build-public-pages.mjs";

test("exploratory view state is emitted after the base viewer", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "project-map-view-state-"));
  try {
    await buildPublicPages(outputDir);
    const html = await readFile(join(outputDir, "u", "index.html"), "utf8");
    const runtime = await readFile(join(outputDir, "view-state.js"), "utf8");

    assert.ok(html.includes('data-status-filter="original"'));
    assert.ok(html.includes('data-status-filter="fork"'));
    assert.ok(html.includes('data-status-filter="archived"'));
    assert.ok(html.includes('id="motionToggle"'));
    assert.ok(html.includes('id="activityToggle"'));
    assert.ok(html.includes('data-focus-depth="1"'));
    assert.ok(html.includes('data-focus-depth="3"'));
    assert.ok(html.includes('id="shareView"'));
    assert.ok(html.indexOf('../viewer.js') < html.indexOf('../view-state.js'));
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

test("motion reuses the existing reduced-motion contract", async () => {
  const source = await readFile(new URL("../scripts/public-view-state.js", import.meta.url), "utf8");

  assert.match(source, /\(prefers-reduced-motion: reduce\)/);
  assert.match(source, /target\.matches \|\| userMotionOff/);
  assert.match(source, /window\.ProjectMapViewState/);
});
