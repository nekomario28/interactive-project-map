import assert from "node:assert/strict";
import test from "node:test";

import { BOOTSTRAP_GATE_MARKER, gate2DRuntimeBootstrap } from "../scripts/apply-2d-runtime-bootstrap-gate.mjs";

test("gates a formatted 2D graph fetch until DOMContentLoaded", () => {
  const source = `const state = {};\nif (username) {\n  fetch("graph.json").then(() => state.ready = true);\n}\n`;
  const result = gate2DRuntimeBootstrap(source);
  assert.match(result, /function startProjectMapGraphLoad\(\)/);
  assert.match(result, /window\.addEventListener\("DOMContentLoaded", startProjectMapGraphLoad, \{ once: true \}\);/);
  assert.ok(result.indexOf(BOOTSTRAP_GATE_MARKER) < result.indexOf("fetch(\"graph.json\")"));
  assert.ok(result.indexOf("function startProjectMapGraphLoad") < result.indexOf("fetch(\"graph.json\")"));
});

test("gates minified dedicated-viewer graph fetches and is idempotent", () => {
  const source = `const state={};if(username){const owner=encodeURIComponent(username);fetch(\`https://raw.githubusercontent.com/\${owner}/\${owner}/HEAD/project-map/graph.json\`).then(()=>state.ready=true);}`;
  const once = gate2DRuntimeBootstrap(source);
  const twice = gate2DRuntimeBootstrap(once);
  assert.equal(twice, once);
  assert.equal((once.match(new RegExp(BOOTSTRAP_GATE_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length, 1);
  assert.match(once, /if\(username\)\{/);
});

test("fails closed when no final graph bootstrap is present", () => {
  assert.throws(() => gate2DRuntimeBootstrap("const state = {};"), /Could not locate 2D graph bootstrap/);
});
