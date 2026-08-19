import test from "node:test";
import assert from "node:assert/strict";
import { buildGraph } from "../src/graph.ts";
import { sanitizeStaticGraph } from "../src/static-graph.ts";

function repo(name, overrides = {}) {
  return {
    id: 1,
    name,
    html_url: `https://github.com/octocat/${name}`,
    description: "demo web app",
    language: "TypeScript",
    topics: ["web"],
    stargazers_count: 3,
    forks_count: 1,
    fork: false,
    archived: false,
    updated_at: "2026-08-18T00:00:00Z",
    ...overrides,
  };
}

test("valid static graphs preserve sanitized structured classification and language facets", () => {
  const input = buildGraph("octocat", [repo("hello-world")], true, true);
  const graph = sanitizeStaticGraph(input, "octocat");
  assert.ok(graph);
  assert.equal(graph.owner, "octocat");
  assert.equal(graph.repositoryCount, 1);
  assert.equal(graph.classificationVersion, 1);
  const repository = graph.nodes.find((node) => node.type === "repository");
  assert.equal(repository?.url, "https://github.com/octocat/hello-world");
  assert.equal(repository?.language, "TypeScript");
  assert.equal(repository?.classification?.categoryId, "web-apps");
});

test("legacy static graph without classification fields remains readable and is migrated to Uncategorized", () => {
  const input = buildGraph("octocat", [repo("legacy", { description: null, topics: [] })], true, true);
  delete input.classificationVersion;
  const repository = input.nodes.find((node) => node.type === "repository");
  delete repository.classification;
  repository.groupId = "lang-typescript";
  repository.groupLabel = "TypeScript";

  const graph = sanitizeStaticGraph(input, "octocat");
  assert.ok(graph);
  const rebuilt = graph.nodes.find((node) => node.type === "repository");
  assert.equal(rebuilt?.groupId, "uncategorized");
  assert.equal(rebuilt?.classification?.categoryId, "uncategorized");
  assert.equal(rebuilt?.language, "TypeScript");
});

test("static graph rejects owner mismatch", () => {
  const input = buildGraph("octocat", [repo("hello-world")], true, true);
  assert.equal(sanitizeStaticGraph(input, "someone-else"), null);
});

test("static graph rejects repository URLs outside the requested GitHub owner", () => {
  const input = buildGraph("octocat", [repo("hello-world")], true, true);
  const repository = input.nodes.find((node) => node.type === "repository");
  repository.url = "javascript:alert(1)";
  assert.equal(sanitizeStaticGraph(input, "octocat"), null);

  repository.url = "https://github.com/attacker/hello-world";
  assert.equal(sanitizeStaticGraph(input, "octocat"), null);
});

test("static graph ignores untrusted group and edge structure by rebuilding it", () => {
  const input = buildGraph("octocat", [repo("hello-world")], true, true);
  input.edges = [{ source: "repository:hello-world", target: "https://evil.example", type: "membership" }];
  input.nodes.push({ id: "group:evil", label: "evil", type: "group", repositoryCount: 999 });
  const graph = sanitizeStaticGraph(input, "octocat");
  assert.ok(graph);
  assert.equal(graph.nodes.some((node) => node.id === "group:evil"), false);
  assert.equal(graph.edges.some((edge) => edge.target === "https://evil.example"), false);
});

test("malformed structured classification is discarded instead of creating arbitrary groups", () => {
  const input = buildGraph("octocat", [repo("safe-web")], true, true);
  const repository = input.nodes.find((node) => node.type === "repository");
  repository.classification = {
    categoryId: "../../evil",
    categoryLabel: "Evil",
    secondaryTags: [],
    confidence: 1,
    method: "deterministic",
    evidence: [],
  };
  repository.groupId = "../../evil";
  repository.groupLabel = "Evil";

  const graph = sanitizeStaticGraph(input, "octocat");
  assert.ok(graph);
  const rebuilt = graph.nodes.find((node) => node.type === "repository");
  assert.equal(rebuilt?.classification?.categoryId, "web-apps");
  assert.equal(graph.nodes.some((node) => node.id === "group:../../evil"), false);
});
