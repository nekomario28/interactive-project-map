import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  patchDedicatedPrimaryStatusRendering,
  patchDedicatedRepositoryPrimaryStatusRendering,
} from "../scripts/apply-dedicated-contributed-render-sync.mjs";

const nodeFixture = `
function drawNodesAndLabels(colors) {
  for (const node of state.nodes) {
    let opacity = node.archived ? 0.72 : 1;
    ctx.fillStyle = colors[nodeStatus(node)] || colors.original;
    if (node.type === "repository" && node.archived) {
      ctx.strokeStyle = colors.archived;
    }
  }
}
`;

const repositoryFixture = `
function draw() {
  for (const repo of state.repos) {
    const opacity = matches(repo) ? (repo.archived ? 0.64 : repo.fork ? 0.78 : 0.90) : 0.10;
    ctx.fillStyle = colors[statusOf(repo)];
    if (repo.archived) {
      ctx.strokeStyle = colors.archived;
    }
  }
}
`;

test("node-based dedicated patch keeps Contributed primary and suppresses archived decoration", () => {
  const patched = patchDedicatedPrimaryStatusRendering(nodeFixture, "fixture");
  assert.match(patched, /node\.relation === "contributed" \? 0\.96/);
  assert.match(patched, /node\.archived && node\.relation !== "contributed"/);
  assert.match(patched, /colors\[nodeStatus\(node\)\]/);
});

test("repository-based dedicated patch keeps Contributed primary and suppresses archived decoration", () => {
  const patched = patchDedicatedRepositoryPrimaryStatusRendering(repositoryFixture, {
    opacity: "    const opacity = matches(repo) ? (repo.archived ? 0.64 : repo.fork ? 0.78 : 0.90) : 0.10;",
    contributedOpacity: "    const opacity = matches(repo) ? (repo.relation === \"contributed\" ? 0.96 : repo.archived ? 0.64 : repo.fork ? 0.78 : 0.90) : 0.10;",
  }, "fixture");
  assert.match(patched, /repo\.relation === "contributed" \? 0\.96/);
  assert.match(patched, /repo\.archived && repo\.relation !== "contributed"/);
  assert.match(patched, /colors\[statusOf\(repo\)\]/);
});

test("Radial and Tree base renderers expose the exact source hooks used by the build patch", async () => {
  for (const filename of ["public-radial-viewer.js", "public-tree-viewer.js"]) {
    const source = await readFile(new URL(`../scripts/${filename}`, import.meta.url), "utf8");
    assert.match(source, /let opacity = node\.archived \? 0\.72 : 1;/, filename);
    assert.match(source, /if \(node\.type === "repository" && node\.archived\) \{/, filename);
    assert.match(source, /ctx\.fillStyle = colors\[nodeStatus\(node\)\] \|\| colors\.original;/, filename);
  }
});

test("Treemap, Timeline, Cluster, and Sunburst expose source-flag modifiers after status color selection", async () => {
  const files = [
    ["public-treemap-viewer.js", /repo\.archived \? 0\.64 : repo\.fork \? 0\.78 : 0\.90/],
    ["public-timeline-viewer.js", /repo\.archived \? 0\.72 : repo\.fork \? 0\.82 : 0\.96/],
    ["public-cluster-viewer.js", /repo\.archived \? 0\.70 : repo\.fork \? 0\.82 : 0\.96/],
    ["public-sunburst-viewer.js", /repo\.archived \? 0\.70 : repo\.fork \? 0\.82 : 0\.94/],
  ];
  for (const [filename, opacityPattern] of files) {
    const source = await readFile(new URL(`../scripts/${filename}`, import.meta.url), "utf8");
    assert.match(source, opacityPattern, filename);
    assert.match(source, /if \(repo\.archived\) \{/, filename);
    assert.match(source, /colors\[statusOf\(repo\)\]/, filename);
  }
});
