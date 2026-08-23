import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEDICATED_CONTRIBUTED_MODES,
  patchDedicatedViewerRuntime,
} from "../scripts/apply-contributed-dedicated-viewers.mjs";

for (const mode of DEDICATED_CONTRIBUTED_MODES) {
  test(`C4b ${mode} installs strict Contributed runtime before startup`, async () => {
    const source = await readFile(new URL(`../scripts/public-${mode}-viewer.js`, import.meta.url), "utf8");
    const patched = patchDedicatedViewerRuntime(source, mode);
    const marker = patched.indexOf("Project Map Contributed dedicated-viewer contract");
    const startup = patched.indexOf("function showError");

    assert.ok(marker >= 0 && marker < startup);
    assert.match(patched, /raw\.relation !== "contributed"/);
    assert.match(patched, /commits === 0 && mergedPullRequests === 0/);
    assert.match(patched, /repositoryOwner/);
    assert.match(patched, /repositoryName/);
    assert.match(patched, /owner\.toLowerCase\(\) === String\(projectOwner\)\.toLowerCase\(\)/);
    assert.match(patched, /id !== "repository:" \+ fullName\.toLowerCase\(\)/);
    assert.match(patched, /parts\.length !== 2/);
    assert.match(patched, /contributedRepositoryCount/);
    assert.match(patched, /repo\?\.relation === "contributed"/);
    assert.match(patched, /contributed: "#55c7d7"/);
    assert.match(patched, /External owner/);
    assert.match(patched, /ProjectMapContributedDedicatedViewer/);
    assert.equal(patchDedicatedViewerRuntime(patched, mode), patched);
  });
}

test("C4b category-only layouts project Contributed into presentation-only external context", async () => {
  for (const mode of ["timeline", "cluster", "sunburst", "matrix", "sankey"]) {
    const source = await readFile(new URL(`../scripts/public-${mode}-viewer.js`, import.meta.url), "utf8");
    const patched = patchDedicatedViewerRuntime(source, mode);
    assert.match(patched, /External contributions/);
    assert.match(patched, /projectedNodes/);
    assert.match(patched, /return baseBuildLayout\(\{ \.\.\.graph, nodes: projectedNodes \}\)/);
  }
});

test("C4b Matrix composition has a fourth Contributed bucket", async () => {
  const source = await readFile(new URL("../scripts/public-matrix-viewer.js", import.meta.url), "utf8");
  const patched = patchDedicatedViewerRuntime(source, "matrix");
  assert.match(patched, /counts=\{original:0,fork:0,archived:0,contributed:0\}/);
  assert.match(patched, /\["original","fork","archived","contributed"\]/);
});

test("C4b Sankey exposes Contributed as a fourth status and marks external source flow", async () => {
  const source = await readFile(new URL("../scripts/public-sankey-viewer.js", import.meta.url), "utf8");
  const patched = patchDedicatedViewerRuntime(source, "sankey");
  assert.match(patched, /counts=\{original:0,fork:0,archived:0,contributed:0\}/);
  assert.match(patched, /const statuses=\["original","fork","archived","contributed"\]/);
  assert.match(patched, /statuses\.length-1/);
  assert.match(patched, /group\.group\?\.relation==="contributed"\?c\.contributed:c\.group/);
});
