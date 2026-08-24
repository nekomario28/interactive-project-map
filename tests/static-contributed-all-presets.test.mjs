import assert from "node:assert/strict";
import test from "node:test";
import { renderGalaxySvg } from "../scripts/svg.mjs";
import { renderGalaxyClassicSvg } from "../scripts/galaxy-svg-classic.mjs";
import { renderGalaxySystemsSvg } from "../scripts/galaxy-svg-systems.mjs";
import { renderGalaxyHybridSvg } from "../scripts/galaxy-svg-hybrid.mjs";
import { layoutRadialTree, renderRadialTreeSvg } from "../scripts/radial-svg.mjs";
import { renderTreeSvg } from "../scripts/tree-svg.mjs";
import { renderTreemapSvg } from "../scripts/treemap-svg.mjs";
import { renderTimelineSvg } from "../scripts/timeline-svg.mjs";
import { renderClusterSvg } from "../scripts/cluster-svg.mjs";
import { renderSunburstSvg } from "../scripts/sunburst-svg.mjs";
import { renderMatrixSvg } from "../scripts/matrix-svg.mjs";
import { renderSankeySvg } from "../scripts/sankey-svg.mjs";
import {
  isContributedRepository,
  repositoryStatus,
  shouldDecorateArchived,
  visibleStructuralEdges,
} from "../scripts/static-contributed.mjs";

function contributedGraph(includeContributionEdge = true) {
  const contributed = {
    id: "repository:outside/project",
    label: "outside/project",
    type: "repository",
    relation: "contributed",
    repositoryOwner: "outside",
    repositoryName: "project",
    url: "https://github.com/outside/project",
    description: "accepted upstream contribution",
    language: "Rust",
    topics: ["robotics"],
    stars: 8,
    forks: 3,
    fork: true,
    archived: true,
    createdAt: "2025-04-01T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z",
    contribution: {
      commits: 2,
      pullRequests: 3,
      mergedPullRequests: 1,
      commitsTruncated: false,
      pullRequestsTruncated: false,
    },
  };
  const nodes = [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 2 },
    {
      id: "repository:owned-a", label: "owned-a", type: "repository", url: "https://github.com/example/owned-a",
      language: "TypeScript", topics: ["robotics"], stars: 3, forks: 0, fork: false, archived: false,
      createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2026-08-18T00:00:00.000Z", groupId: "robotics", groupLabel: "Robotics",
    },
    {
      id: "repository:owned-b", label: "owned-b", type: "repository", url: "https://github.com/example/owned-b",
      language: "Rust", topics: ["robotics"], stars: 1, forks: 1, fork: true, archived: false,
      createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2026-08-18T00:00:00.000Z", groupId: "robotics", groupLabel: "Robotics",
    },
    contributed,
  ];
  const edges = [
    { source: "user:example", target: "group:robotics", type: "ownership" },
    { source: "group:robotics", target: "repository:owned-a", type: "membership" },
    { source: "group:robotics", target: "repository:owned-b", type: "membership" },
    ...(includeContributionEdge ? [{ source: "user:example", target: contributed.id, type: "contribution" }] : []),
  ];
  return {
    owner: "example",
    generatedAt: "2026-08-24T00:00:00.000Z",
    repositoryCount: 2,
    groupCount: 1,
    contributedRepositoryCount: 1,
    nodes,
    edges,
  };
}

const renderers = [
  ["radial", (graph) => renderRadialTreeSvg(graph, "dark", 740, 420)],
  ["galaxy-classic", (graph) => renderGalaxyClassicSvg(graph, "dark", 740, 420)],
  ["galaxy-systems", (graph) => renderGalaxySystemsSvg(graph, "dark", 740, 420)],
  ["galaxy-hybrid", (graph) => renderGalaxyHybridSvg(graph, "dark", 740, 420)],
  ["obsidian", (graph) => renderGalaxySvg(graph, "dark", 740, 420, "obsidian")],
  ["tree", (graph) => renderTreeSvg(graph, "dark", 740, 420)],
  ["treemap", (graph) => renderTreemapSvg(graph, "dark", 740, 420)],
  ["timeline", (graph) => renderTimelineSvg(graph, "dark", 740, 420)],
  ["cluster", (graph) => renderClusterSvg(graph, "dark", 740, 420)],
  ["sunburst", (graph) => renderSunburstSvg(graph, "dark", 740, 420)],
  ["matrix", (graph) => renderMatrixSvg(graph, "dark", 740, 420)],
  ["sankey", (graph) => renderSankeySvg(graph, "dark", 740, 420)],
];

