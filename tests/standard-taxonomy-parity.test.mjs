import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildGraph } from "../src/graph.ts";
import {
  attachStandardTaxonomyToGraph,
  standardizeRepositoryClassification as classifySource,
} from "../src/standard-taxonomy-runtime.ts";
import { standardizeRepositoryClassification as classifyScript } from "../scripts/standard-taxonomy-runtime.mjs";
import { STANDARD_TAXONOMY_CATEGORIES, STANDARD_TAXONOMY_ID } from "../scripts/standard-taxonomy.mjs";

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

test("Node Action and TypeScript hosted mapper stay byte-for-byte equivalent on the complete boundary corpus", async () => {
  const data = await fixture();
  const entries = [...data.cases, ...data.confusableCases, ...data.ambiguousCases];
  for (let index = 0; index < entries.length; index += 1) {
    const repo = fullRepo(index, entries[index].repo);
    const action = classifyScript(repo).classification;
    const hosted = classifySource(repo).classification;
    assert.deepEqual(hosted, action, `${entries[index].id} diverged between Action and hosted mapper`);
  }
});

test("hosted dynamic graph attaches standard-v1 taxonomy assignments without changing visible P1 groups", async () => {
  const data = await fixture();
  const selected = [
    data.cases.find((entry) => entry.id === "viz-en"),
    data.cases.find((entry) => entry.id === "robot-en"),
    data.cases.find((entry) => entry.id === "mod-en"),
    data.cases.find((entry) => entry.id === "business-en"),
  ];
  const repos = selected.map((entry, index) => fullRepo(index, entry.repo));
  const graph = buildGraph("parity", repos, true, true);
  const beforeGroups = new Map(graph.nodes.filter((node) => node.type === "repository").map((node) => [node.label, node.groupId]));
  await attachStandardTaxonomyToGraph(graph, repos);

  assert.equal(graph.taxonomy?.source.providerId, "standard");
  assert.equal(graph.taxonomy?.source.model, STANDARD_TAXONOMY_ID);
  assert.equal(graph.taxonomy?.categories.length, STANDARD_TAXONOMY_CATEGORIES.length);
  assert.equal(graph.taxonomyAssignmentVersion, 1);

  const expected = new Map(selected.map((entry) => [entry.repo.name, entry.expectedCategoryId]));
  for (const node of graph.nodes.filter((item) => item.type === "repository")) {
    assert.equal(node.taxonomyAssignment?.categoryId, expected.get(node.label));
    assert.equal(node.taxonomyAssignment?.method, "deterministic");
    assert.equal(node.groupId, beforeGroups.get(node.label), `${node.label} visible P1 group changed during hosted parity migration`);
  }
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
