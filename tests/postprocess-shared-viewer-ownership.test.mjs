import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const postprocess = await readFile(new URL("../scripts/postprocess-public-pages.mjs", import.meta.url), "utf8");

test("postprocess remains a read-only canonical-output validator", () => {
  for (const retiredMarker of [
    "MOBILE_FIX",
    "VIEWER_FIT_OLD",
    "VIEWER_FIT_NEW",
    "VIEWER_AUTO_FIT_OLD",
    "VIEWER_AUTO_FIT_NEW",
    "patchViewerStyles",
    "hardenSharedViewer",
    "Emitted-site mobile hardening",
    "BUILDER_ACTION_REF",
    "app.replaceAll",
    "emitSpatialCoreRuntime",
    "spatialCoreRuntimeSource",
    "emitObsidianRuntime",
    "emitGalaxyRuntimes",
    "emitInteractionPolish",
    "attachGalaxyRuntimes",
    "attachInteractionPolish",
    "copyFile",
    "writeFile",
    "galaxy-common.js",
    "spatial-core-runtime.js",
    "interaction-polish.js",
    "search-emphasis.js",
  ]) {
    assert.doesNotMatch(postprocess, new RegExp(retiredMarker.replaceAll(".", "\\.")), `${retiredMarker} must remain retired from postprocess`);
  }

  assert.match(postprocess, /export const PUBLIC_ACTION_REF = PROJECT_MAP_ACTION_REF;/);
  assert.match(postprocess, /async function htmlFiles\(dir\)/);
  assert.match(postprocess, /Legacy frame-ancestors CSP reached postprocess/);
  assert.match(postprocess, /Non-canonical style-src CSP reached postprocess/);
});
