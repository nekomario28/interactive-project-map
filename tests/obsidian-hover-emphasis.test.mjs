import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildPublicPages } from "../scripts/build-public-pages.mjs";
import { postprocessPublicPages } from "../scripts/postprocess-public-pages.mjs";

const sourceUrl = new URL("../scripts/public-obsidian-hover.js", import.meta.url);

test("Obsidian hover reuses selected-focus rendering without persistent selection mutation", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /const baseNodeOpacity = nodeOpacity;/);
  assert.match(source, /const baseDrawEdges = drawEdges;/);
  assert.match(source, /function activeHoverFocus\(\)/);
  assert.match(source, /state\.style !== "obsidian" \|\| state\.selected \|\| !state\.hovered/);
  assert.match(source, /function withHoverAsSelection\(callback\)/);
  assert.match(source, /state\.selected = focus;/);
  assert.match(source, /try \{/);
  assert.match(source, /finally \{\s*state\.selected = selected;/);
  assert.match(source, /nodeOpacity = function obsidianHoverNodeOpacity/);
  assert.match(source, /drawEdges = function obsidianHoverDrawEdges/);
  assert.match(source, /window\.ProjectMapObsidianHover/);
  assert.doesNotMatch(source, /0\.16|0\.22|0\.28|0\.72/);

  const checked = spawnSync(process.execPath, ["--check", new URL(sourceUrl).pathname], { encoding: "utf8" });
  assert.equal(checked.status, 0, checked.stderr);

  const dir = await mkdtemp(join(tmpdir(), "project-map-obsidian-hover-"));
  try {
    await buildPublicPages(dir);
    await postprocessPublicPages(dir);
    const html = await readFile(join(dir, "u", "index.html"), "utf8");
    const emitted = await readFile(join(dir, "obsidian-hover.js"), "utf8");
    assert.match(html, /obsidian-runtime\.js[\s\S]*interaction-polish\.js[\s\S]*obsidian-hover\.js[\s\S]*adaptive-labels\.js/);
    assert.equal(emitted, source);
    const emittedCheck = spawnSync(process.execPath, ["--check", join(dir, "obsidian-hover.js")], { encoding: "utf8" });
    assert.equal(emittedCheck.status, 0, emittedCheck.stderr);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
