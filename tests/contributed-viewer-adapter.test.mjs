import assert from "node:assert/strict";
import test from "node:test";
import {
  patchSharedViewState,
  patchSharedViewerHtml,
  patchSharedViewerRuntime,
  patchViewerCss,
} from "../scripts/apply-contributed-viewer.mjs";

test("C4a shared view-state promotes Contributed to a fourth repository status", () => {
  const source = `
const STATUS_VALUES = ["original", "fork", "archived"];
const aliases = { o: "original", f: "fork", a: "archived" };
return typeof nodeStatus === "function" ? nodeStatus(node) : node.archived ? "archived" : node.fork ? "fork" : "original";
const counts = { original: 0, fork: 0, archived: 0 };
const label = value === "original" ? "Original" : value === "fork" ? "Fork" : "Archived";
`;
  const patched = patchSharedViewState(source);
  assert.match(patched, /"contributed"/);
  assert.match(patched, /c: "contributed"/);
  assert.match(patched, /node\.relation === "contributed"/);
  assert.match(patched, /contributed: 0/);
  assert.match(patched, /"Contributed"/);
  assert.equal(patchSharedViewState(patched), patched);
});

test("C4a shared HTML adds one Contributed control idempotently", () => {
  const source = '<div><button type="button" data-status-filter="archived" aria-pressed="true">Archived</button></div>';
  const patched = patchSharedViewerHtml(source);
  assert.equal((patched.match(/data-status-filter="contributed"/g) || []).length, 1);
  assert.equal(patchSharedViewerHtml(patched), patched);
});

test("C4a runtime is installed in shared viewer before username startup and graph fetch", () => {
  const source = `"use strict";\nfunction sanitizeGraph(value) { return value; }\nfunction nodeStatus(node) { return node.type; }\nfunction palette() { return {}; }\nfunction drawEdges() {}\nfunction updateDetails() {}\n\ntry {\n  username = normalizeUsername(query.get("username"));\n}\n\nif (username) { fetch("graph.json"); }\n`;
  const patched = patchSharedViewerRuntime(source);
  const marker = patched.indexOf("Project Map Contributed shared-viewer contract");
  const startup = patched.indexOf('username = normalizeUsername(query.get("username"))');
  assert.ok(marker >= 0 && marker < startup);
  assert.match(patched, /raw\.relation !== "contributed"/);
  assert.match(patched, /type: "contribution"/);
  assert.match(patched, /return "contributed"/);
  assert.match(patched, /External owner/);
  assert.match(patched, /if \(!contributionEdges\.length\) return baseDrawEdges\(colors\)/);
  assert.equal(patchSharedViewerRuntime(patched), patched);
});

test("C4a Contributed status CSS is idempotent", () => {
  const patched = patchViewerCss("body { margin: 0; }");
  assert.match(patched, /status-contributed/);
  assert.equal(patchViewerCss(patched), patched);
});
