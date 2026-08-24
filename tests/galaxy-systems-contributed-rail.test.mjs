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

test("Galaxy Systems restores Contributed as a natural outer halo with outward-only lanes", () => {
  const svg = renderGalaxySystemsSvg(crowdedSystemsGraph(), "dark", 740, 420);

  assert.match(svg, /data-galaxy-external-layout="halo"/);
  assert.match(svg, /data-galaxy-placement="external-halo-orbit"/);
  assert.doesNotMatch(svg, /data-galaxy-external-layout="rail"/);
  assert.doesNotMatch(svg, /data-galaxy-external-backdrop/);
  assert.doesNotMatch(svg, />external repositories<\/text>/);

  const placements = [...svg.matchAll(
    /data-galaxy-orbit="contributed" data-galaxy-placement="external-halo-orbit" data-galaxy-lane="([0-9]+)" data-galaxy-radius="([0-9.]+)"/gu,
  )];
  assert.equal(placements.length, 12);
  const lane0 = placements.filter((match) => Number(match[1]) === 0).map((match) => Number(match[2]));
  const lane1 = placements.filter((match) => Number(match[1]) === 1).map((match) => Number(match[2]));
  assert.equal(lane0.length, 6);
  assert.equal(lane1.length, 6);
  assert.ok(Math.min(...lane1) > Math.max(...lane0), "later Contributed lanes must expand outward, never back through owned systems");

  const externalStart = svg.indexOf('data-galaxy-external-layout="halo"');
  assert.match(svg.slice(externalStart), /<animateTransform/u, "Contributed should remain part of the living galaxy instead of becoming a stationary UI shelf");
});

test("Galaxy Systems static background carries the historical profile-local world structure", () => {
  const svg = renderGalaxySystemsSvg(crowdedSystemsGraph(), "dark", 740, 420);
  assert.match(svg, /data-profile-galaxy-background="ead72debca2a16608ebc5b799993c0234ea10cab"/);
  assert.equal((svg.match(/data-profile-galaxy-ring=/g) || []).length, 3);
  assert.equal((svg.match(/data-profile-galaxy-arm=/g) || []).length, 6);
  assert.equal((svg.match(/data-profile-stellar-association=/g) || []).length, 6);
  assert.match(svg, /profile-galaxy-nucleus/);
});
