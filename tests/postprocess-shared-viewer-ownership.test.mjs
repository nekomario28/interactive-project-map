import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const postprocess = await readFile(new URL("../scripts/postprocess-public-pages.mjs", import.meta.url), "utf8");

test("shared viewer behavior is no longer patched after canonical emission", () => {
  for (const retiredMarker of [
    "MOBILE_FIX",
    "VIEWER_FIT_OLD",
    "VIEWER_FIT_NEW",
    "VIEWER_AUTO_FIT_OLD",
    "VIEWER_AUTO_FIT_NEW",
    "patchViewerStyles",
    "hardenSharedViewer",
    "Emitted-site mobile hardening",
  ]) {
    assert.doesNotMatch(postprocess, new RegExp(retiredMarker), `${retiredMarker} must remain retired from postprocess`);
  }

  assert.match(postprocess, /await emitSpatialCoreRuntime\(outputDir\);/);
  assert.match(postprocess, /await emitObsidianRuntime\(outputDir\);/);
  assert.match(postprocess, /await emitGalaxyRuntimes\(outputDir\);/);
  assert.match(postprocess, /await emitInteractionPolish\(outputDir\);/);
  assert.match(postprocess, /app\.replaceAll\(BUILDER_ACTION_REF, PUBLIC_ACTION_REF\)/);
});
