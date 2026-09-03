import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const stages = packageJson.scripts["build:pages"].split(" && ");
const searchAdapter = await readFile(new URL("../scripts/apply-threejs-search-context.mjs", import.meta.url), "utf8");

function callIndex(fragment) {
  const index = searchAdapter.indexOf(fragment);
  assert.notEqual(index, -1, `${fragment} must remain explicit in the combined search stage`);
  return index;
}

test("Three.js search stage composes Category Navigator and repository labels before later stages", () => {
  assert.equal(
    stages.includes("node scripts/apply-threejs-category-navigator.mjs"),
    false,
    "Category Navigator must not return as a standalone post-build stage",
  );
  assert.equal(
    stages.includes("node scripts/apply-threejs-repository-labels.mjs"),
    false,
    "repository labels must not return as a standalone post-build stage",
  );

  const searchStage = stages.indexOf("node scripts/apply-threejs-search-context.mjs");
  const dimensionStage = stages.indexOf("node scripts/apply-view-dimension-toggle.mjs");
  assert.ok(searchStage >= 0, "combined search/category/label stage must remain in build:pages");
  assert.ok(dimensionStage > searchStage, "combined search/category/label composition must finish before dimension toggle");

  const searchRuntime = callIndex("patchThreejsSearchContextRuntime(runtime)");
  const categoryRuntime = callIndex("composeThreejsCategoryNavigatorRuntime(searchRuntime)");
  const labelRuntime = callIndex("composeThreejsRepositoryLabelsRuntime(navigatorRuntime)");
  const categoryPage = callIndex("composeThreejsCategoryNavigatorPage(page)");
  const labelPage = callIndex("composeThreejsRepositoryLabelsPage(navigatorPage)");
  assert.ok(categoryRuntime > searchRuntime, "Category Navigator runtime composition must follow shared search");
  assert.ok(labelRuntime > categoryRuntime, "repository-label runtime composition must follow Category Navigator");
  assert.ok(labelPage > categoryPage, "repository-label page composition must follow Category Navigator page composition");

  assert.match(searchAdapter, /public-threejs-category-navigator\.js/);
  assert.match(searchAdapter, /public-threejs-repository-labels\.css/);
  assert.match(packageJson.scripts["check:pages"], /apply-threejs-category-navigator\.mjs/);
  assert.match(packageJson.scripts["check:pages"], /apply-threejs-repository-labels\.mjs/);
});
