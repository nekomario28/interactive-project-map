import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { renderGalaxySvg } from "../scripts/svg.mjs";
import { renderRadialTreeSvg } from "../scripts/radial-svg.mjs";
import { renderTreeSvg } from "../scripts/tree-svg.mjs";
import { renderTreemapSvg } from "../scripts/treemap-svg.mjs";
import { renderTimelineSvg } from "../scripts/timeline-svg.mjs";
import { renderClusterSvg } from "../scripts/cluster-svg.mjs";
import { renderSunburstSvg } from "../scripts/sunburst-svg.mjs";
import { renderMatrixSvg } from "../scripts/matrix-svg.mjs";
import { renderSankeySvg } from "../scripts/sankey-svg.mjs";

function stressGraph(repositoryCount = 300) {
  const groupCount = 10;
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    id: `group:group-${index}`,
    label: `Category ${index + 1}`,
    type: "group",
    repositoryCount: Math.ceil(repositoryCount / groupCount),
  }));
  const repos = Array.from({ length: repositoryCount }, (_, index) => {
    const groupIndex = index % groupCount;
    const archived = index % 17 === 0;
    return {
      id: `repository:stress-project-${String(index).padStart(3, "0")}`,
      label: `stress-project-${String(index).padStart(3, "0")}-with-readable-name`,
      type: "repository",
      url: `https://github.com/stress/stress-project-${index}`,
      description: `Synthetic repository ${index} used for a 300-project renderer stress test.`,
      language: ["Python", "TypeScript", "Rust", "C++", "Java", "Shell"][index % 6],
      topics: ["stress", `group-${groupIndex}`],
      stars: (index * 7) % 31,
      forks: index % 8,
      fork: !archived && index % 11 === 0,
      archived,
      createdAt: new Date(Date.UTC(2020 + (index % 7), index % 12, 1 + (index % 27))).toISOString(),
      updatedAt: "2026-08-18T00:00:00Z",
      groupId: `group-${groupIndex}`,
      groupLabel: `Category ${groupIndex + 1}`,
    };
  });
  const edges = [
    ...groups.map((group) => ({ source: "user:stress", target: group.id, type: "ownership" })),
    ...repos.map((repo) => ({ source: `group:${repo.groupId}`, target: repo.id, type: "membership" })),
    ...repos.filter((_, index) => index > 0 && index % 25 === 0).map((repo, index) => ({
      source: repos[index * 25 - 1]?.id || repos[0].id,
      target: repo.id,
      type: "relation",
    })),
  ];
  return {
    owner: "stress",
    generatedAt: "2026-08-18T00:00:00Z",
    repositoryCount,
    groupCount,
    nodes: [{ id: "user:stress", label: "stress", type: "owner", url: "https://github.com/stress" }, ...groups, ...repos],
    edges,
  };
}

const renderers = [
  ["radial", (graph) => renderRadialTreeSvg(graph, "dark", 740, 420)],
  ["galaxy", (graph) => renderGalaxySvg(graph, "dark", 740, 420, "galaxy")],
  ["obsidian", (graph) => renderGalaxySvg(graph, "dark", 740, 420, "obsidian")],
  ["tree", (graph) => renderTreeSvg(graph, "dark", 740, 420)],
  ["treemap", (graph) => renderTreemapSvg(graph, "dark", 740, 420)],
  ["timeline", (graph) => renderTimelineSvg(graph, "dark", 740, 420)],
  ["cluster", (graph) => renderClusterSvg(graph, "dark", 740, 420)],
  ["sunburst", (graph) => renderSunburstSvg(graph, "dark", 740, 420)],
  ["matrix", (graph) => renderMatrixSvg(graph, "dark", 740, 420)],
  ["sankey", (graph) => renderSankeySvg(graph, "dark", 740, 420)],
];

test("all ten static renderers remain finite and bounded at the 300-repository limit", () => {
  const graph = stressGraph();
  const started = performance.now();
  for (const [name, render] of renderers) {
    const rendererStarted = performance.now();
    const svg = render(graph);
    const elapsed = performance.now() - rendererStarted;
    assert.match(svg, /^<\?xml version="1\.0" encoding="UTF-8"\?>/u, `${name} did not emit SVG XML`);
    assert.doesNotMatch(svg, /(?:NaN|Infinity)/u, `${name} emitted invalid numeric geometry`);
    assert.ok(Buffer.byteLength(svg) < 2_000_000, `${name} emitted an unexpectedly large SVG`);
    assert.ok(elapsed < 5_000, `${name} took ${elapsed.toFixed(0)}ms to render 300 repositories`);
  }
  const total = performance.now() - started;
  assert.ok(total < 10_000, `ten-preset 300-repository render pass took ${total.toFixed(0)}ms`);
});
