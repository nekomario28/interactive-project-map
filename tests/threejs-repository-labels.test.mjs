import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { buildThreejsLab } from "../scripts/build-threejs-lab.mjs";
import { applyThreejsLocalGraph } from "../scripts/apply-threejs-local-graph.mjs";
import { applyThreejsSearchContext } from "../scripts/apply-threejs-search-context.mjs";
import { applyThreejsCategoryNavigator } from "../scripts/apply-threejs-category-navigator.mjs";
import {
  applyThreejsRepositoryLabels,
  DIRECT_SEARCH_LABEL_BUDGET,
  patchThreejsRepositoryLabelsPage,
} from "../scripts/apply-threejs-repository-labels.mjs";

test("bounded Three.js repository labels attach after Category Navigator and remain lazy", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-three-repo-labels-"));
  try {
    await buildThreejsLab({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    const base = await readFile(join(root, "threejs-viewer.js"), "utf8");
    assert.doesNotMatch(base, /three-label-repository/);

    await applyThreejsLocalGraph({ siteDir: root });
    await applyThreejsSearchContext({ siteDir: root });
    await applyThreejsCategoryNavigator({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    const first = await applyThreejsRepositoryLabels({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    assert.equal(first.injected, true);

    const [runtime, page, style] = await Promise.all([
      readFile(join(root, "threejs-viewer.js"), "utf8"),
      readFile(join(root, "three", "index.html"), "utf8"),
      readFile(join(root, "threejs-repository-labels.css"), "utf8"),
    ]);
    assert.equal((runtime.match(/IPM_THREEJS_BOUNDED_REPOSITORY_LABELS_P2/g) || []).length, 1);
    assert.match(runtime, new RegExp(`DIRECT_SEARCH_LABEL_BUDGET=${DIRECT_SEARCH_LABEL_BUDGET}`));
    assert.match(runtime, /repositoryLabels=new Map\(\)/);
    assert.match(runtime, /desiredRepositoryLabelIds/);
    assert.match(runtime, /lastSearchProjection\?\.directRepositories/);
    assert.match(runtime, /selectedMesh\?\.visible/);
    assert.match(runtime, /element\.dataset\.repositoryLabelId=id/);
    assert.match(runtime, /element\.setAttribute\("aria-hidden","true"\)/);
    assert.match(page, /threejs-repository-labels\.css/);
    assert.match(style, /\.three-label-repository\.is-selected/);
    assert.match(style, /\.three-label-repository\.is-search-match/);

    // Repository labels are not created in the graph construction loop. They are only created by syncRepositoryLabels.
    const construction = runtime.slice(runtime.indexOf("for(const node of graph.nodes)"), runtime.indexOf("let edgeLines=null"));
    assert.doesNotMatch(construction, /three-label-repository/);

    const syntax = spawnSync(process.execPath, ["--check", join(root, "threejs-viewer.js")], { encoding: "utf8" });
    assert.equal(syntax.status, 0, syntax.stderr);

    const second = await applyThreejsRepositoryLabels({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    assert.equal(second.injected, false);
    const twice = await readFile(join(root, "threejs-viewer.js"), "utf8");
    assert.equal((twice.match(/IPM_THREEJS_BOUNDED_REPOSITORY_LABELS_P2/g) || []).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("bounded repository labels fail closed when Category Navigator has not run", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-three-repo-label-order-"));
  try {
    await buildThreejsLab({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    await applyThreejsLocalGraph({ siteDir: root });
    await applyThreejsSearchContext({ siteDir: root });
    await assert.rejects(
      () => applyThreejsRepositoryLabels({ siteDir: root, sourceDir: join(process.cwd(), "scripts") }),
      /Category Navigator adapter must run before bounded repository labels/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("repository label stylesheet attachment is idempotent", () => {
  const html = "<!doctype html><html><head><title>x</title></head><body></body></html>";
  const once = patchThreejsRepositoryLabelsPage(html);
  assert.match(once, /threejs-repository-labels\.css/);
  assert.equal(patchThreejsRepositoryLabelsPage(once), once);
});

test("repository label adapter and stylesheet keep an explicit small search budget", async () => {
  assert.equal(DIRECT_SEARCH_LABEL_BUDGET, 8);
  const source = await readFile(new URL("../scripts/apply-threejs-repository-labels.mjs", import.meta.url), "utf8");
  assert.match(source, /directCount>=DIRECT_SEARCH_LABEL_BUDGET/);
  assert.match(source, /if\(selectedId\)ids\.push\(selectedId\)/);
  const syntax = spawnSync(process.execPath, ["--check", "scripts/apply-threejs-repository-labels.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(syntax.status, 0, syntax.stderr);
});
