import assert from "node:assert/strict";
import test from "node:test";
import { renderGalaxySystemsSvg } from "../scripts/galaxy-svg-systems.mjs";

function graphWithContributed() {
  const contributed = {
    id: "repository:outside/project",
    label: "outside/project",
    type: "repository",
    relation: "contributed",
    repositoryOwner: "outside",
    repositoryName: "project",
    url: "https://github.com/outside/project",
    stars: 7,
    forks: 2,
    fork: true,
    archived: true,
    contribution: {
      commits: 1,
      pullRequests: 2,
      mergedPullRequests: 1,
      commitsTruncated: false,
      pullRequestsTruncated: false,
    },
  };
  return {
    contributed,
    graph: {
      owner: "example",
      repositoryCount: 1,
      groupCount: 1,
      contributedRepositoryCount: 1,
      nodes: [
        { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
        { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 1 },
        {
          id: "repository:owned",
          label: "owned",
          type: "repository",
          groupId: "robotics",
          groupLabel: "Robotics",
          url: "https://github.com/example/owned",
          stars: 2,
          forks: 0,
          fork: false,
          archived: false,
        },
        contributed,
      ],
      edges: [
        { source: "user:example", target: "group:robotics", type: "ownership" },
        { source: "group:robotics", target: "repository:owned", type: "membership" },
        { source: "user:example", target: contributed.id, type: "contribution" },
      ],
    },
  };
}

test("Galaxy Systems static SVG matches the interactive Contributed presentation contract", () => {
  const { graph, contributed } = graphWithContributed();
  const svg = renderGalaxySystemsSvg(graph, "dark", 740, 420);

  assert.match(svg, /data-galaxy-preset="systems"/);
  assert.match(svg, /data-galaxy-orbit="contributed"/);
  assert.match(svg, /outside\/project/);
  assert.match(svg, /fill="#E69F00"/);
  assert.match(svg, />Contributed<\/text>/);
  assert.doesNotMatch(svg, /External contributions/);
  assert.doesNotMatch(svg, /__project_map_external_contributions__/);
  assert.doesNotMatch(svg, /stroke="#E69F00"[^>]*stroke-dasharray/);
  assert.equal("groupId" in contributed, false, "rendering must not fabricate owned category membership");
});
