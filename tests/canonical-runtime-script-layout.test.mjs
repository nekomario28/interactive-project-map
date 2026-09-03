import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { buildPublicPages } from "../scripts/build-public-pages.mjs";
import { postprocessPublicPages } from "../scripts/postprocess-public-pages.mjs";

const SHARED_SCRIPT_ORDER = [
  "tree-router.js",
  "viewer.js",
  "galaxy-common.js",
  "galaxy-classic-runtime.js",
  "galaxy-systems-runtime.js",
  "galaxy-hybrid-runtime.js",
  "spatial-core-runtime.js",
  "obsidian-runtime.js",
  "galaxy-edge-policy.js",
  "interaction-polish.js",
  "obsidian-hover.js",
  "adaptive-labels.js",
  "view-state.js",
];
const DEDICATED_ROUTES = ["radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"];
const DEDICATED_TAIL = ["spatial-core-runtime.js", "interaction-polish.js", "search-emphasis.js"];

function scriptSources(html) {
  return [...html.matchAll(/<script src="\.\.\/([^"?]+)" defer><\/script>/g)].map((match) => match[1]);
}

test("public builder owns the final shared and dedicated runtime script order", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-runtime-script-layout-"));
  try {
    await buildPublicPages(root);

    const sharedPath = join(root, "u", "index.html");
    const sharedBefore = await readFile(sharedPath, "utf8");
    assert.deepEqual(scriptSources(sharedBefore), SHARED_SCRIPT_ORDER);
    assert.match(sharedBefore, /frame-ancestors\s+'none'/);

    const dedicatedBefore = new Map();
    for (const route of DEDICATED_ROUTES) {
      const html = await readFile(join(root, route, "index.html"), "utf8");
      const expected = ["tree-nav.js", `${route}-viewer.js`, ...DEDICATED_TAIL];
      assert.deepEqual(scriptSources(html), expected, `${route} builder script order drifted`);
      dedicatedBefore.set(route, scriptSources(html));
    }

    await postprocessPublicPages(root);

    const sharedAfter = await readFile(sharedPath, "utf8");
    assert.deepEqual(scriptSources(sharedAfter), SHARED_SCRIPT_ORDER);
    assert.doesNotMatch(sharedAfter, /frame-ancestors\s+'none'/);

    for (const route of DEDICATED_ROUTES) {
      const html = await readFile(join(root, route, "index.html"), "utf8");
      assert.deepEqual(scriptSources(html), dedicatedBefore.get(route), `${route} postprocess must not mutate script layout`);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
