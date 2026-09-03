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

function assertCanonicalCsp(html, label) {
  assert.doesNotMatch(html, /frame-ancestors\s+'none'/, `${label} must not require postprocess CSP cleanup`);
  assert.match(html, /style-src\s+'self'\s+'unsafe-inline'/, `${label} must emit the qualified final style-src policy`);
}

test("public builder owns final runtime script order and CSP before postprocess validation", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-runtime-script-layout-"));
  try {
    await buildPublicPages(root);

    const sharedPath = join(root, "u", "index.html");
    const sharedBefore = await readFile(sharedPath, "utf8");
    assert.deepEqual(scriptSources(sharedBefore), SHARED_SCRIPT_ORDER);
    assertCanonicalCsp(sharedBefore, "shared viewer");

    const dedicatedBefore = new Map();
    for (const route of DEDICATED_ROUTES) {
      const html = await readFile(join(root, route, "index.html"), "utf8");
      const expected = ["tree-nav.js", `${route}-viewer.js`, ...DEDICATED_TAIL];
      assert.deepEqual(scriptSources(html), expected, `${route} builder script order drifted`);
      assertCanonicalCsp(html, route);
      dedicatedBefore.set(route, html);
    }

    await postprocessPublicPages(root);

    const sharedAfter = await readFile(sharedPath, "utf8");
    assert.equal(sharedAfter, sharedBefore, "postprocess validation must not mutate the shared page");

    for (const route of DEDICATED_ROUTES) {
      const html = await readFile(join(root, route, "index.html"), "utf8");
      assert.equal(html, dedicatedBefore.get(route), `${route} postprocess validation must be byte-preserving`);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
