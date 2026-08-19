import assert from "node:assert/strict";
import test from "node:test";
import { buildGraph } from "../scripts/graph.mjs";
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

test("normal Galaxy SVG emits category systems with declarative orbit animation and a static fallback", () => {
  const graph = buildGraph("example", Array.from({ length: 18 }, (_, index) => repo(index)), true, true);
  const svg = renderGalaxySvg(graph, "dark", 740, 420, "galaxy");

  assert.match(svg, /aria-label="Galaxy systems map of example/);
  assert.match(svg, /data-galaxy-system="group:/);
  assert.match(svg, /data-galaxy-orbit="true" transform="rotate\(0 /);
  assert.match(svg, /<animateTransform attributeName="transform" type="rotate"[^>]*repeatCount="indefinite"/);
  assert.doesNotMatch(svg, /<script\b/i);

  const obsidian = renderGalaxySvg(graph, "dark", 740, 420, "obsidian");
  assert.doesNotMatch(obsidian, /data-galaxy-system|data-galaxy-orbit|animateTransform/);
});

test("large SVG maps keep all nodes but thin repository labels", () => {
  const graph = buildGraph("example", Array.from({ length: 100 }, (_, index) => repo(index)), true, true);
  const svg = renderGalaxySvg(graph, "dark", 740, 420);

  const circles = (svg.match(/<circle\b/g) ?? []).length;
  const titles = (svg.match(/<title>/g) ?? []).length;
  const texts = (svg.match(/<text\b/g) ?? []).length;

  assert.ok(circles >= 100, "all repository nodes should still be rendered");
  assert.ok(titles >= 100, "each repository node should retain a hover title");
  assert.ok(texts < 60, `expected label thinning, got ${texts} text elements`);
  assert.doesNotMatch(svg, /data-galaxy-orbit="true"/, "large Galaxy should use the bounded dense fallback instead of hundreds of orbit animations");
});
