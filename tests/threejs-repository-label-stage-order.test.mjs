import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const stages = packageJson.scripts["build:pages"].split(" && ");
const categoryAdapter = await readFile(new URL("../scripts/apply-threejs-category-navigator.mjs", import.meta.url), "utf8");

function callIndex(fragment) {
  const index = categoryAdapter.indexOf(fragment);
  assert.notEqual(index, -1, `${fragment} must remain explicit in the combined Category Navigator stage`);
  return index;
}

test("Three.js Category Navigator composes repository labels before later stages", () => {
  assert.equal(
    stages.includes("node scripts/apply-threejs-repository-labels.mjs"),
    false,
    "repository labels must not return as a standalone post-build stage",
  );

  const categoryStage = stages.indexOf("node scripts/apply-threejs-category-navigator.mjs");
  const dimensionStage = stages.indexOf("node scripts/apply-view-dimension-toggle.mjs");
  assert.ok(categoryStage >= 0, "combined Category Navigator stage must remain in build:pages");
  assert.ok(dimensionStage > categoryStage, "combined category/label composition must finish before the dimension toggle stage");

  const categoryRuntime = callIndex("composeThreejsCategoryNavigatorRuntime(runtime)");
  const labelRuntime = callIndex("composeThreejsRepositoryLabelsRuntime(navigatorRuntime)");
  const categoryPage = callIndex("composeThreejsCategoryNavigatorPage(page)");
  const labelPage = callIndex("composeThreejsRepositoryLabelsPage(navigatorPage)");
  assert.ok(labelRuntime > categoryRuntime, "repository-label runtime composition must follow Category Navigator runtime composition");
  assert.ok(labelPage > categoryPage, "repository-label page composition must follow Category Navigator page composition");

  assert.match(categoryAdapter, /public-threejs-repository-labels\.css/);
  assert.match(packageJson.scripts["check:pages"], /apply-threejs-repository-labels\.mjs/);
});
