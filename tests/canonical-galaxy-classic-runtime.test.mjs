import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const classic = await readFile(new URL("../scripts/public-galaxy-classic.js", import.meta.url), "utf8");
const postprocess = await readFile(new URL("../scripts/postprocess-public-pages.mjs", import.meta.url), "utf8");

test("Galaxy Classic owns its runtime identity canonically", () => {
  assert.match(classic, /window\.addEventListener\("DOMContentLoaded", \(\) => \{\n  if \(state\.style !== "galaxy-classic"\) return;/);
  assert.equal((classic.match(/"galaxy-classic"/g) || []).length, 7);
  assert.doesNotMatch(classic, /"galaxy"/);
  assert.match(classic, /if \(state\.style !== "galaxy-classic" \|\| !state\.graph \|\| !state\.nodes\.length\) return false;/);
  assert.match(classic, /if \(state\.style === "galaxy-classic" && state\.graph && state\.nodes\.length\) \{/);
});

test("Pages postprocess emits canonical Galaxy Classic without identity string patching", () => {
  assert.doesNotMatch(postprocess, /function isolateRuntime/);
  assert.doesNotMatch(postprocess, /replaceAll\('\"galaxy\"'/);
  assert.match(postprocess, /copyFile\(join\(sourceDir, "public-galaxy-classic\.js"\), join\(outputDir, "galaxy-classic-runtime\.js"\)\)/);
  assert.doesNotMatch(postprocess, /classicTemplate/);
});
