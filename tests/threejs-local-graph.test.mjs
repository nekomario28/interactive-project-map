import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { buildThreejsLab } from "../scripts/build-threejs-lab.mjs";
import { applyThreejsLocalGraph } from "../scripts/apply-threejs-local-graph.mjs";
import { patchThreejsLocalGraphPage, patchThreejsLocalGraphRuntime } from "../scripts/public-threejs-local-graph.mjs";

test("Three.js Local Graph adapter uses the shared projection and remains idempotent", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-three-local-graph-"));
  try {
    await buildThreejsLab({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    const first = await applyThreejsLocalGraph({ siteDir: root });
    assert.equal(first.injected, true);

    const [html, runtime] = await Promise.all([
      readFile(join(root, "three", "index.html"), "utf8"),
      readFile(join(root, "threejs-viewer.js"), "utf8"),
    ]);
    assert.match(html, /id="focusButton"/);
    assert.match(html, /id="focusControls"[^>]*aria-label="Local Graph depth"/);
    assert.match(html, /data-focus-depth="1"/);
    assert.match(html, /data-focus-depth="2"/);
    assert.match(html, /data-focus-depth="3"/);

    assert.equal((runtime.match(/IPM_THREEJS_LOCAL_GRAPH_P2/g) || []).length, 1);
    assert.match(runtime, /ProjectMapViewModel\?\.projectLocalGraph/);
    assert.match(runtime, /focus:focusRoot,depth:focusDepth/);
    assert.match(runtime, /ProjectMapThreejsLocalGraph/);
    assert.match(runtime, /lastLocalProjection/);
    assert.match(runtime, /ui\.focusDepthButtons/);

    const syntax = spawnSync(process.execPath, ["--check", join(root, "threejs-viewer.js")], { encoding: "utf8" });
    assert.equal(syntax.status, 0, syntax.stderr);

    const second = await applyThreejsLocalGraph({ siteDir: root });
    assert.equal(second.injected, false);
    const twice = await readFile(join(root, "threejs-viewer.js"), "utf8");
    assert.equal((twice.match(/IPM_THREEJS_LOCAL_GRAPH_P2/g) || []).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("canonical Local Graph composer owns semantics while apply stage stays I/O-only", async () => {
  const [canonical, adapter] = await Promise.all([
    readFile(new URL("../scripts/public-threejs-local-graph.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/apply-threejs-local-graph.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(canonical, /IPM_THREEJS_LOCAL_GRAPH_P2/);
  assert.match(canonical, /projectLocalGraph/);
  assert.match(canonical, /ProjectMapThreejsLocalGraph/);
  assert.match(canonical, /patchThreejsLocalGraphRuntime/);
  assert.match(canonical, /patchThreejsLocalGraphPage/);
  assert.doesNotMatch(adapter, /IPM_THREEJS_LOCAL_GRAPH_P2/);
  assert.doesNotMatch(adapter, /projectLocalGraph/);
  assert.match(adapter, /patchThreejsLocalGraphRuntime/);
  assert.match(adapter, /patchThreejsLocalGraphPage/);

  assert.throws(() => patchThreejsLocalGraphRuntime("drift"), /Local Graph controls|P1 visibility adapter/);
  assert.throws(() => patchThreejsLocalGraphPage("drift"), /toolbar motion control/);
});

test("Three.js Local Graph canonical composer and I/O adapter pass Node syntax checks", () => {
  for (const path of ["scripts/public-threejs-local-graph.mjs", "scripts/apply-threejs-local-graph.mjs"]) {
    const result = spawnSync(process.execPath, ["--check", path], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `${path}: ${result.stderr}`);
  }
});
