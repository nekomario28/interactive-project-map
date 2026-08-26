import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

import { patchCanvasRuntime, patchCanvasViewerPage } from "../scripts/apply-canvas-render-density.mjs";

const SOURCE_FILES = [
  "public-viewer.js",
  "public-radial-viewer.js",
  "public-tree-viewer.js",
  "public-treemap-viewer.js",
  "public-timeline-viewer.js",
  "public-cluster-viewer.js",
  "public-sunburst-viewer.js",
  "public-tree-router.js",
];

async function policyFor({ render = "", width = 1280, dpr = 3 } = {}) {
  const source = await readFile(new URL("../scripts/public-render-density.js", import.meta.url), "utf8");
  const suffix = render ? `?render=${encodeURIComponent(render)}` : "";
  const window = { innerWidth: width, devicePixelRatio: dpr };
  const context = { URL, location: { href: `https://example.test/u/${suffix}` }, window };
  vm.runInNewContext(source, context, { filename: "public-render-density.js" });
  return window.ProjectMapRenderDensity;
}

test("Canvas render density keeps native DPR as the compatibility default", async () => {
  const policy = await policyFor({ dpr: 3 });
  assert.equal(policy.mode, "native");
  assert.equal(policy.pixelRatio({ width: 1280, devicePixelRatio: 3 }), 3);
  assert.deepEqual(
    JSON.parse(JSON.stringify(policy.snapshot({ width: 1280, devicePixelRatio: 3 }))),
    { mode: "native", devicePixelRatio: 3, pixelRatio: 3, mobile: false },
  );
});

test("Canvas render density mirrors the bounded Three.js donor modes when explicitly requested", async () => {
  const auto = await policyFor({ render: "auto", dpr: 3 });
  assert.equal(auto.pixelRatio({ width: 1280, devicePixelRatio: 3 }), 1.45);
  assert.equal(auto.pixelRatio({ width: 390, devicePixelRatio: 3 }), 1);

  const high = await policyFor({ render: "high", dpr: 3 });
  assert.equal(high.pixelRatio({ width: 1280, devicePixelRatio: 3 }), 1.8);
  assert.equal(high.pixelRatio({ width: 390, devicePixelRatio: 3 }), 1.25);

  const low = await policyFor({ render: "low", dpr: 3 });
  assert.equal(low.pixelRatio({ width: 1280, devicePixelRatio: 3 }), 0.85);
  assert.equal(low.pixelRatio({ width: 390, devicePixelRatio: 0.75 }), 0.75);
});

test("unknown render-density values fail open to current native Canvas behavior", async () => {
  const policy = await policyFor({ render: "ultra", dpr: 2.5 });
  assert.equal(policy.mode, "native");
  assert.equal(policy.pixelRatio({ width: 390, devicePixelRatio: 2.5 }), 2.5);
});

test("all eight Canvas runtimes consume one generated render-density policy hook", async () => {
  for (const fileName of SOURCE_FILES) {
    const source = await readFile(new URL(`../scripts/${fileName}`, import.meta.url), "utf8");
    const next = patchCanvasRuntime(source, fileName);
    assert.notEqual(next, source, `${fileName} should receive the policy hook`);
    assert.equal((next.match(/ProjectMapRenderDensity\?\.pixelRatio/g) || []).length, 1, fileName);
    assert.equal(patchCanvasRuntime(next, fileName), next, `${fileName} patch should be idempotent`);
  }
});

test("Canvas render-density page bootstrap is early, local and idempotent", () => {
  const html = "<!doctype html><html><head><title>x</title></head><body><script src=\"../viewer.js\"></script></body></html>";
  const once = patchCanvasViewerPage(html, "u");
  assert.match(once, /<script src="\.\.\/render-density\.js"><\/script>/);
  assert.ok(once.indexOf("render-density.js") < once.indexOf("viewer.js"));
  assert.equal(patchCanvasViewerPage(once, "u"), once);
});
