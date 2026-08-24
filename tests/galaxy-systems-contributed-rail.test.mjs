import assert from "node:assert/strict";
import test from "node:test";
import { renderGalaxySystemsSvg } from "../scripts/galaxy-svg-systems.mjs";

function crowdedSystemsGraph() {
  const groups = Array.from({ length: 6 }, (_, index) => ({
    id: `group:g${index}`,
    label: `Category ${index + 1}`,
    type: "group",
    repositoryCount: index === 0 ? 4 : 2,
  }));
  const owned = Array.from({ length: 14 }, (_, index) => ({
    id: `repository:owned-${index}`,
    label: `owned-${index}`,
    type: "repository",
    url: `https://github.com/example/owned-${index}`,
    stars: index % 4,
    forks: 0,
    fork: false,
    archived: false,
    groupId: `g${index % groups.length}`,
    groupLabel: `Category ${(index % groups.length) + 1}`,
  }));
  const contributed = Array.from({ length: 12 }, (_, index) => ({
    id: `repository:outside/project-${index}`,
    label: `outside/project-${index}`,
    type: "repository",
    relation: "contributed",
    repositoryOwner: "outside",
    repositoryName: `project-${index}`,
    url: `https://github.com/outside/project-${index}`,
    stars: 12 - index,
    forks: 0,
    fork: false,
    archived: false,
    contribution: { commits: 1, pullRequests: 1, mergedPullRequests: 1 },
  }));
  return {
    owner: "example",
    repositoryCount: owned.length,
    groupCount: groups.length,
    contributedRepositoryCount: contributed.length,
    nodes: [
      { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
      ...groups,
      ...owned,
      ...contributed,
    ],
    edges: [],
  };
}

test("Galaxy Systems keeps crowded Contributed repositories in a dedicated external rail", () => {
  const width = 740;
  const height = 420;
  const svg = renderGalaxySystemsSvg(crowdedSystemsGraph(), "dark", width, height);

  assert.match(svg, /data-galaxy-external-layout="rail"/);
  assert.match(svg, /data-galaxy-external-backdrop="true"/);
  assert.match(svg, />Contributed<\/text>/);

  const placements = [...svg.matchAll(
    /data-galaxy-orbit="contributed" data-galaxy-placement="external-rail" transform="translate\(([0-9.]+) ([0-9.]+)\)"/gu,
  )];
  assert.equal(placements.length, 12);

  const xs = placements.map((match) => Number(match[1]));
  const ys = placements.map((match) => Number(match[2]));
  assert.ok(Math.min(...xs) > width * 0.75, `expected external rail to stay at the right edge, got x=${Math.min(...xs)}`);
  assert.ok(Math.min(...ys) >= 54, `expected top clearance, got y=${Math.min(...ys)}`);
  assert.ok(Math.max(...ys) <= height - 44, `expected legend clearance, got y=${Math.max(...ys)}`);

  const sortedY = [...ys].sort((a, b) => a - b);
  const gaps = sortedY.slice(1).map((value, index) => value - sortedY[index]);
  assert.ok(Math.min(...gaps) >= 24, `expected readable external-node spacing, got ${Math.min(...gaps)}`);

  const externalStart = svg.indexOf('data-galaxy-external-layout="rail"');
  const externalSlice = svg.slice(externalStart);
  assert.doesNotMatch(externalSlice, /<animateTransform/u, "Contributed must not re-enter owned category motion through a global orbit");
});
