import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  patchGalaxyContributedRendering,
  patchObsidianContributedRendering,
  patchSharedContributedRendering,
} from "../scripts/apply-contributed-render-sync.mjs";
import { CONTRIBUTED_DARK } from "../scripts/static-contributed.mjs";

const sourceDir = new URL("../scripts/", import.meta.url);

test("shared interactive renderer keeps Contributed primary over archived source flags", async () => {
  const source = await readFile(new URL("public-viewer.js", sourceDir), "utf8");
  const patched = patchSharedContributedRendering(source);
  assert.match(patched, /node\?\.relation === "contributed"\) opacity \*= 0\.96/);
  assert.match(patched, /node\.archived && node\.relation !== "contributed"/);
});

test("Obsidian suppresses archived decoration when Contributed is the primary status", async () => {
  const source = await readFile(new URL("public-obsidian-runtime.js", sourceDir), "utf8");
  const patched = patchObsidianContributedRendering(source);
  assert.match(patched, /node\.archived && node\.relation !== "contributed"/);
  assert.match(patched, /ctx\.fillStyle = nodeColor\(node, colors\)/);
  assert.match(patched, /const opacity = nodeOpacity\(node\)/);
  assert.doesNotMatch(patched, /if \(node\.type === "repository" && node\.archived\) \{/);
});

for (const [mode, file] of [
  ["classic", "public-galaxy-classic.js"],
  ["systems", "public-galaxy-systems.js"],
]) {
  test(`Galaxy ${mode} uses the shared Contributed palette entry for actual repository fill`, async () => {
    const source = await readFile(new URL(file, sourceDir), "utf8");
    const patched = patchGalaxyContributedRendering(source, mode);
    assert.match(patched, /contributedPrimary \? colors\.contributed/);
    assert.match(patched, /contributedPrimary \? 0\.96 : node\.archived \? 0\.72 : 1/);
    assert.match(patched, /node\.archived && !contributedPrimary/);
    assert.doesNotMatch(patched, /node\.type === "group" \? colors\.group : node\.archived \? colors\.archived : node\.fork \? colors\.fork : colors\.original/);
  });
}

test("interactive and static surfaces retain the same dark Contributed identity", async () => {
  const emphasis = await readFile(new URL("public-contributed-emphasis.js", sourceDir), "utf8");
  assert.equal(CONTRIBUTED_DARK, "#E69F00");
  assert.match(emphasis, new RegExp(CONTRIBUTED_DARK.replace("#", "#"), "i"));
});
