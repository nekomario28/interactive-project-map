import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildPagesApp, renderPagesHome, renderPagesViewer } from "../scripts/pages-app.mjs";

test("Pages generator emits distributed static installation URLs and isolated permissions", () => {
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

test("universal Pages viewer reads only the user's static graph in the normal path", () => {
  const html = renderPagesViewer();
  assert.match(html, /raw\.githubusercontent\.com/);
  assert.match(html, /HEAD\/project-map\/graph\.json/);
  assert.match(html, /sanitizeGraph/);
  assert.match(html, /u\.hostname!==['"]github\.com['"]/);
  assert.doesNotMatch(html, /\/api\/graph/);
  assert.doesNotMatch(html, /api\.github\.com/);
});

test("Pages build produces a root generator and query-driven universal viewer", async () => {
  const dir = await mkdtemp(join(tmpdir(), "project-map-pages-"));
  try {
    await buildPagesApp(dir);
    const home = await readFile(join(dir, "index.html"), "utf8");
    const viewer = await readFile(join(dir, "u", "index.html"), "utf8");
    const noJekyll = await readFile(join(dir, ".nojekyll"), "utf8");
    assert.match(home, /Create your map/);
    assert.match(viewer, /Interactive Project Map/);
    assert.equal(noJekyll, "\n");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
