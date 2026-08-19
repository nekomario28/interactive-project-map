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
