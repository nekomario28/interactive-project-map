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

test("keeps implementation languages distinct while unknown semantic domains share Uncategorized", () => {
  const graph = buildGraph("example", [
    repo("c-project", "C"),
    repo("cpp-project", "C++"),
    repo("csharp-project", "C#"),
  ], true, true);

  const nodes = repositoryNodes(graph);
  assert.deepEqual(new Set(nodes.map((node) => node.language)), new Set(["C", "C++", "C#"]));
  assert.deepEqual(new Set(nodes.map((node) => node.groupId)), new Set(["uncategorized"]));
  assert.ok(nodes.every((node) => node.classification?.categoryId === "uncategorized"));
});

test("does not classify substring-only matches as semantic keywords", () => {
  const graph = buildGraph("example", [
    repo("provisioning-tools", "Shell", { description: "server provisioning utilities" }),
    repo("reactor-simulator", "Rust", { description: "nuclear reactor model" }),
  ], true, true);

  const groups = new Map(repositoryNodes(graph).map((node) => [node.label, node.groupId]));
  assert.equal(groups.get("provisioning-tools"), "uncategorized");
  assert.equal(groups.get("reactor-simulator"), "uncategorized");
});

test("still recognizes normalized multi-word semantic topics", () => {
  const graph = buildGraph("example", [
    repo("detector", "Python", { topics: ["machine-learning", "computer-vision"] }),
  ], true, true);

  const node = repositoryNodes(graph)[0];
  assert.equal(node.groupId, "ai-ml");
  assert.equal(node.language, "Python");
  assert.ok(node.classification?.evidence.some((item) => item.source === "topic"));
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

test("excludes the GitHub profile repository from the project graph", () => {
  const graph = buildGraph("example", [
    repo("example", "Markdown", { stargazers_count: 99 }),
    repo("EXAMPLE", "Markdown"),
    repo("actual-project", "TypeScript"),
  ], true, true);

  assert.deepEqual(repositoryNodes(graph).map((node) => node.label), ["actual-project"]);
  assert.equal(graph.repositoryCount, 1);
  assert.equal(graph.nodes.filter((node) => node.type === "owner").length, 1);
  assert.equal(graph.edges.some((edge) => edge.target === "repository:example" || edge.target === "repository:EXAMPLE"), false);
});
