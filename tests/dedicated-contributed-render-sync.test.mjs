import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { patchDedicatedPrimaryStatusRendering } from "../scripts/apply-dedicated-contributed-render-sync.mjs";

const fixture = `
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

test("dedicated primary-status patch keeps Contributed fully emphasized and suppresses archived decoration", () => {
  const patched = patchDedicatedPrimaryStatusRendering(fixture, "fixture");
  assert.match(patched, /node\.relation === "contributed" \? 0\.96/);
  assert.match(patched, /node\.archived && node\.relation !== "contributed"/);
  assert.match(patched, /colors\[nodeStatus\(node\)\]/);
});

test("Radial and Tree base renderers expose the exact source hooks used by the build patch", async () => {
  for (const filename of ["public-radial-viewer.js", "public-tree-viewer.js"]) {
    const source = await readFile(new URL(`../scripts/${filename}`, import.meta.url), "utf8");
    assert.match(source, /let opacity = node\.archived \? 0\.72 : 1;/, filename);
    assert.match(source, /if \(node\.type === "repository" && node\.archived\) \{/, filename);
    assert.match(source, /ctx\.fillStyle = colors\[nodeStatus\(node\)\] \|\| colors\.original;/, filename);
  }
});
