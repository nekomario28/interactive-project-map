import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const window = {};
runInNewContext(await readFile(new URL("../scripts/public-dedicated-graph.js", import.meta.url), "utf8"), { window, URL });
const api = window.ProjectMapDedicatedGraph;

function fixture() {
  return {
    owner: "example",
    nodes: [{
      id: "repository:outside/beta", label: "outside/beta", type: "repository", relation: "contributed",
      repositoryOwner: "outside", repositoryName: "beta", url: "https://github.com/outside/beta",
      fork: true, archived: true, groupId: "forged-owned-category", createdAt: "2026-01-01T00:00:00Z",
      contribution: { commits: 3, pullRequests: 2, mergedPullRequests: 1, commitsTruncated: false, pullRequestsTruncated: false },
    }],
    externalContributions: {
      window: { from: "2026-01-01T00:00:00Z", to: "2026-08-26T00:00:00Z" },
      cap: 12, candidateRepositories: 1, includedRepositories: 1, omittedRepositories: 0, truncatedRepositories: 0,
    },
  };
}

function admittedBase() {
  return { owner: "example", nodes: [{ id: "user:example", label: "example", type: "owner" }] };
}

test("owned repository metadata canonicalizes GitHub tree URLs while preserving the repository name", () => {
  assert.deepEqual(structuredClone(api.ownedRepositoryMetadata({ url: "https://github.com/EXAMPLE/Alpha/tree/main?tab=readme#title" }, "example", "Alpha")), {
    url: "https://github.com/example/Alpha", description: "", language: null, topics: [], stars: 0, forks: 0, fork: false, archived: false,
  });
});

test("owned repository metadata bounds user text, topics and numeric counts without coercing flags", () => {
  const raw = {
    url: "https://github.com/example/Alpha", description: "x".repeat(2001), language: "l".repeat(101),
    topics: [null, ...Array.from({ length: 41 }, (_, i) => `${i}:` + "t".repeat(81))],
    stars: 1.9, forks: -3, fork: "true", archived: 1,
    createdAt: "2026-01-01", groupId: "forged",
  };
  const before = structuredClone(raw);
  assert.deepEqual(structuredClone(api.ownedRepositoryMetadata(raw, "example", "Alpha")), {
    url: "https://github.com/example/Alpha", description: "x".repeat(2000), language: "l".repeat(100),
    topics: Array.from({ length: 40 }, (_, i) => (`${i}:` + "t".repeat(81)).slice(0, 80)),
    stars: 1, forks: 0, fork: false, archived: false,
  });
  assert.deepEqual(raw, before);
});

test("owned repository metadata rejects foreign identities, non-GitHub destinations and malformed paths", () => {
  for (const url of [
    "https://github.com/other/Alpha", "https://github.com/example/Other", "https://evil.example/example/Alpha",
    "http://github.com/example/Alpha", "javascript:alert(1)", "https://github.com/example", "https://github.com/example/%zz", null,
  ]) {
    assert.equal(api.ownedRepositoryMetadata({ url }, "example", "Alpha"), null, String(url));
  }
  for (const name of ["", "Alpha/Other", "<script>", "a".repeat(101)]) {
    assert.equal(api.ownedRepositoryMetadata({ url: "https://github.com/example/Alpha" }, "example", name), null, name);
  }
});

test("dedicated admission retains external identity and metadata without owned membership", () => {
  const value = fixture();
  const graph = structuredClone(api.completeGraph(value, admittedBase()));
  assert.deepEqual(graph.nodes[1], {
    id: "repository:outside/beta", label: "outside/beta", type: "repository", relation: "contributed",
    repositoryOwner: "outside", repositoryName: "beta", url: "https://github.com/outside/beta",
    description: "", language: null, topics: [], stars: 0, forks: 0, fork: true, archived: true,
    createdAt: "2026-01-01T00:00:00Z",
    contribution: { commits: 3, pullRequests: 2, mergedPullRequests: 1, commitsTruncated: false, pullRequestsTruncated: false },
  });
  assert.equal(graph.contributedRepositoryCount, 1);
  assert.deepEqual(graph.externalContributions, value.externalContributions);
});

test("external repository metadata retains its smaller topic bound", () => {
  const value = fixture();
  value.nodes[0].topics = Array.from({ length: 41 }, (_, i) => `${i}:` + "t".repeat(81));
  const graph = api.completeGraph(value, admittedBase());
  assert.deepEqual(structuredClone(graph.nodes[1].topics), value.nodes[0].topics.slice(0, 20).map((topic) => topic.slice(0, 80)));
});

