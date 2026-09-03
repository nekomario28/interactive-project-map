import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const systems = await readFile(new URL("../scripts/public-galaxy-systems.js", import.meta.url), "utf8");
const postprocess = await readFile(new URL("../scripts/postprocess-public-pages.mjs", import.meta.url), "utf8");

test("Galaxy Systems owns its adopted runtime identity and motion policy canonically", () => {
  assert.match(systems, /window\.addEventListener\("DOMContentLoaded", \(\) => \{\n  if \(state\.style !== "galaxy-systems"\) return;/);
  assert.equal((systems.match(/"galaxy-systems"/g) || []).length, 7);
  assert.doesNotMatch(systems, /"galaxy"/);

  assert.match(systems, /const direction = \(hash\(`\$\{group\.id\}:orbit-direction`\) & 1\) === 0 \? 1 : -1;/);
  assert.match(systems, /const period = 360 \+ lane \* 180;/);
  assert.doesNotMatch(systems, /const direction = lane % 2 === 0 \? 1 : -1;/);
  assert.doesNotMatch(systems, /const period = 128 \+ lane \* 54;/);

  assert.match(systems, /for \(const category of runtime\.categories\.values\(\)\) \{\n      category\.angle \+= tau \* dt \/ \(1800 \* 1000\);/);
  assert.match(systems, /category\.node\.x = Math\.cos\(category\.angle\) \* category\.categoryRadius;/);
  assert.match(systems, /category\.node\.y = Math\.sin\(category\.angle\) \* category\.categoryRadius;/);
  assert.match(systems, /Galaxy Systems · slow category orbit · repositories orbit locally/);
  assert.doesNotMatch(systems, /Living Galaxy Systems · categories are hubs · repositories orbit their category/);
});

test("Pages postprocess emits canonical Galaxy Systems without semantic string patching", () => {
  assert.doesNotMatch(postprocess, /function tuneSystemsRuntime/);
  assert.doesNotMatch(postprocess, /orbit-direction/);
  assert.doesNotMatch(postprocess, /360 \+ lane \* 180/);
  assert.doesNotMatch(postprocess, /1800 \* 1000/);
  assert.doesNotMatch(postprocess, /Living Galaxy Systems · categories are hubs · repositories orbit their category/);
  assert.match(postprocess, /copyFile\(join\(sourceDir, "public-galaxy-systems\.js"\), join\(outputDir, "galaxy-systems-runtime\.js"\)\)/);
});
