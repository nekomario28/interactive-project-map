import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const stages = packageJson.scripts["build:pages"].split(" && ");

function stageIndex(scriptName) {
  const index = stages.findIndex((stage) => stage === `node scripts/${scriptName}`);
  assert.notEqual(index, -1, `${scriptName} must remain explicit in build:pages until its invocation is canonically relocated`);
  return index;
}

test("Three.js Galaxy style, motion, and haze composition order is explicit", () => {
  const style = stageIndex("apply-threejs-style-presets.mjs");
  const motion = stageIndex("apply-threejs-galaxy-motion.mjs");
  const haze = stageIndex("apply-threejs-galaxy-central-bulge.mjs");

  assert.ok(style < motion, "Galaxy motion currently consumes the style-preset runtime surface");
  assert.ok(motion < haze, "arm haze/pattern coupling must observe the final Galaxy motion pattern contract");
});
