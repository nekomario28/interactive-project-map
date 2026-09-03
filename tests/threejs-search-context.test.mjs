import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { buildThreejsLab } from "../scripts/build-threejs-lab.mjs";
import { applyThreejsLocalGraph } from "../scripts/apply-threejs-local-graph.mjs";
import { applyThreejsSearchContext } from "../scripts/apply-threejs-search-context.mjs";

test("Three.js search stage composes search, Category Navigator and repository labels idempotently", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-three-search-context-"));
  try {
    await buildThreejsLab({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    await applyThreejsLocalGraph({ siteDir: root });
    const first = await applyThreejsSearchContext({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    assert.equal(first.injected, true);

    const [runtime, page, navigator, labelsCss] = await Promise.all([
      readFile(join(root, "threejs-viewer.js"), "utf8"),
      readFile(join(root, "three", "index.html"), "utf8"),
      readFile(join(root, "threejs-category-navigator.js"), "utf8"),
      readFile(join(root, "threejs-repository-labels.css"), "utf8"),
    ]);
    assert.equal((runtime.match(/IPM_THREEJS_SHARED_SEARCH_P2/g) || []).length, 1);
    assert.equal((runtime.match(/IPM_THREEJS_CATEGORY_NAVIGATOR_P2/g) || []).length, 1);
    assert.equal((runtime.match(/IPM_THREEJS_BOUNDED_REPOSITORY_LABELS_P2/g) || []).length, 1);
    assert.match(runtime, /ProjectMapViewModel\?\.projectSearchContext/);
    assert.match(runtime, /window\.ProjectMapSearchContext=Object\.freeze/);
    assert.match(runtime, /directSearchMeshes/);
    assert.match(runtime, /navigateDirectSearch/);
    assert.match(runtime, /event\.key==="ArrowDown"\|\|event\.key==="ArrowUp"/);
    assert.match(runtime, /window\.open\(node\.url,"_blank","noopener"\)/);
    assert.match(runtime, /appendSearchMatchReason/);
    assert.match(runtime, /lastSearchProjection/);
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
    assert.equal((twice.match(/IPM_THREEJS_SHARED_SEARCH_P2/g) || []).length, 1);
    assert.equal((twice.match(/IPM_THREEJS_CATEGORY_NAVIGATOR_P2/g) || []).length, 1);
    assert.equal((twice.match(/IPM_THREEJS_BOUNDED_REPOSITORY_LABELS_P2/g) || []).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Three.js shared search stage fails closed when Local Graph has not run", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-three-search-order-"));
  try {
    await buildThreejsLab({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    await assert.rejects(
      () => applyThreejsSearchContext({ siteDir: root, sourceDir: join(process.cwd(), "scripts") }),
      /Local Graph adapter must run before shared search context/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("combined Three.js search stage passes Node syntax check", () => {
  const result = spawnSync(process.execPath, ["--check", "scripts/apply-threejs-search-context.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
});
