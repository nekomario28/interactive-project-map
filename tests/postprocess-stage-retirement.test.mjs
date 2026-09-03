import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const postprocess = await readFile(new URL("../scripts/postprocess-public-pages.mjs", import.meta.url), "utf8");

test("read-only Pages postprocess is retired from active build execution", () => {
  const build = packageJson.scripts?.["build:pages"] || "";
  const stages = build.split(/\s*&&\s*/).filter(Boolean);
  assert.equal(stages[0], "node scripts/build-public-pages.mjs");
  assert.equal(stages[1], "node scripts/apply-contributed-render-sync.mjs");
  assert.doesNotMatch(build, /node scripts\/postprocess-public-pages\.mjs/);
  assert.ok(stages.length - 1 <= 13, "active post-build stage count must not grow above the postprocess-retirement baseline");

  // Keep the validator available to focused tests and syntax checking even though
  // production build execution no longer needs this no-op boundary.
  assert.match(packageJson.scripts?.["check:pages"] || "", /node --check scripts\/postprocess-public-pages\.mjs/);
  assert.match(postprocess, /export async function postprocessPublicPages/);
  assert.doesNotMatch(postprocess, /writeFile/);
});
