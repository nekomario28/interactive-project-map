import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const postprocess = await readFile(new URL("../scripts/postprocess-public-pages.mjs", import.meta.url), "utf8");

test("postprocess keeps retired generated-runtime ownership out of its boundary", () => {
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
    "copyFile",
  ]) {
    assert.doesNotMatch(postprocess, new RegExp(retiredMarker.replaceAll(".", "\\.")), `${retiredMarker} must remain retired from postprocess`);
  }

  assert.match(postprocess, /export const PUBLIC_ACTION_REF = PROJECT_MAP_ACTION_REF;/);
  assert.match(postprocess, /await attachGalaxyRuntimes\(outputDir\);/);
  assert.match(postprocess, /await attachInteractionPolish\(outputDir\);/);
  assert.match(postprocess, /frame-ancestors/);
  assert.match(postprocess, /style-src/);
});
