import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const bootstrapStage = await readFile(new URL("../scripts/apply-2d-runtime-bootstrap-gate.mjs", import.meta.url), "utf8");

test("renderer snapshot composes into the final bootstrap stage before 2D gating", () => {
  const build = packageJson.scripts?.["build:pages"] || "";
  const stages = build.split(/\s*&&\s*/).filter(Boolean);

  assert.equal(stages[0], "node scripts/build-public-pages.mjs");
  assert.equal(stages.at(-1), "node scripts/apply-2d-runtime-bootstrap-gate.mjs");
  assert.doesNotMatch(build, /node scripts\/apply-renderer-snapshot\.mjs/);
  assert.ok(stages.length - 1 <= 12, "active post-build stage count must not grow above the renderer-snapshot-retirement baseline");

  assert.match(bootstrapStage, /patchTwoDRendererSnapshot/);
  assert.match(bootstrapStage, /patchThreeDRendererSnapshot/);
  const snapshotIndex = bootstrapStage.indexOf("await applyRendererSnapshotBeforeBootstrap(root);");
  const gateIndex = bootstrapStage.indexOf("for (const file of TWO_D_VIEWER_FILES)");
  assert.ok(snapshotIndex >= 0 && gateIndex > snapshotIndex, "renderer snapshot must compose before the final 2D bootstrap gate");

  // Keep the old adapter as a syntax-checked compatibility surface, not an active build stage.
  assert.match(packageJson.scripts?.["check:pages"] || "", /node --check scripts\/apply-renderer-snapshot\.mjs/);
});
