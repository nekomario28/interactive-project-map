import assert from "node:assert/strict";
import test from "node:test";
import { buildGraph } from "../scripts/graph.mjs";

function repo(name, language, overrides = {}) {
  return {
    id: Math.floor(Math.random() * 1_000_000),
    name,
    html_url: `https://github.com/example/${name}`,
    description: null,
    language,
    topics: [],
    stargazers_count: 0,
    forks_count: 0,
    fork: false,
    archived: false,
    updated_at: "2026-08-18T00:00:00Z",
    ...overrides,
  };
}

function repositoryNodes(graph) {
  return graph.nodes.filter((node) => node.type === "repository");
}

test("keeps C, C++ and C# in distinct fallback language groups", () => {
  const graph = buildGraph("example", [
    repo("c-project", "C"),
    repo("cpp-project", "C++"),
    repo("csharp-project", "C#"),
  ], true, true);

  const groups = new Map(repositoryNodes(graph).map((node) => [node.language, node.groupId]));
  assert.equal(groups.size, 3);
  assert.equal(groups.get("C"), "lang-c");
  assert.equal(groups.get("C++"), "lang-c-u2b-u2b");
  assert.equal(groups.get("C#"), "lang-c-u23");
});

test("does not classify substring-only matches as semantic keywords", () => {
  const graph = buildGraph("example", [
    repo("provisioning-tools", "Shell", { description: "server provisioning utilities" }),
    repo("reactor-simulator", "Rust", { description: "nuclear reactor model" }),
  ], true, true);

  const groups = new Map(repositoryNodes(graph).map((node) => [node.label, node.groupId]));
  assert.equal(groups.get("provisioning-tools"), "lang-shell");
  assert.equal(groups.get("reactor-simulator"), "lang-rust");
});

test("still recognizes normalized multi-word semantic keywords", () => {
  const graph = buildGraph("example", [
    repo("detector", "Python", { topics: ["machine-learning", "computer-vision"] }),
  ], true, true);

  assert.equal(repositoryNodes(graph)[0].groupId, "ai-ml");
});

test("respects fork and archived filters", () => {
  const graph = buildGraph("example", [
    repo("normal", "Python"),
    repo("forked", "Python", { fork: true }),
    repo("old", "Python", { archived: true }),
  ], false, false);

  assert.deepEqual(repositoryNodes(graph).map((node) => node.label), ["normal"]);
  assert.equal(graph.repositoryCount, 1);
});
