import assert from "node:assert/strict";
import test from "node:test";
import { buildGraph } from "../scripts/graph.mjs";
import { renderGalaxySystemsSvg } from "../scripts/galaxy-svg-systems.mjs";

function repo(index) {
  return {
    id: index,
    name: `project-${index}`,
    html_url: `https://github.com/example/project-${index}`,
    description: null,
    language: "JavaScript",
    topics: index % 2 ? ["robotics"] : ["minecraft"],
    stargazers_count: index % 3,
    forks_count: 0,
    fork: false,
    archived: false,
    updated_at: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
  };
}

test("Galaxy Systems uses a thinner stroke for compact static labels", () => {
  const graph = buildGraph("example", Array.from({ length: 8 }, (_, index) => repo(index)), true, true);
  const svg = renderGalaxySystemsSvg(graph, "dark", 740, 420);

  assert.match(svg, /data-static-category="[^"]+">[^]*?font-size="10\.5"[^>]*stroke-width="1\.4"/);
  assert.match(svg, /data-static-representative="true"[^]*?font-size="9\.2"[^>]*stroke-width="1\.4"/);
  assert.match(svg, /font-size="13\.5"[^>]*stroke-width="2\.3"/, "owner label should keep the existing stroke");
});
