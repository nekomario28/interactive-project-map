import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { standardizeRepositoryClassification } from "../scripts/standard-taxonomy-runtime.mjs";
import { STANDARD_TAXONOMY_CATEGORIES, STANDARD_TAXONOMY_ID } from "../scripts/standard-taxonomy.mjs";

async function fixture() {
  return JSON.parse(await readFile(new URL("../data/standard-taxonomy-boundaries.v1.json", import.meta.url), "utf8"));
}

function classify(entry) {
  return standardizeRepositoryClassification({
    language: null,
    topics: [],
    manifests: [],
    frameworks: [],
    description: null,
    readmeExcerpt: "",
    ...entry.repo,
  }).classification;
}

test("standard-v1 conformance corpus covers every primary category exactly twice", async () => {
  const data = await fixture();
  assert.equal(data.version, 1);
  assert.equal(data.taxonomyId, STANDARD_TAXONOMY_ID);
  assert.equal(data.fixtureKind, "curated-standard-conformance");
  assert.equal(data.cases.length, STANDARD_TAXONOMY_CATEGORIES.length * 2);

  const distribution = new Map();
  const validIds = new Set(STANDARD_TAXONOMY_CATEGORIES.map((category) => category.id));
  for (const entry of data.cases) {
    assert.equal(validIds.has(entry.expectedCategoryId), true, `${entry.id} uses unknown category`);
    distribution.set(entry.expectedCategoryId, (distribution.get(entry.expectedCategoryId) ?? 0) + 1);
    const classification = classify(entry);
    assert.equal(classification?.categoryId, entry.expectedCategoryId, `${entry.id}: expected ${entry.expectedCategoryId}, got ${classification?.categoryId ?? "ambiguous"}`);
    assert.ok(classification.confidence >= 0.9);
  }

  for (const category of STANDARD_TAXONOMY_CATEGORIES) {
    assert.equal(distribution.get(category.id), 2, `${category.id} must have exactly two balanced conformance cases`);
  }
});

test("major confusable boundaries choose project purpose rather than technology or neighboring domain", async () => {
  const data = await fixture();
  assert.equal(data.confusableCases.length, 16);
  for (const entry of data.confusableCases) {
    const classification = classify(entry);
    assert.equal(classification?.categoryId, entry.expectedCategoryId, `${entry.id}: expected ${entry.expectedCategoryId}, got ${classification?.categoryId ?? "ambiguous"}`);
  }

  const byId = new Map(data.confusableCases.map((entry) => [entry.id, classify(entry)?.categoryId]));
  assert.equal(byId.get("viz-not-dev"), "visualization-knowledge");
  assert.equal(byId.get("dev-not-viz"), "developer-tools");
  assert.equal(byId.get("game-not-mod"), "game-development");
  assert.equal(byId.get("mod-not-game"), "game-modding");
  assert.equal(byId.get("robot-not-science"), "robotics-automation");
  assert.equal(byId.get("science-not-robot"), "science-engineering");
});

test("weak generic metadata remains explicit ambiguity instead of falling into a catch-all", async () => {
  const data = await fixture();
  assert.ok(data.ambiguousCases.length >= 4);
  for (const entry of data.ambiguousCases) {
    assert.equal(classify(entry), undefined, `${entry.id} should stay ambiguous`);
  }
});

test("hyphenated GitHub Topics normalize to the same semantic signal as spaced taxonomy aliases", () => {
  const cases = [
    [{ name: "viz", topics: ["data-visualization"] }, "visualization-knowledge"],
    [{ name: "search", topics: ["information-retrieval"] }, "data-analytics"],
    [{ name: "bus", topics: ["message-broker"] }, "networking-distributed"],
    [{ name: "mod", topics: ["minecraft-modding"] }, "game-modding"],
  ];
  for (const [repo, expected] of cases) {
    const classification = standardizeRepositoryClassification(repo).classification;
    assert.equal(classification?.categoryId, expected);
  }
});

test("standard facets are namespaced, bounded, deduplicated, and orthogonal to primary category", async () => {
  const data = await fixture();
  for (const entry of [...data.cases, ...data.confusableCases]) {
    const classification = classify(entry);
    assert.ok(classification);
    assert.ok(classification.secondaryTags.length <= 8);
    assert.equal(new Set(classification.secondaryTags).size, classification.secondaryTags.length);
    for (const tag of classification.secondaryTags) assert.match(tag, /^(artifact|platform|ecosystem|topic):[a-z0-9][a-z0-9-]*$/);
  }

  const mod = classify(data.cases.find((entry) => entry.id === "mod-en"));
  assert.equal(mod.categoryId, "game-modding");
  assert.ok(mod.secondaryTags.includes("artifact:game-mod"));
  assert.ok(mod.secondaryTags.includes("ecosystem:minecraft"));

  const robot = classify(data.cases.find((entry) => entry.id === "robot-en"));
  assert.equal(robot.categoryId, "robotics-automation");
  assert.ok(robot.secondaryTags.includes("ecosystem:ros2"));

  const hardware = classify(data.cases.find((entry) => entry.id === "hardware-en"));
  assert.equal(hardware.categoryId, "hardware-embedded");
  assert.ok(hardware.secondaryTags.includes("platform:embedded"));
});
