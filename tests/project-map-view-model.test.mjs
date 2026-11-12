import test from "node:test";
import assert from "node:assert/strict";

import { ProjectMapViewModel } from "../packages/project-map-view-model/src/index.js";

function fixture() {
  return {
    owner: "example",
    generatedAt: "2026-08-26T00:00:00Z",
    taxonomy: { categories: [{ id: "robotics", label: "Robotics", aliases: ["robots"] }] },
    nodes: [
      { id: "user:example", label: "example", type: "owner" },
      { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 1 },
      { id: "group:archive", label: "Archive", type: "group", repositoryCount: 1 },
      {
        id: "repository:alpha",
        label: "alpha",
        type: "repository",
        url: "https://github.com/example/alpha",
        groupId: "robotics",
        groupLabel: "Robotics",
        taxonomyAssignment: { secondaryTags: ["robot-control"] },
        updatedAt: "2026-08-25T00:00:00Z",
      },
      {
        id: "repository:old",
        label: "old",
        type: "repository",
        url: "https://github.com/example/old",
        groupId: "archive",
        groupLabel: "Archive",
        archived: true,
      },
      {
        id: "repository:outside/beta",
        label: "outside/beta",
        type: "repository",
        relation: "contributed",
        repositoryOwner: "outside",
        repositoryName: "beta",
        url: "https://github.com/outside/beta",
        fork: true,
        archived: true,
        updatedAt: "2026-08-24T00:00:00Z",
        contribution: {
          commits: 3,
          pullRequests: 2,
          mergedPullRequests: 1,
          commitsTruncated: false,
          pullRequestsTruncated: false,
        },
      },
    ],
    edges: [
      { source: "user:example", target: "group:robotics", type: "ownership" },
      { source: "group:robotics", target: "repository:alpha", type: "membership" },
      { source: "user:example", target: "group:archive", type: "ownership" },
      { source: "group:archive", target: "repository:old", type: "membership" },
      { source: "group:robotics", target: "repository:outside/beta", type: "membership" },
    ],
    semanticEdges: [{ source: "repository:alpha", target: "repository:old", type: "semantic", score: 0.8 }],
    externalContributions: {
      window: { from: "2026-07-01T00:00:00Z", to: "2026-08-26T00:00:00Z" },
      cap: 12,
      candidateRepositories: 1,
      includedRepositories: 1,
      omittedRepositories: 0,
      truncatedRepositories: 0,
    },
  };
}

test("shared Project Map admission preserves strict Contributed identity and safe metadata", () => {
  const graph = ProjectMapViewModel.sanitizeGraph(fixture(), "example");
  assert.ok(graph);
  assert.deepEqual(ProjectMapViewModel.statusCounts(graph), { original: 1, fork: 0, archived: 1, contributed: 1 });

  const contributed = graph.nodes.find((node) => node.relation === "contributed");
  assert.equal(contributed.id, "repository:outside/beta");
  assert.equal(contributed.externalOwner, "outside");
  assert.equal(contributed.contribution.mergedPullRequests, 1);
  assert.equal(contributed.updatedAt, "2026-08-24T00:00:00Z");
  assert.deepEqual(graph.nodes.find((node) => node.id === "repository:alpha").searchFacets, ["robot-control"]);
  assert.deepEqual(graph.searchTaxonomy.categories[0], { id: "robotics", label: "Robotics", aliases: ["robots"] });

  assert.equal(graph.edges.some((edge) => edge.type === "membership" && edge.target === contributed.id), false);
  assert.equal(graph.edges.some((edge) => edge.type === "contribution" && edge.target === contributed.id), true);
});

test("status projection prunes empty categories and relation edges instead of only hiding repository paint", () => {
  const graph = ProjectMapViewModel.sanitizeGraph(fixture(), "example");
  const projected = ProjectMapViewModel.projectByStatuses(graph, ["original", "contributed"]);

  assert.deepEqual(
    projected.nodes.map((node) => node.id).sort(),
    ["group:robotics", "repository:alpha", "repository:outside/beta", "user:example"].sort(),
  );
  assert.equal(projected.nodes.some((node) => node.id === "group:archive"), false);
  assert.equal(projected.edges.some((edge) => edge.target === "group:archive" || edge.target === "repository:old"), false);
  assert.equal(projected.semanticEdges.length, 0);
  assert.equal(projected.groupCount, 1);
  assert.equal(projected.repositoryCount, 2);
});

test("malformed Contributed diagnostics fail closed", () => {
  const value = fixture();
  value.externalContributions.includedRepositories = 0;
  assert.equal(ProjectMapViewModel.sanitizeGraph(value, "example"), null);
});

test("owner stats survive sanitized graph projection without treating missing followers as zero", () => {
  const source = fixture();
  const owner = source.nodes.find((node) => node.type === "owner");
  owner.profileStats = { ownedStars: 12, originalRepositories: 3, followers: null, contributedRepositories: 1,
    mergedPullRequests: 2, commits: 4, limitedRepositories: false, limitedContributions: true };
  const contributed = source.nodes.find((node) => node.relation === "contributed");
  contributed.forkUrl = "https://github.com/example/beta";
  const clean = ProjectMapViewModel.sanitizeGraph(source, "example");
  assert.equal(clean.nodes.find((node) => node.type === "owner").profileStats.ownedStars, 12);
  assert.equal(clean.nodes.find((node) => node.type === "owner").profileStats.followers, null);
  assert.equal(clean.nodes.find((node) => node.relation === "contributed").forkUrl, contributed.forkUrl);
  owner.profileStats.ownedStars = -1;
  assert.equal(ProjectMapViewModel.sanitizeGraph(source, "example"), null);
});
