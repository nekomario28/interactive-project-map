import assert from "node:assert/strict";
import test from "node:test";
import { attachContributedRepositories } from "../scripts/contributed-graph.mjs";
import { buildGraph } from "../scripts/graph.mjs";

function ownedRepo(name) {
  return {
    id: 1,
    name,
    html_url: `https://github.com/example/${name}`,
    description: "owned",
    language: "TypeScript",
    topics: [],
    stargazers_count: 0,
    forks_count: 0,
    fork: false,
    archived: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
  };
}

function external(overrides = {}) {
  return {
    nameWithOwner: "other/same-name",
    owner: "other",
    name: "same-name",
    url: "https://github.com/other/same-name",
    description: "external",
    language: "Rust",
    topics: ["robotics"],
    stars: 10,
    forks: 2,
    fork: true,
    archived: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    commits: 2,
    pullRequests: 3,
    mergedPullRequests: 1,
    commitsTruncated: false,
    pullRequestsTruncated: false,
    ...overrides,
  };
}

const window = { from: "2025-08-22T00:00:00.000Z", to: "2026-08-22T00:00:00.000Z" };

test("C2 uses full owner/repo identity and a non-ownership contribution edge", () => {
  const base = buildGraph("example", [ownedRepo("same-name")], true, true);
  const graph = attachContributedRepositories(base, [external()], window, {
    cap: 4,
    candidateRepositories: 1,
    omittedRepositories: 0,
  });
  const contributed = graph.nodes.find((node) => node.relation === "contributed");
  assert.equal(contributed.id, "repository:other/same-name");
  assert.equal(contributed.label, "other/same-name");
  assert.equal(contributed.repositoryOwner, "other");
  assert.equal(contributed.repositoryName, "same-name");
  assert.equal(contributed.fork, true);
  assert.equal(contributed.archived, true);
  assert.deepEqual(contributed.contribution, {
    commits: 2,
    pullRequests: 3,
    mergedPullRequests: 1,
    commitsTruncated: false,
    pullRequestsTruncated: false,
  });
  assert.ok(graph.nodes.some((node) => node.id === "repository:same-name"), "owned identity remains unchanged");
  assert.deepEqual(graph.edges.filter((edge) => edge.target === contributed.id), [
    { source: "user:example", target: contributed.id, type: "contribution" },
  ]);
  assert.equal(graph.repositoryCount, 1);
  assert.equal(graph.contributedRepositoryCount, 1);
});

test("C2 ownership and membership paths can never reach an external repository", () => {
  const graph = attachContributedRepositories(buildGraph("example", [ownedRepo("owned")], true, true), [external()], window);
  const contributedId = graph.nodes.find((node) => node.relation === "contributed").id;
  const adjacency = new Map();
  for (const edge of graph.edges.filter((edge) => edge.type === "ownership" || edge.type === "membership")) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source).push(edge.target);
  }
  const seen = new Set(["user:example"]);
  const queue = ["user:example"];
  while (queue.length) {
    const current = queue.shift();
    for (const next of adjacency.get(current) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
  }
  assert.equal(seen.has(contributedId), false);
});

test("C2 rejects own-owner, malformed URL, zero-activity, and duplicate external records", () => {
  const base = buildGraph("example", [ownedRepo("owned")], true, true);
  const graph = attachContributedRepositories(base, [
    external({ owner: "example", nameWithOwner: "example/external", name: "external", url: "https://github.com/example/external" }),
    external({ nameWithOwner: "other/bad", name: "bad", url: "https://evil.example/other/bad" }),
    external({ nameWithOwner: "other/zero", name: "zero", url: "https://github.com/other/zero", commits: 0, pullRequests: 0, mergedPullRequests: 0 }),
    external(),
    external({ commits: 99 }),
  ], window);
  assert.equal(graph.contributedRepositoryCount, 1);
  assert.equal(graph.nodes.filter((node) => node.relation === "contributed").length, 1);
});
