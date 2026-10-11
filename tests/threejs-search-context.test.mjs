import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { buildThreejsLab } from "../scripts/build-threejs-lab.mjs";
import {
  applyThreejsSearchContext,
  patchThreejsSearchContextRuntime,
} from "../scripts/apply-threejs-search-context.mjs";

test("Three.js search stage composes Local Graph, search, Category Navigator and repository labels idempotently", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-three-search-context-"));
  try {
    await buildThreejsLab({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    const first = await applyThreejsSearchContext({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    assert.equal(first.injected, true);

    const [runtime, page, navigator, labelsCss] = await Promise.all([
      readFile(join(root, "threejs-viewer.js"), "utf8"),
      readFile(join(root, "three", "index.html"), "utf8"),
      readFile(join(root, "threejs-category-navigator.js"), "utf8"),
      readFile(join(root, "threejs-repository-labels.css"), "utf8"),
    ]);
    assert.equal((runtime.match(/IPM_THREEJS_LOCAL_GRAPH_P2/g) || []).length, 1);
    assert.equal((runtime.match(/IPM_THREEJS_SHARED_SEARCH_P2/g) || []).length, 1);
    assert.equal((runtime.match(/IPM_THREEJS_CATEGORY_NAVIGATOR_P2/g) || []).length, 1);
    assert.equal((runtime.match(/IPM_THREEJS_BOUNDED_REPOSITORY_LABELS_P2/g) || []).length, 1);
    assert.match(runtime, /ProjectMapThreejsLocalGraph/);
    assert.match(runtime, /ProjectMapViewModel\?\.projectSearchContext/);
    assert.match(runtime, /window\.ProjectMapSearchContext=Object\.freeze/);
    assert.match(runtime, /directSearchMeshes/);
    assert.match(runtime, /navigateDirectSearch/);
    assert.match(runtime, /event\.key==="ArrowDown"\|\|event\.key==="ArrowUp"/);
    assert.match(runtime, /window\.open\(node\.url,"_blank","noopener"\)/);
    assert.match(runtime, /appendSearchMatchReason/);
    assert.match(runtime, /lastSearchProjection/);
    assert.match(page, /id="focusButton"/);
    assert.match(page, /category-navigator\.css/);
    assert.match(page, /threejs-category-navigator\.js/);
    assert.match(page, /threejs-repository-labels\.css/);
    assert.match(navigator, /ProjectMapThreejsCategoryNavigator/);
    assert.match(labelsCss, /three-label-repository/);

    const syntax = spawnSync(process.execPath, ["--check", join(root, "threejs-viewer.js")], { encoding: "utf8" });
    assert.equal(syntax.status, 0, syntax.stderr);

    const second = await applyThreejsSearchContext({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    assert.equal(second.injected, false);
    const twice = await readFile(join(root, "threejs-viewer.js"), "utf8");
    assert.equal((twice.match(/IPM_THREEJS_LOCAL_GRAPH_P2/g) || []).length, 1);
    assert.equal((twice.match(/IPM_THREEJS_SHARED_SEARCH_P2/g) || []).length, 1);
    assert.equal((twice.match(/IPM_THREEJS_CATEGORY_NAVIGATOR_P2/g) || []).length, 1);
    assert.equal((twice.match(/IPM_THREEJS_BOUNDED_REPOSITORY_LABELS_P2/g) || []).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("pure shared-search patch still fails closed without canonical Local Graph input", () => {
  assert.throws(
    () => patchThreejsSearchContextRuntime("const rawThreejsRuntime = true;"),
    /Local Graph adapter must run before shared search context/,
  );
});

test("build order retires standalone Local Graph while preserving Local Graph before search inside the combined stage", async () => {
  const [packageSource, searchStage] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/apply-threejs-search-context.mjs", import.meta.url), "utf8"),
  ]);
  const packageJson = JSON.parse(packageSource);
  const build = packageJson.scripts["build:pages"];
  assert.doesNotMatch(build, /node scripts\/apply-threejs-local-graph\.mjs/);
  assert.match(build, /node scripts\/apply-threejs-search-context\.mjs/);
  assert.ok(
    searchStage.indexOf("patchThreejsLocalGraphRuntime(runtime)") < searchStage.indexOf("patchThreejsSearchContextRuntime(localRuntime)"),
    "combined search stage must compose Local Graph before Search Context",
  );
  assert.ok(
    searchStage.indexOf("patchThreejsLocalGraphPage(page)") < searchStage.indexOf("composeThreejsCategoryNavigatorPage(localPage)"),
    "combined search stage must compose Local Graph page state before Category Navigator",
  );
});

test("combined Three.js search stage passes Node syntax check", () => {
  const result = spawnSync(process.execPath, ["--check", "scripts/apply-threejs-search-context.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
});
