import test from "node:test";
import assert from "node:assert/strict";
import { buildGraph } from "../src/graph.ts";
import { sanitizeStaticGraph } from "../src/static-graph.ts";

function repo(name, overrides = {}) {
  return {
    id: 1,
    name,
    html_url: `https://github.com/octocat/${name}`,
    description: "demo",
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

test("valid static graphs are rebuilt from sanitized repository nodes", () => {
  const input = buildGraph("octocat", [repo("hello-world")], true, true);
  const graph = sanitizeStaticGraph(input, "octocat");
  assert.ok(graph);
  assert.equal(graph.owner, "octocat");
  assert.equal(graph.repositoryCount, 1);
  const repository = graph.nodes.find((node) => node.type === "repository");
  assert.equal(repository?.url, "https://github.com/octocat/hello-world");
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
