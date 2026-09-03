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
  composeThreejsCategoryNavigatorPage,
  composeThreejsCategoryNavigatorRuntime,
} from "../scripts/public-threejs-category-navigator.mjs";

test("Three.js Category Navigator attaches with shared search and the compatibility adapter becomes a no-op", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-three-category-nav-"));
  try {
    await buildThreejsLab({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    await applyThreejsLocalGraph({ siteDir: root });
    const combined = await applyThreejsSearchContext({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    assert.equal(combined.injected, true);
    const compatibility = await applyThreejsCategoryNavigator({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    assert.equal(compatibility.injected, false);

    const [runtime, page, navigator] = await Promise.all([
      readFile(join(root, "threejs-viewer.js"), "utf8"),
      readFile(join(root, "three", "index.html"), "utf8"),
      readFile(join(root, "threejs-category-navigator.js"), "utf8"),
    ]);
    assert.equal((runtime.match(/IPM_THREEJS_CATEGORY_NAVIGATOR_P2/g) || []).length, 1);
    assert.match(runtime, /ProjectMapThreejsNavigatorAdapter=Object\.freeze/);
    assert.match(runtime, /projectmap:threejs-navigator-ready/);
    assert.match(runtime, /projectmap:threejs-navigator-change/);
    assert.match(runtime, /selectNode:navigatorSelectNode/);
    assert.match(runtime, /scopeNodeIds/);
    assert.match(page, /category-navigator\.css/);
    assert.match(page, /threejs-category-navigator\.js/);
    assert.match(navigator, /External contributions/);
    assert.match(navigator, /ProjectMapSearchContext/);
    assert.match(navigator, /ProjectMapThreejsCategoryNavigator/);

    for (const file of [join(root, "threejs-viewer.js"), join(root, "threejs-category-navigator.js")]) {
      const syntax = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
      assert.equal(syntax.status, 0, syntax.stderr);
    }

    const second = await applyThreejsCategoryNavigator({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    assert.equal(second.injected, false);
    const twice = await readFile(join(root, "threejs-viewer.js"), "utf8");
    assert.equal((twice.match(/IPM_THREEJS_CATEGORY_NAVIGATOR_P2/g) || []).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("canonical Category Navigator composer fails closed if shared search has not run", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-three-category-nav-order-"));
  try {
    await buildThreejsLab({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    await applyThreejsLocalGraph({ siteDir: root });
    const runtime = await readFile(join(root, "threejs-viewer.js"), "utf8");
    assert.throws(
      () => composeThreejsCategoryNavigatorRuntime(runtime),
      /Local Graph and shared search adapters must run before Category Navigator/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("canonical Category Navigator page attachment is idempotent and reuses the existing navigator stylesheet", () => {
  const html = '<!doctype html><html><head><title>x</title></head><body data-map-style="threejs-cosmic"></body></html>';
  const once = composeThreejsCategoryNavigatorPage(html);
  assert.match(once, /href="\.\.\/category-navigator\.css"/);
  assert.match(once, /src="\.\.\/threejs-category-navigator\.js"/);
  assert.equal(composeThreejsCategoryNavigatorPage(once), once);
});

test("canonical Category Navigator composer owns semantics while the apply adapter stays thin", async () => {
  const [canonical, adapter] = await Promise.all([
    readFile(new URL("../scripts/public-threejs-category-navigator.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/apply-threejs-category-navigator.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(canonical, /IPM_THREEJS_CATEGORY_NAVIGATOR_P2/);
  assert.match(canonical, /navigatorNodeById/);
  assert.match(canonical, /projectmap:threejs-navigator-ready/);
  assert.match(canonical, /projectmap:threejs-navigator-change/);
  assert.match(adapter, /composeThreejsCategoryNavigatorRuntime/);
  assert.match(adapter, /composeThreejsCategoryNavigatorPage/);
  assert.doesNotMatch(adapter, /IPM_THREEJS_CATEGORY_NAVIGATOR_P2|navigatorNodeById|projectmap:threejs-navigator-ready/);

  for (const file of [
    "scripts/public-threejs-category-navigator.mjs",
    "scripts/apply-threejs-category-navigator.mjs",
    "scripts/public-threejs-category-navigator.js",
  ]) {
    const result = spawnSync(process.execPath, ["--check", file], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
  }
});
