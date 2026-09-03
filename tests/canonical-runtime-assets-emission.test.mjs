import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildPublicPages } from "../scripts/build-public-pages.mjs";
import { postprocessPublicPages } from "../scripts/postprocess-public-pages.mjs";

const ASSETS = Object.freeze([
  ["public-galaxy-common.js", "galaxy-common.js"],
  ["public-galaxy-classic.js", "galaxy-classic-runtime.js"],
  ["public-galaxy-hybrid.js", "galaxy-hybrid-runtime.js"],
  ["public-galaxy-systems.js", "galaxy-systems-runtime.js"],
  ["public-galaxy-edge-policy.js", "galaxy-edge-policy.js"],
  ["public-adaptive-labels.js", "adaptive-labels.js"],
  ["public-obsidian-runtime.js", "obsidian-runtime.js"],
  ["public-obsidian-hover.js", "obsidian-hover.js"],
  ["public-interaction-polish.js", "interaction-polish.js"],
  ["public-search-emphasis.js", "search-emphasis.js"],
]);

test("public builder emits canonical runtime assets byte-identically and postprocess does not rewrite them", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-runtime-assets-owner-"));
  try {
    await buildPublicPages(root);
    const before = new Map();
    for (const [source, target] of ASSETS) {
      const canonical = await readFile(new URL(`../scripts/${source}`, import.meta.url), "utf8");
      const emitted = await readFile(join(root, target), "utf8");
      assert.equal(emitted, canonical, `${target} must be emitted byte-identically by the builder`);
      before.set(target, emitted);
    }

    await postprocessPublicPages(root);
    for (const [, target] of ASSETS) {
      const emitted = await readFile(join(root, target), "utf8");
      assert.equal(emitted, before.get(target), `${target} must remain byte-identical through postprocess`);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
