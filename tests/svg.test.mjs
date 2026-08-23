import assert from "node:assert/strict";
import test from "node:test";
import { buildGraph } from "../scripts/graph.mjs";
import { renderGalaxyClassicSvg } from "../scripts/galaxy-svg-classic.mjs";
import { renderGalaxySystemsSvg } from "../scripts/galaxy-svg-systems.mjs";
import { renderGalaxyHybridSvg } from "../scripts/galaxy-svg-hybrid.mjs";
import { renderGalaxySvg } from "../scripts/svg.mjs";

function repo(index) {
  return {
    id: index,
    name: `project-${index}`,
    html_url: `https://github.com/example/project-${index}`,
    description: null,
    language: index % 2 ? "Python" : "TypeScript",
    topics: index % 3 === 0 ? ["robotics"] : [],
    stargazers_count: index % 5,
    forks_count: 0,
    fork: false,
    archived: false,
    updated_at: new Date(Date.UTC(2026, 0, 1 + (index % 28))).toISOString(),
  };
}

function contributedNode() {
  return {
    id: "repository:external/accepted-work",
    label: "external/accepted-work",
    type: "repository",
    relation: "contributed",
    repositoryOwner: "external",
    repositoryName: "accepted-work",
    url: "https://github.com/external/accepted-work",
    description: "Accepted upstream work",
    language: "TypeScript",
    topics: ["visualization"],
    stars: 2,
    forks: 0,
    fork: false,
    archived: false,
    contribution: {
      commits: 0,
      pullRequests: 1,
      mergedPullRequests: 1,
      commitsTruncated: false,
      pullRequestsTruncated: false,
    },
    classification: {
      categoryId: "web-apps",
      categoryLabel: "Web / Apps",
      secondaryTags: [],
      confidence: 0.9,
      method: "deterministic",
      evidence: [],
    },
  };
}