test("shared static semantics keep Contributed primary over fork/archive source flags", () => {
  const repo = contributedGraph().nodes.find((node) => node.id === "repository:outside/project");
  assert.equal(isContributedRepository(repo), true);
  assert.equal(repositoryStatus(repo), "contributed");
  assert.equal(shouldDecorateArchived(repo), false);
  assert.equal(visibleStructuralEdges(contributedGraph().edges).some((edge) => edge.type === "contribution"), false);
});

test("Radial Tree keeps Contributed on a separated outer ring", () => {
  const width = 740;
  const height = 420;
  const cx = width / 2;
  const cy = height / 2 - 4;
  const points = layoutRadialTree(contributedGraph(), width, height);
  const external = points.find((point) => point.node.id === "repository:outside/project");
  const owned = points.filter((point) => point.node.type === "repository" && point.node.relation !== "contributed");
  assert.ok(external);
  const externalRadius = Math.hypot(external.x - cx, external.y - cy);
  const maxOwnedRadius = Math.max(...owned.map((point) => Math.hypot(point.x - cx, point.y - cy)));
  const nearestOwned = Math.min(...owned.map((point) => Math.hypot(point.x - external.x, point.y - external.y)));
  assert.ok(externalRadius - maxOwnedRadius >= 28, `expected a clear outer radial gap, got ${externalRadius - maxOwnedRadius}`);
  assert.ok(nearestOwned >= 28, `expected Contributed to avoid owned-node overlap, got ${nearestOwned}`);
});

for (const [name, render] of renderers) {
  test(`${name} static SVG retains Contributed and treats the direct contribution edge as data-only`, () => {
    const withEdge = render(contributedGraph(true));
    const withoutEdge = render(contributedGraph(false));
    assert.equal(withEdge, withoutEdge, `${name} must not turn the canonical contribution edge into a visual spoke or layout spring`);
    assert.doesNotMatch(withEdge, /(?:NaN|Infinity)/u, `${name} emitted invalid geometry`);
    assert.match(withEdge, /Contributed/i, `${name} must expose explicit Contributed semantics`);
    assert.match(withEdge, /#E69F00/i, `${name} must expose the shared warm Contributed identity`);
  });
}

test("repository-oriented static presets retain the full external owner/repo identity", () => {
  const repositoryRenderers = renderers.filter(([name]) => !["matrix", "sankey"].includes(name));
  for (const [name, render] of repositoryRenderers) {
    const svg = render(contributedGraph());
    assert.match(svg, /outside\/project/, `${name} dropped the external repository identity`);
  }
});

test("aggregate static presets expose an external context and a fourth Contributed bucket", () => {
  const matrix = renderMatrixSvg(contributedGraph(), "dark", 740, 420);
  assert.match(matrix, /External contributions/);
  assert.match(matrix, /1 contributed/);
  const sankey = renderSankeySvg(contributedGraph(), "dark", 740, 420);
  assert.match(sankey, /External contributions/);
  assert.match(sankey, /Contributed 1/);
  assert.match(sankey, /External contribution context/);
  assert.doesNotMatch(sankey, /example → External contributions/);
});

test("Galaxy-family static presets keep Contributed outside owned category membership", () => {
  for (const [name, render] of renderers.filter(([name]) => name.startsWith("galaxy-"))) {
    const svg = render(contributedGraph());
    assert.match(svg, /data-galaxy-orbit="contributed"/, `${name} must use a presentation-only external orbit`);
    assert.doesNotMatch(svg, /__project_map_external_contributions__/, `${name} must not synthesize an owned-looking external category hub`);
  }
});
