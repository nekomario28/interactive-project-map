import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildPublicPages } from "../scripts/build-public-pages.mjs";
import { postprocessPublicPages } from "../scripts/postprocess-public-pages.mjs";

const viewerSourcePath = new URL("../scripts/public-viewer.js", import.meta.url);

test("Obsidian initial viewport stays neutral while explicit Fit and Galaxy auto-fit remain available", async () => {
  const source = await readFile(viewerSourcePath, "utf8");
  assert.match(source, /if \(fit && state\.style === "obsidian"\)/);
  assert.match(source, /state\.zoom = 1;/);
  assert.match(source, /state\.pan\.x = 0;/);
  assert.match(source, /state\.pan\.y = 0;/);
  assert.match(source, /state\.fitted = true;/);
  assert.match(source, /else if \(fit\) \{\s*fitView\(\);/);
  assert.match(source, /fitButton\.addEventListener\("click", fitView\)/);
  assert.match(source, /event\.key === "0"[\s\S]*fitView\(\)/);
  assert.doesNotMatch(source, /state\.zoom = 1 \/ devicePixelRatio|state\.zoom = 1 \/ dpr/);

  const dir = await mkdtemp(join(tmpdir(), "project-map-obsidian-viewport-"));
  try {
    await buildPublicPages(dir);
    await postprocessPublicPages(dir);
    const viewer = await readFile(join(dir, "viewer.js"), "utf8");
    assert.match(viewer, /if \(fit && state\.style === "obsidian"\)/);
    assert.match(viewer, /state\.zoom = 1;[\s\S]*state\.pan\.x = 0;[\s\S]*state\.pan\.y = 0;[\s\S]*state\.fitted = true;/);
    assert.match(viewer, /else if \(fit\) \{\s*fitView\(\);/);
    assert.match(viewer, /fitButton\.addEventListener\("click", fitView\)/);
    assert.match(viewer, /event\.key === "0"[\s\S]*fitView\(\)/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
