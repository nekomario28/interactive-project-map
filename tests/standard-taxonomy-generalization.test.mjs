import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { standardizeRepositoryClassification as classifyAction } from "../scripts/standard-taxonomy-runtime.mjs";
import { standardizeRepositoryClassification as classifyHosted } from "../src/standard-taxonomy-runtime.ts";
import { STANDARD_TAXONOMY_CATEGORIES, STANDARD_TAXONOMY_ID } from "../scripts/standard-taxonomy.mjs";

async function fixture() {
  return JSON.parse(await readFile(new URL("../data/standard-taxonomy-generalization.v1.json", import.meta.url), "utf8"));
}

function complete(raw, index = 0) {
  return {
    id: index + 1,
    name: raw.name,
    html_url: `https://github.com/generalization/${encodeURIComponent(raw.name)}`,
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

function classify(entry, index = 0) {
  return classifyAction(complete(entry.repo, index)).classification;
}

test("multilingual generalization corpus covers all 16 standard purposes outside English/Japanese", async () => {
  const data = await fixture();
  assert.equal(data.version, 1);
  assert.equal(data.taxonomyId, STANDARD_TAXONOMY_ID);
  assert.equal(data.fixtureKind, "curated-generalization-gate");
  assert.equal(data.multilingualCases.length, STANDARD_TAXONOMY_CATEGORIES.length);

  const expectedIds = new Set(STANDARD_TAXONOMY_CATEGORIES.map((category) => category.id));
  const seenIds = new Set();
  const locales = new Map();
  data.multilingualCases.forEach((entry, index) => {
    assert.ok(["es", "zh", "ko", "de"].includes(entry.locale), `${entry.id} uses unsupported gate locale`);
    locales.set(entry.locale, (locales.get(entry.locale) ?? 0) + 1);
    assert.equal(expectedIds.has(entry.expectedCategoryId), true);
    assert.equal(seenIds.has(entry.expectedCategoryId), false, `${entry.expectedCategoryId} appears more than once`);
    seenIds.add(entry.expectedCategoryId);
    const classification = classify(entry, index);
    assert.equal(classification?.categoryId, entry.expectedCategoryId, `${entry.id}: expected ${entry.expectedCategoryId}, got ${classification?.categoryId ?? "ambiguous"}`);
    assert.ok(classification.confidence >= 0.9);
  });

  assert.deepEqual([...seenIds].sort(), [...expectedIds].sort());
  assert.deepEqual(Object.fromEntries([...locales].sort()), { de: 4, es: 4, ko: 4, zh: 4 });
});

test("sparse metadata assigns only when bounded evidence is strong enough", async () => {
  const data = await fixture();
  assert.ok(data.sparseCases.length >= 8);
  data.sparseCases.forEach((entry, index) => {
    const classification = classify(entry, index);
    assert.equal(classification?.categoryId, entry.expectedCategoryId, `${entry.id}: expected ${entry.expectedCategoryId}, got ${classification?.categoryId ?? "ambiguous"}`);
  });
});

test("technology, language, and balanced neighboring-domain hints remain ambiguous", async () => {
  const data = await fixture();
  assert.ok(data.negativeCases.length >= 10);
  data.negativeCases.forEach((entry, index) => {
    assert.equal(classify(entry, index), undefined, `${entry.id} should remain explicitly ambiguous`);
  });
});

test("Action and hosted runtimes stay byte-for-byte equivalent on the generalization corpus", async () => {
  const data = await fixture();
  const entries = [...data.multilingualCases, ...data.sparseCases, ...data.negativeCases];
  entries.forEach((entry, index) => {
    const repo = complete(entry.repo, index);
    assert.deepEqual(
      classifyHosted(repo).classification,
      classifyAction(repo).classification,
      `${entry.id} diverged between Action and hosted standard taxonomy`,
    );
  });
});

test("standard signal profile remains single-source and includes multilingual vocabulary", async () => {
  const profile = JSON.parse(await readFile(new URL("../data/standard-taxonomy-signals.v1.json", import.meta.url), "utf8"));
  assert.equal(profile.taxonomyId, STANDARD_TAXONOMY_ID);
  assert.ok(profile.signals["ai-ml"].includes("机器学习"));
  assert.ok(profile.signals["visualization-knowledge"].includes("데이터 시각화"));
  assert.ok(profile.signals["robotics-automation"].includes("robótica"));
  assert.ok(profile.signals["business-productivity"].includes("projektmanagement"));

  const actionSource = await readFile(new URL("../scripts/standard-taxonomy-runtime.mjs", import.meta.url), "utf8");
  assert.match(actionSource, /standard-taxonomy-signals\.v1\.json/);
  assert.doesNotMatch(actionSource, /const STANDARD_SIGNALS = Object\.freeze/);
});
