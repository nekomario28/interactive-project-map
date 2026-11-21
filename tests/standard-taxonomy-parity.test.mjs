import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildGraph } from "../src/graph.ts";
import { attachStandardTaxonomyToGraph, resolveStandardTaxonomy, resolveStandardTaxonomyWithDiagnostics } from "../src/standard-taxonomy-runtime.ts";

import { STANDARD_TAXONOMY_CATEGORIES, STANDARD_TAXONOMY_ID } from "../src/standard-taxonomy.ts";

async function fixture() {
  return JSON.parse(await readFile(new URL("../data/standard-taxonomy-boundaries.v1.json", import.meta.url), "utf8"));
}

function fullRepo(index, raw) {
  return {
    id: index + 1,
    name: raw.name,
    html_url: `https://github.com/parity/${encodeURIComponent(raw.name)}`,
    description: raw.description ?? null,
    language: raw.language ?? null,
    topics: raw.topics ?? [],
    stargazers_count: 0,
    forks_count: 0,
    fork: false,
    archived: false,
    updated_at: "2026-08-20T00:00:00Z",
    readmeExcerpt: raw.readmeExcerpt ?? "",
    manifests: raw.manifests ?? [],
    frameworks: raw.frameworks ?? [],
    ...(raw.classification ? { classification: raw.classification } : {}),
  };
}

test("plain and diagnostic standard-taxonomy APIs return the same taxonomy", async () => {
  const data = await fixture();
  const entries = [...data.cases, ...data.confusableCases, ...data.ambiguousCases];
  for (const repos of [[], entries.map((entry, index) => fullRepo(index, entry.repo))]) {
    const result = await resolveStandardTaxonomyWithDiagnostics(repos);
    assert.deepEqual(await resolveStandardTaxonomy(repos), result.taxonomy);
    assert.equal(result.diagnostics.documents, repos.length);
    assert.equal(result.diagnostics.reason, "standard-v1");
    assert.equal(result.diagnostics.reused, true);
  }
});

test("hosted dynamic graph promotes standard-v1 taxonomy assignments into visible groups", async () => {
  const data = await fixture();
  const selected = [
    data.cases.find((entry) => entry.id === "viz-en"),
    data.cases.find((entry) => entry.id === "robot-en"),
    data.cases.find((entry) => entry.id === "mod-en"),
    data.cases.find((entry) => entry.id === "business-en"),
  ];
  const repos = selected.map((entry, index) => fullRepo(index, entry.repo));
  const graph = buildGraph("parity", repos, true, true);
  await attachStandardTaxonomyToGraph(graph, repos);

  assert.equal(graph.taxonomy?.source.providerId, "standard");
  assert.equal(graph.taxonomy?.source.model, STANDARD_TAXONOMY_ID);
  assert.equal(graph.taxonomy?.categories.length, STANDARD_TAXONOMY_CATEGORIES.length);
  assert.equal(graph.taxonomyAssignmentVersion, 1);

  const expected = new Map(selected.map((entry) => [entry.repo.name, entry.expectedCategoryId]));
  for (const node of graph.nodes.filter((item) => item.type === "repository")) {
    assert.equal(node.taxonomyAssignment?.categoryId, expected.get(node.label));
    assert.equal(node.taxonomyAssignment?.method, "deterministic");
    assert.equal(node.groupId, expected.get(node.label), `${node.label} visible hierarchy must match standard-v1 assignment`);
    assert.equal(node.groupLabel, graph.taxonomy.categories.find((category) => category.id === expected.get(node.label))?.label);
  }
  assert.deepEqual(
    new Set(graph.nodes.filter((node) => node.type === "group").map((node) => node.id)),
    new Set([...expected.values()].map((categoryId) => `group:${categoryId}`)),
  );
});

test("standard signal profile covers exactly the versioned standard primary IDs", async () => {
  const profile = JSON.parse(await readFile(new URL("../data/standard-taxonomy-signals.v1.json", import.meta.url), "utf8"));
  assert.equal(profile.version, 1);
  assert.equal(profile.taxonomyId, STANDARD_TAXONOMY_ID);
  assert.deepEqual(Object.keys(profile.signals).sort(), STANDARD_TAXONOMY_CATEGORIES.map((category) => category.id).sort());
  for (const [categoryId, values] of Object.entries(profile.signals)) {
    assert.ok(values.length >= 4, `${categoryId} has an under-specified standard signal profile`);
    assert.equal(new Set(values.map((value) => value.normalize("NFKC").toLocaleLowerCase("en-US"))).size, values.length, `${categoryId} has duplicate signals`);
  }
});
