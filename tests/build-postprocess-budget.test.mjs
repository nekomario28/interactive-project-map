import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

const APPROVED_POSTBUILD_MUTATORS = new Set([
  "scripts/postprocess-public-pages.mjs",
  "scripts/apply-contributed-render-sync.mjs",
  "scripts/apply-dedicated-view-state.mjs",
  "scripts/apply-dedicated-contributed-render-sync.mjs",
  "scripts/apply-category-navigator.mjs",
  "scripts/apply-reactive-cosmic-background.mjs",
  "scripts/apply-quality-view.mjs",
  "scripts/apply-threejs-local-graph.mjs",
  "scripts/apply-threejs-search-context.mjs",
  "scripts/apply-threejs-category-navigator.mjs",
  "scripts/apply-threejs-repository-labels.mjs",
  "scripts/apply-view-dimension-toggle.mjs",
  "scripts/apply-threejs-style-presets.mjs",
  "scripts/apply-threejs-galaxy-motion.mjs",
  "scripts/apply-threejs-galaxy-central-bulge.mjs",
  "scripts/apply-threejs-local-engine.mjs",
  "scripts/apply-renderer-snapshot.mjs",
  "scripts/apply-2d-runtime-bootstrap-gate.mjs",
]);

const BASELINE_MUTATOR_COUNT = APPROVED_POSTBUILD_MUTATORS.size;

function buildStages() {
  const command = packageJson.scripts?.["build:pages"];
  assert.equal(typeof command, "string", "package.json must define scripts.build:pages");
  return command.split(/\s*&&\s*/).map((stage) => stage.trim()).filter(Boolean);
}

function nodeScriptPath(stage) {
  const match = /^node\s+(scripts\/[^\s]+)$/.exec(stage);
  return match?.[1] ?? null;
}

test("Pages post-build mutation debt cannot grow implicitly", () => {
  const stages = buildStages();
  assert.equal(stages[0], "node scripts/build-public-pages.mjs", "Pages build must start from the canonical builder");

  const postBuild = stages.slice(1).map(nodeScriptPath);
  assert.ok(postBuild.every(Boolean), "every post-build stage must be an explicit Node script");
  assert.equal(new Set(postBuild).size, postBuild.length, "post-build stages must not be duplicated");
  assert.ok(postBuild.length <= BASELINE_MUTATOR_COUNT, `post-build mutation count grew from the reviewed baseline ${BASELINE_MUTATOR_COUNT} to ${postBuild.length}`);

  const unreviewed = postBuild.filter((path) => !APPROVED_POSTBUILD_MUTATORS.has(path));
  assert.deepEqual(unreviewed, [], `new post-build mutators require explicit maintenance review: ${unreviewed.join(", ")}`);
});

test("the reviewed post-build budget is reduction-friendly", () => {
  const postBuild = buildStages().slice(1).map(nodeScriptPath);
  const retired = [...APPROVED_POSTBUILD_MUTATORS].filter((path) => !postBuild.includes(path));

  // Removing a reviewed mutator is always allowed. This assertion deliberately
  // documents the direction of travel without forcing obsolete stages to remain.
  assert.ok(postBuild.length + retired.length === BASELINE_MUTATOR_COUNT);
});
