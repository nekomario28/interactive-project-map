import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const threeJsRuntime = await readFile(new URL("../scripts/public-threejs-viewer.js", import.meta.url), "utf8");
const sharedCss = await readFile(new URL("../scripts/public-viewer.css", import.meta.url), "utf8");

test("Three.js details reuse the canonical has-selection contract", () => {
  assert.match(threeJsRuntime, /ui\.details\.classList\.add\("has-selection"\)/);
  assert.match(threeJsRuntime, /ui\.details\.classList\.remove\("has-selection"\)/);
  assert.doesNotMatch(threeJsRuntime, /ui\.details\.classList\.(?:add|remove)\("selected"\)/);
  assert.match(sharedCss, /\.details:not\(\.has-selection\)\s*\{\s*display:\s*none;/s);
});