test("dedicated admission rejects malformed external identity and evidence without partial mutation", () => {
  const mutations = [
    ["non-GitHub URL", (value) => { value.nodes[0].url = "https://evil.example/outside/beta"; }],
    ["extra URL path", (value) => { value.nodes[0].url += "/tree/main"; }],
    ["malformed URL encoding", (value) => { value.nodes[0].url = "https://github.com/outside/%zz"; }],
    ["owned repository", (value) => { value.nodes[0].repositoryOwner = "example"; }],
    ["mismatched label", (value) => { value.nodes[0].label = "other/beta"; }],
    ["mismatched ID", (value) => { value.nodes[0].id = "repository:beta"; }],
    ["excess merged PRs", (value) => { value.nodes[0].contribution.mergedPullRequests = 3; }],
    ["no qualifying contribution", (value) => { value.nodes[0].contribution.commits = 0; value.nodes[0].contribution.mergedPullRequests = 0; }],
    ["nonboolean truncation", (value) => { value.nodes[0].contribution.commitsTruncated = "false"; }],
    ["mismatched diagnostic count", (value) => { value.externalContributions.includedRepositories = 0; }],
    ["reversed diagnostic window", (value) => { value.externalContributions.window.from = "2027-01-01"; }],
    ["invalid candidate total", (value) => { value.externalContributions.candidateRepositories = 2; }],
  ];
  for (const [label, mutate] of mutations) {
    const value = fixture();
    mutate(value);
    const base = admittedBase();
    assert.equal(api.completeGraph(value, base), null, label);
    assert.deepEqual(base, admittedBase(), `${label} must not partially append repositories`);
  }
});

test("dedicated admission rejects duplicate identities and the external repository cap", () => {
  const duplicate = fixture();
  duplicate.nodes.push(structuredClone(duplicate.nodes[0]));
  duplicate.externalContributions.candidateRepositories = duplicate.externalContributions.includedRepositories = 2;
  assert.equal(api.completeGraph(duplicate, admittedBase()), null);

  const collision = admittedBase();
  collision.nodes.push({ id: "repository:outside/beta", type: "group" });
  assert.equal(api.completeGraph(fixture(), collision), null);

  const excessive = fixture();
  excessive.nodes = Array.from({ length: 13 }, (_, i) => ({ ...excessive.nodes[0], id: `repository:outside/beta${i}`, label: `outside/beta${i}`, repositoryName: `beta${i}`, url: `https://github.com/outside/beta${i}` }));
  excessive.externalContributions.candidateRepositories = excessive.externalContributions.includedRepositories = 13;
  assert.equal(api.completeGraph(excessive, admittedBase()), null);
});

test("external layout projection cannot overwrite an owned group or mutate admitted graph membership", () => {
  const graph = api.completeGraph(fixture(), admittedBase());
  graph.nodes.push({ id: "group:__project_map_external_contributions__", label: "Owned", type: "group" });
  const before = structuredClone(graph);
  const projected = structuredClone(api.projectLayout(graph));
  assert.deepEqual(structuredClone(graph), before);
  assert.deepEqual(projected.nodes.at(-1), {
    id: "group:__project_map_external_contributions___", label: "External contributions", type: "group", relation: "contributed", repositoryCount: 1,
  });
  assert.equal(projected.nodes[1].groupId, "__project_map_external_contributions___");
  assert.equal(projected.nodes[1].groupLabel, "External contributions");
  assert.equal(projected.nodes[2].label, "Owned");
});

test("maps without external work retain their admitted graph and layout objects", () => {
  const value = { owner: "example", nodes: [] };
  const base = admittedBase();
  assert.equal(api.completeGraph(value, base), base);
  assert.equal(api.projectLayout(base), base);
});

test("the dedicated evidence snapshot reads current graph rather than a startup copy", () => {
  let graph = null;
  api.installSnapshot("matrix", () => graph);
  assert.deepEqual(structuredClone(window.ProjectMapContributedDedicatedViewer.snapshot()), {
    mode: "matrix", contributedRepositories: [], contributedRepositoryCount: 0,
  });
  graph = api.completeGraph(fixture(), admittedBase());
  assert.deepEqual(structuredClone(window.ProjectMapContributedDedicatedViewer.snapshot()), {
    mode: "matrix", contributedRepositories: ["repository:outside/beta"], contributedRepositoryCount: 1,
  });
});
