import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const stages = packageJson.scripts["build:pages"].split(" && ");
const dimensionAdapter = await readFile(new URL("../scripts/apply-view-dimension-toggle.mjs", import.meta.url), "utf8");

function stageIndex(scriptName) {
  const index = stages.findIndex((stage) => stage === `node scripts/${scriptName}`);
  assert.notEqual(index, -1, `${scriptName} must remain explicit in build:pages`);
  return index;
}

test("Three.js dimension → style → motion → pattern composition remains explicit after standalone style retirement", () => {
  stageIndex("apply-view-dimension-toggle.mjs");
  assert.equal(stages.length - 1, 10, "active post-build stage count must be 10 after Local Graph stage retirement");

  for (const retired of [
    "apply-threejs-style-presets.mjs",
    "apply-threejs-galaxy-motion.mjs",
    "apply-threejs-galaxy-central-bulge.mjs",
  ]) {
    assert.equal(stages.includes(`node scripts/${retired}`), false, `${retired} must not return as a standalone post-build stage`);
  }

  assert.match(
    dimensionAdapter,
    /const dimensionHtml = patchThreeDViewDimension\(threeHtml\);[\s\S]*const composed = composeThreejsPresentationAfterDimension\(threeRuntime, dimensionHtml\);/,
    "Three.js presentation composition must consume the already-established dimension page",
  );
  const styleCall = dimensionAdapter.indexOf("composeThreejsStyleRuntime(runtime)");
  const motionCall = dimensionAdapter.indexOf("composeThreejsGalaxyMotionRuntime(styledRuntime)");
  const patternCall = dimensionAdapter.indexOf("composeThreejsGalaxyPatternCouplingRuntime(motionRuntime)");
  assert.ok(styleCall >= 0, "combined dimension stage must invoke the canonical style composer");
  assert.ok(motionCall > styleCall, "Galaxy motion must compose after the style runtime surface is established");
  assert.ok(patternCall > motionCall, "Galaxy pattern coupling must compose after the final Galaxy motion contract");

  // Keep the old style adapter available for focused compatibility tests, not active execution.
  assert.match(packageJson.scripts?.["check:pages"] || "", /node --check scripts\/apply-threejs-style-presets\.mjs/);
});
