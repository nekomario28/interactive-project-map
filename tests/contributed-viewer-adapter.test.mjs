import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  assert.match(patched, /edge\?\.type === "contribution"/);
  assert.match(patched, /node\.label\.includes\("\/"\)/);
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

test("C4a runtime is installed before startup and keeps contribution edges data-only", () => {
  const source = `"use strict";
function sanitizeGraph(value) { return value; }
function nodeStatus(node) {
  if (node.type !== "repository") return node.type;
  if (node.archived) return "archived";
  return node.fork ? "fork" : "original";
}
function palette() {
  if (state.style === "obsidian") {
    return {
      archived: "#b97a7a",
      selection: "#ffffff",
    };
  }
  return {
    archived: "#d9847b",
    selection: "#ffffff",
  };
}
function drawEdges() {}
function updateDetails() {}

try {
  username = normalizeUsername(query.get("username"));
}

if (username) { fetch("graph.json"); }
`;
  const patched = patchSharedViewerRuntime(source);
  const marker = patched.indexOf("Project Map Contributed shared-viewer contract");
  const startup = patched.indexOf('username = normalizeUsername(query.get("username"))');
  assert.ok(marker >= 0 && marker < startup);
  assert.match(patched, /node\.relation === "contributed"/);
  assert.match(patched, /node\.label\.includes\("\/"\)/);
  assert.match(patched, /raw\.relation !== "contributed"/);
  assert.match(patched, /commits === 0 && mergedPullRequests === 0/);
  assert.match(patched, /type: "contribution"/);
  assert.match(patched, /contributionTargets/);
  assert.match(patched, /contributed: "#E69F00"/);
  assert.match(patched, /External owner/);
  assert.match(patched, /const visibleEdges = originalEdges\.filter\(\(edge\) => edge\?\.type !== "contribution"\)/);
  assert.match(patched, /state\.edges = visibleEdges/);
  assert.doesNotMatch(patched, /ctx\./);
  assert.doesNotMatch(patched, /setLineDash/);
  assert.doesNotMatch(patched, /worldToScreen/);
  assert.equal(patchSharedViewerRuntime(patched), patched);
});

test("C4a shared render projection keeps Contributed above fork/archive source flags", async () => {
  const source = await readFile(new URL("../scripts/public-tree-router.js", import.meta.url), "utf8");
  assert.match(source, /const statusValues = \["original", "fork", "archived", "contributed"\]/);
  assert.match(source, /contributed: "Contributed"/);
  assert.match(source, /const knownStatusCounts = \{ original: 0, fork: 0, archived: 0, contributed: 0 \}/);
  assert.match(source, /if \(node\.relation === "contributed"\) return "contributed";/);
  assert.match(source, /const counts = \{ original: 0, fork: 0, archived: 0, contributed: 0 \}/);
});

test("C4a Contributed status CSS is warm-orange and idempotent", () => {
  const patched = patchViewerCss("body { margin: 0; }");
  assert.match(patched, /status-contributed/);
  assert.match(patched, /#E69F00/);
  assert.equal(patchViewerCss(patched), patched);
});
