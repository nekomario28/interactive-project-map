import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  STANDARD_ARTIFACT_FACETS,
  STANDARD_PLATFORM_FACETS,
  STANDARD_TAXONOMY_CATEGORIES,
  STANDARD_TAXONOMY_ID,
  STANDARD_TAXONOMY_SCHEMA_VERSION,
} from "../scripts/standard-taxonomy.mjs";

const CATEGORY_ID_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

test("standard taxonomy v1 is stable, bounded, unique, and matches the machine-readable source", async () => {
  const raw = JSON.parse(await readFile(new URL("../data/standard-taxonomy.v1.json", import.meta.url), "utf8"));
  assert.equal(raw.schemaVersion, STANDARD_TAXONOMY_SCHEMA_VERSION);
  assert.equal(raw.taxonomyId, STANDARD_TAXONOMY_ID);
  assert.equal(raw.scope, "github-project-purpose");
  assert.equal(STANDARD_TAXONOMY_CATEGORIES.length, 16);
  assert.deepEqual(raw.categories, STANDARD_TAXONOMY_CATEGORIES.map((category) => ({ ...category, aliases: [...category.aliases] })));

  const ids = new Set();
  for (const category of STANDARD_TAXONOMY_CATEGORIES) {
    assert.match(category.id, CATEGORY_ID_RE);
    assert.ok(category.label.length > 0 && category.label.length <= 80);
    assert.ok(category.description.length > 20 && category.description.length <= 500);
    assert.ok(category.aliases.length > 0 && category.aliases.length <= 32);
    assert.equal(ids.has(category.id), false, `duplicate category id ${category.id}`);
    ids.add(category.id);
  }

  assert.equal(ids.has("visualization-knowledge"), true);
  assert.equal(ids.has("developer-tools"), true);
  assert.equal(ids.has("game-development"), true);
  assert.equal(ids.has("game-modding"), true);
  assert.equal(ids.has("general-other"), false, "uncertainty must remain explicit instead of becoming a catch-all success category");
});

test("standard facet vocabularies are namespaced separately from primary categories", async () => {
  const raw = JSON.parse(await readFile(new URL("../data/standard-taxonomy.v1.json", import.meta.url), "utf8"));
  assert.deepEqual(raw.facets.artifact.values, [...STANDARD_ARTIFACT_FACETS]);
  assert.deepEqual(raw.facets.platform.values, [...STANDARD_PLATFORM_FACETS]);
  assert.equal(raw.facets.ecosystem.closedVocabulary, false);
  assert.equal(raw.facets.topic.closedVocabulary, false);
  assert.match(raw.facets.ecosystem.format, /^ecosystem:/);
  assert.match(raw.facets.topic.format, /^topic:/);
});

test("reviewed public portfolio fixture uses only standard-v1 category ids and preserves the approved five-way split", async () => {
  const fixture = JSON.parse(await readFile(new URL("../docs/semantic-evaluation-nekomario28.standard-v1.json", import.meta.url), "utf8"));
  const categoryIds = new Set(STANDARD_TAXONOMY_CATEGORIES.map((category) => category.id));
  const entries = Object.entries(fixture.repositories);
  assert.equal(fixture.taxonomyId, STANDARD_TAXONOMY_ID);
  assert.equal(entries.length, 12);
  assert.equal(Object.hasOwn(fixture.repositories, "nekomario28"), false);

  const distribution = new Map();
  for (const [repo, expected] of entries) {
    assert.equal(categoryIds.has(expected.categoryId), true, `${repo} references non-standard category ${expected.categoryId}`);
    assert.ok(Array.isArray(expected.secondaryTags));
    for (const tag of expected.secondaryTags) assert.match(tag, /^(artifact|platform|ecosystem|topic):[a-z0-9][a-z0-9-]*$/);
    distribution.set(expected.categoryId, (distribution.get(expected.categoryId) ?? 0) + 1);
  }

  assert.deepEqual(Object.fromEntries([...distribution.entries()].sort()), {
    "game-development": 1,
    "game-modding": 7,
    "hardware-embedded": 1,
    "robotics-automation": 2,
    "visualization-knowledge": 1,
  });
  assert.equal(fixture.repositories["interactive-project-map"].categoryId, "visualization-knowledge");
});
