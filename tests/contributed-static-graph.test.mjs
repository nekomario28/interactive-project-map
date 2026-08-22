import assert from "node:assert/strict";
import test from "node:test";
import { attachContributedRepositories } from "../src/contributed-graph.ts";
import { buildGraph } from "../src/graph.ts";
import { sanitizeStaticGraph } from "../src/static-graph.ts";

function ownedRepo(name = "owned") {
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
    updated_at: "2026-08-01T00:00:00Z",
  };
}

function external(overrides = {}) {
  return {
    nameWithOwner: "outside/project",
    owner: "outside",
    name: "project",
    url: "https://github.com/outside/project",
    description: "public external work",
    language: "Rust",
    topics: ["robotics"],
    stars: 5,
    forks: 1,
    fork: false,
    archived: false,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    commits: 2,
    pullRequests: 3,
    mergedPullRequests: 1,
    commitsTruncated: false,
    pullRequestsTruncated: false,
    ...overrides,
  };
}

const window = { from: "2025-08-22T00:00:00.000Z", to: "2026-08-22T00:00:00.000Z" };

function fixture() {
  return attachContributedRepositories(buildGraph("example", [ownedRepo()], true, true), [external()], window, {
    cap: 4,
    candidateRepositories: 1,
    omittedRepositories: 0,
    truncatedRepositories: 0,
  });
}

test("C2 static sanitizer accepts only explicit public Contributed nodes and reconstructs their edge", () => {
  const source = fixture();
  source.edges.push({ source: "group:robotics", target: "repository:outside/project", type: "membership" });
  source.edges.push({ source: "user:example", target: "repository:outside/project", type: "ownership" });

  const graph = sanitizeStaticGraph(source, "example");
  assert.ok(graph);
  assert.equal(graph.repositoryCount, 1);
  assert.equal(graph.contributedRepositoryCount, 1);
  const contributed = graph.nodes.find((node) => node.relation === "contributed");
  assert.equal(contributed?.label, "outside/project");
  assert.equal(contributed?.url, "https://github.com/outside/project");
  assert.deepEqual(graph.edges.filter((edge) => edge.target === contributed.id), [
    { source: "user:example", target: contributed.id, type: "contribution" },
  ]);
});

test("C2 static sanitizer rejects an external repository without explicit Contributed relation", () => {
  const source = fixture();
  delete source.nodes.find((node) => node.relation === "contributed").relation;
  assert.equal(sanitizeStaticGraph(source, "example"), null);
});

test("C2 static sanitizer rejects non-GitHub or mismatched external repository URLs", () => {
  const source = fixture();
  source.nodes.find((node) => node.relation === "contributed").url = "https://evil.example/outside/project";
  assert.equal(sanitizeStaticGraph(source, "example"), null);

  const mismatched = fixture();
  mismatched.nodes.find((node) => node.relation === "contributed").url = "https://github.com/someone-else/project";
  assert.equal(sanitizeStaticGraph(mismatched, "example"), null);
});

test("C2 static sanitizer rejects invalid contribution counts and graph diagnostics", () => {
  const negative = fixture();
  negative.nodes.find((node) => node.relation === "contributed").contribution.commits = -1;
  assert.equal(sanitizeStaticGraph(negative, "example"), null);

  const mergedBeyondPulls = fixture();
  mergedBeyondPulls.nodes.find((node) => node.relation === "contributed").contribution.mergedPullRequests = 99;
  assert.equal(sanitizeStaticGraph(mergedBeyondPulls, "example"), null);

  const inconsistent = fixture();
  inconsistent.externalContributions.includedRepositories = 0;
  assert.equal(sanitizeStaticGraph(inconsistent, "example"), null);
});

test("C2 static sanitizer never accepts target-user repositories as Contributed", () => {
  const source = fixture();
  const node = source.nodes.find((item) => item.relation === "contributed");
  node.repositoryOwner = "example";
  node.repositoryName = "project";
  node.label = "example/project";
  node.url = "https://github.com/example/project";
  node.id = "repository:example/project";
  assert.equal(sanitizeStaticGraph(source, "example"), null);
});