test("Galaxy Classic preserves the static single-galaxy renderer", () => {
  const graph = buildGraph("example", Array.from({ length: 18 }, (_, index) => repo(index)), true, true);
  const svg = renderGalaxyClassicSvg(graph, "dark", 740, 420);
  assert.match(svg, /data-galaxy-preset="classic"/);
  assert.match(svg, /aria-label="Galaxy-style map of example/);
  assert.doesNotMatch(svg, /<animateTransform\b/);
  assert.doesNotMatch(svg, /<script\b/i);
});

test("Galaxy Systems emits slow nested declarative motion with a valid static frame", () => {
  const graph = buildGraph("example", Array.from({ length: 18 }, (_, index) => repo(index)), true, true);
  const svg = renderGalaxySystemsSvg(graph, "dark", 740, 420);
  assert.match(svg, /data-galaxy-preset="systems"/);
  assert.match(svg, /data-galaxy-system="group:/);
  assert.match(svg, /data-galaxy-orbit="repository"/);
  assert.match(svg, /dur="1800s"/);
  assert.match(svg, /dur="360s"/);
  assert.match(svg, /<animateTransform attributeName="transform" type="translate"/);
  assert.doesNotMatch(svg, /<script\b/i);
  assert.doesNotMatch(svg, /stroke-width="1" opacity="0\.32"/, "Systems must not draw always-on owner-category spokes");
});

test("Galaxy Systems static frame is category-first and labels at most two representative repositories per category", () => {
  const graph = buildGraph("example", Array.from({ length: 18 }, (_, index) => repo(index)), true, true);
  const svg = renderGalaxySystemsSvg(graph, "dark", 740, 420);
  const categoryCount = graph.nodes.filter((node) => node.type === "group").length;
  const repositoryCount = graph.nodes.filter((node) => node.type === "repository").length;
  const categoryMarkers = svg.match(/data-static-category=/g) ?? [];
  const representativeMarkers = svg.match(/data-static-representative="true"/g) ?? [];
  const hiddenMarkers = svg.match(/data-static-representative="false"/g) ?? [];
  assert.equal(categoryMarkers.length, categoryCount, "every category should have one static heading node");
  assert.ok(representativeMarkers.length <= categoryCount * 2, "static Systems must label at most two representatives per category");
  assert.equal(representativeMarkers.length + hiddenMarkers.length, repositoryCount, "every repository node must remain in the SVG");
  assert.ok(hiddenMarkers.length > 0, "normal-size portfolios should retain unlabeled orbiting repository nodes");
  assert.match(svg, /r="42\.0"/, "first repository orbit should leave room for the category hub");
  assert.match(svg, /font-size="10\.5" font-weight="650"/, "category headings should retain the original Galaxy Systems node-label styling");
  assert.doesNotMatch(svg, /data-static-category="[^"]+">[^]*?<rect[^>]+rx="10\.5"/, "category headings must not use the pill treatment");
  assert.match(svg, /text-anchor="(?:start|end|middle)" fill="#[0-9a-f]{6}" font-size="9\.2"/, "representative labels should use outward radial anchors");
});

test("Galaxy Systems projects Contributed repositories into a presentation-only external system", () => {
  const graph = buildGraph("example", Array.from({ length: 6 }, (_, index) => repo(index)), true, true);
  const contributed = contributedNode();
  graph.nodes.push(contributed);
  graph.edges.push({ source: "user:example", target: contributed.id, type: "contribution" });
  graph.contributedRepositoryCount = 1;

  assert.equal("groupId" in contributed, false, "canonical Contributed node must start without owned category membership");
  const svg = renderGalaxySystemsSvg(graph, "dark", 740, 420);

  assert.match(svg, /External contributions/);
  assert.match(svg, /external\/accepted-work/);
  assert.match(svg, /Contributed/);
  assert.match(svg, /fill="#E69F00"/);
  assert.match(svg, /stroke="#E69F00"[^>]+stroke-dasharray="3 3"/);
  assert.equal("groupId" in contributed, false, "SVG projection must not mutate canonical graph membership");
  const repositoryMarkers = svg.match(/data-galaxy-orbit="repository"/g) ?? [];
  assert.equal(repositoryMarkers.length, graph.nodes.filter((node) => node.type === "repository").length, "every owned and Contributed repository should remain in Systems SVG");
});

test("Galaxy Hybrid emits a rotating spiral with local elliptical repository systems", () => {
  const graph = buildGraph("example", Array.from({ length: 18 }, (_, index) => repo(index)), true, true);
  const svg = renderGalaxyHybridSvg(graph, "dark", 740, 420);
  assert.match(svg, /data-galaxy-preset="hybrid"/);
  assert.match(svg, /data-hybrid-dust="true"/);
  assert.match(svg, /data-hybrid-system="group:/);
  assert.match(svg, /<ellipse\b/);
  assert.match(svg, /dur="2400s"/);
  assert.match(svg, /dur="480s"/);
  assert.doesNotMatch(svg, /<script\b/i);
});

test("Obsidian never inherits Galaxy family declarative animation", () => {
  const graph = buildGraph("example", Array.from({ length: 18 }, (_, index) => repo(index)), true, true);
  const svg = renderGalaxySvg(graph, "dark", 740, 420, "obsidian");
  assert.doesNotMatch(svg, /data-galaxy-preset|data-galaxy-system|data-hybrid-system|animateTransform/);
});

test("large Galaxy Systems and Hybrid maps keep all nodes and use non-animated dense fallbacks", () => {
  const graph = buildGraph("example", Array.from({ length: 100 }, (_, index) => repo(index)), true, true);
  for (const [name, render, marker] of [
    ["systems", renderGalaxySystemsSvg, 'data-galaxy-preset="systems-dense"'],
    ["hybrid", renderGalaxyHybridSvg, 'data-galaxy-preset="hybrid-dense"'],
  ]) {
    const svg = render(graph, "dark", 740, 420);
    const circles = (svg.match(/<circle\b/g) ?? []).length;
    const titles = (svg.match(/<title>/g) ?? []).length;
    const texts = (svg.match(/<text\b/g) ?? []).length;
    assert.match(svg, new RegExp(marker));
    assert.ok(circles >= 100, `${name}: all repository nodes should still be rendered`);
    assert.ok(titles >= 100, `${name}: each repository node should retain a hover title`);
    assert.ok(texts < 60, `${name}: expected label thinning, got ${texts} text elements`);
    assert.doesNotMatch(svg, /<animateTransform\b/, `${name}: dense fallback must not emit hundreds of animations`);
  }
});
