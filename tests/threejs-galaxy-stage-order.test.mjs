import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const stages = packageJson.scripts["build:pages"].split(" && ");
const styleAdapter = await readFile(new URL("../scripts/apply-threejs-style-presets.mjs", import.meta.url), "utf8");

function stageIndex(scriptName) {
  const index = stages.findIndex((stage) => stage === `node scripts/${scriptName}`);
  assert.notEqual(index, -1, `${scriptName} must remain explicit in build:pages until its invocation is canonically relocated`);
  return index;
}

test("Three.js Galaxy style → motion → pattern composition remains explicit after standalone stage retirement", () => {
  stageIndex("apply-threejs-style-presets.mjs");

  assert.equal(
    stages.includes("node scripts/apply-threejs-galaxy-motion.mjs"),
    false,
    "Galaxy motion must not return as a standalone post-build stage",
  );
  assert.equal(
    stages.includes("node scripts/apply-threejs-galaxy-central-bulge.mjs"),
    false,
    "Galaxy pattern coupling must not return as a standalone post-build stage",
  );

  const styleCall = styleAdapter.indexOf("composeThreejsStyleRuntime(source)");
  const motionCall = styleAdapter.indexOf("composeThreejsGalaxyMotionRuntime(styledRuntime)");
  const patternCall = styleAdapter.indexOf("composeThreejsGalaxyPatternCouplingRuntime(motionRuntime)");
  assert.ok(styleCall >= 0, "style adapter must invoke the canonical style composer");
  assert.ok(motionCall > styleCall, "Galaxy motion must compose after the style runtime surface is established");
  assert.ok(patternCall > motionCall, "Galaxy pattern coupling must compose after the final Galaxy motion contract");
});
