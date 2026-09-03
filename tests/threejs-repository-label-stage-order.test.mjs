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

test("Three.js search stage composes Local Graph, Category Navigator and repository labels before later stages", () => {
  assert.equal(
    stages.includes("node scripts/apply-threejs-local-graph.mjs"),
    false,
    "Local Graph must not return as a standalone post-build stage",
  );
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
  assert.ok(searchStage >= 0, "combined Local Graph/search/category/label stage must remain in build:pages");
  assert.ok(dimensionStage > searchStage, "combined Local Graph/search/category/label composition must finish before dimension toggle");

  const localRuntime = callIndex("patchThreejsLocalGraphRuntime(runtime)");
  const searchRuntime = callIndex("patchThreejsSearchContextRuntime(localRuntime)");
  const categoryRuntime = callIndex("composeThreejsCategoryNavigatorRuntime(searchRuntime)");
  const labelRuntime = callIndex("composeThreejsRepositoryLabelsRuntime(navigatorRuntime)");
  const localPage = callIndex("patchThreejsLocalGraphPage(page)");
  const categoryPage = callIndex("composeThreejsCategoryNavigatorPage(localPage)");
  const labelPage = callIndex("composeThreejsRepositoryLabelsPage(navigatorPage)");
  assert.ok(searchRuntime > localRuntime, "shared search runtime composition must follow Local Graph");
  assert.ok(categoryRuntime > searchRuntime, "Category Navigator runtime composition must follow shared search");
  assert.ok(labelRuntime > categoryRuntime, "repository-label runtime composition must follow Category Navigator");
  assert.ok(categoryPage > localPage, "Category Navigator page composition must follow Local Graph page state");
  assert.ok(labelPage > categoryPage, "repository-label page composition must follow Category Navigator page composition");

  assert.match(searchAdapter, /public-threejs-category-navigator\.js/);
  assert.match(searchAdapter, /public-threejs-repository-labels\.css/);
  assert.match(packageJson.scripts["check:pages"], /apply-threejs-local-graph\.mjs/);
  assert.match(packageJson.scripts["check:pages"], /apply-threejs-category-navigator\.mjs/);
  assert.match(packageJson.scripts["check:pages"], /apply-threejs-repository-labels\.mjs/);
});
