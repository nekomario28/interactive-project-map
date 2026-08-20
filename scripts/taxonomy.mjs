import { semanticDocumentContentHash } from "./embedding.mjs";
import { buildRepoSemanticDocuments } from "./semantic-document.mjs";

export const TAXONOMY_SCHEMA_VERSION = 1;
export const TAXONOMY_OVERRIDE_VERSION = 1;
export const MAX_TAXONOMY_CATEGORIES = 16;
export const DEFAULT_TAXONOMY_MAX_DRIFT_RATIO = 0.15;
export const MAX_TAXONOMY_OVERRIDE_BYTES = 256 * 1024;

const CATEGORY_ID_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const HASH_RE = /^[0-9a-f]{64}$/;

export const DISABLED_TAXONOMY_DISCOVERY_PROVIDER = Object.freeze({
  id: "disabled",
  model: "disabled",
  async discover() {
    throw new Error("Disabled taxonomy discovery provider must not be invoked");
  },
});

function normalizedText(value, maxChars) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxChars);
}

function normalizedAliases(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  for (const raw of value.slice(0, 64)) {
    if (result.length >= 32) break;
    const alias = normalizedText(raw, 80);
    if (!alias) continue;
    const key = alias.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(alias);
  }
  return result.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

function normalizedCategoryId(value) {
  return normalizedText(value, 64).toLocaleLowerCase("en-US");
}

function assertNoParentCycles(categories) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  for (const category of categories) {
    const seen = new Set();
    let current = category;
    while (current?.parentId) {
      if (seen.has(current.id)) throw new Error("Taxonomy category parent cycle detected");
      seen.add(current.id);
      current = byId.get(current.parentId);
    }
  }
}

export function validateTaxonomyCategories(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_TAXONOMY_CATEGORIES) {
    throw new Error(`Taxonomy must contain 1-${MAX_TAXONOMY_CATEGORIES} categories`);
  }
  const categories = [];
  const ids = new Set();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") throw new Error("Taxonomy category must be an object");
    const id = normalizedCategoryId(raw.id);
    const label = normalizedText(raw.label, 80);
    const description = normalizedText(raw.description, 500);
    const parentId = raw.parentId == null || raw.parentId === "" ? undefined : normalizedCategoryId(raw.parentId);
    if (!CATEGORY_ID_RE.test(id)) throw new Error(`Invalid taxonomy category id: ${id || "(empty)"}`);
    if (ids.has(id)) throw new Error(`Duplicate taxonomy category id: ${id}`);
    if (!label) throw new Error(`Taxonomy category ${id} requires a label`);
    if (!description) throw new Error(`Taxonomy category ${id} requires a description`);
    if (parentId && !CATEGORY_ID_RE.test(parentId)) throw new Error(`Invalid parent id for taxonomy category ${id}`);
    if (parentId === id) throw new Error(`Taxonomy category ${id} cannot parent itself`);
    ids.add(id);
    categories.push({ id, label, description, aliases: normalizedAliases(raw.aliases), ...(parentId ? { parentId } : {}) });
  }
  for (const category of categories) {
    if (category.parentId && !ids.has(category.parentId)) throw new Error(`Unknown parent taxonomy category: ${category.parentId}`);
  }
  assertNoParentCycles(categories);
  return categories.sort((a, b) => a.id.localeCompare(b.id));
}

function normalizedProviderIdentity(provider) {
  const id = normalizedText(provider?.id, 120);
  const model = normalizedText(provider?.model, 180);
  if (!id) throw new Error("Taxonomy discovery provider id is required");
  if (!model) throw new Error("Taxonomy discovery provider model is required");
  return { id, model };
}

async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) throw new Error("WebCrypto SHA-256 is required for taxonomy identity");
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function snapshotSort(a, b) {
  return a.repoId - b.repoId || a.name.localeCompare(b.name);
}

async function fingerprintSnapshots(repositories) {
  const canonical = repositories
    .map((item) => ({ repoId: item.repoId, name: item.name, contentHash: item.contentHash }))
    .sort(snapshotSort);
  return sha256Hex(JSON.stringify(canonical));
}

export async function buildTaxonomyDiscoveryInput(repos) {
  const documents = buildRepoSemanticDocuments(repos);
  const tuples = await Promise.all(documents.map(async (document, index) => ({
    document,
    repo: repos[index],
    snapshot: {
      repoId: document.repoId,
      name: document.name,
      contentHash: await semanticDocumentContentHash(document),
    },
  })));
  tuples.sort((a, b) => snapshotSort(a.snapshot, b.snapshot));
  const repositories = tuples.map((item) => item.snapshot);
  const corpusFingerprint = await fingerprintSnapshots(repositories);
  const targetCategoryCount = Math.max(1, Math.min(10, Math.round(Math.sqrt(Math.max(1, repositories.length)))));
  const input = {
    schemaVersion: TAXONOMY_SCHEMA_VERSION,
    corpusFingerprint,
    targetCategoryCount,
    repositories: tuples.map(({ document, repo }) => ({
      repoId: document.repoId,
      name: document.name,
      description: document.description.slice(0, 500),
      topics: [...document.topics],
      readmeExcerpt: document.readmeExcerpt.slice(0, 1_600),
      language: document.language,
      frameworks: [...document.frameworks],
      manifests: [...document.manifests],
      classification: repo.classification ? {
        categoryId: repo.classification.categoryId,
        categoryLabel: repo.classification.categoryLabel,
        confidence: repo.classification.confidence,
        secondaryTags: [...repo.classification.secondaryTags].slice(0, 8),
      } : undefined,
    })),
  };
  return { input, repositories };
}

function structuralTaxonomy(value) {
  if (!value || typeof value !== "object") return null;
  if (value.schemaVersion !== TAXONOMY_SCHEMA_VERSION) return null;
  const corpusFingerprint = normalizedText(value.corpusFingerprint, 64).toLowerCase();
  if (!HASH_RE.test(corpusFingerprint)) return null;
  if (!Array.isArray(value.repositories) || value.repositories.length > 400) return null;
  const repositories = [];
  const keys = new Set();
  for (const raw of value.repositories) {
    if (!raw || typeof raw !== "object") return null;
    const repoId = typeof raw.repoId === "number" && Number.isFinite(raw.repoId) ? Math.trunc(raw.repoId) : -1;
    const name = normalizedText(raw.name, 100);
    const contentHash = normalizedText(raw.contentHash, 64).toLowerCase();
    if (repoId < 0 || !name || !HASH_RE.test(contentHash)) return null;
    const key = repoId > 0 ? `id:${repoId}` : `name:${name.toLowerCase()}`;
    if (keys.has(key)) return null;
    keys.add(key);
    repositories.push({ repoId, name, contentHash });
  }
  let categories;
  try {
    categories = validateTaxonomyCategories(value.categories);
  } catch {
    return null;
  }
  if (!value.source || typeof value.source !== "object") return null;
  const providerId = normalizedText(value.source.providerId, 120);
  const model = normalizedText(value.source.model, 180);
  if (!providerId || !model) return null;
  return {
    schemaVersion: TAXONOMY_SCHEMA_VERSION,
    corpusFingerprint,
    repositories: repositories.sort(snapshotSort),
    categories,
    source: { providerId, model },
  };
}

export function sanitizePortfolioTaxonomy(value) {
  return structuralTaxonomy(value);
}

async function verifiedPreviousTaxonomy(value) {
  const taxonomy = structuralTaxonomy(value);
  if (!taxonomy) return null;
  const expected = await fingerprintSnapshots(taxonomy.repositories);
  return expected === taxonomy.corpusFingerprint ? taxonomy : null;
}

export function parseTaxonomyOverrideFile(text) {
  if (typeof text !== "string" || text.length > MAX_TAXONOMY_OVERRIDE_BYTES) {
    throw new Error(`taxonomy-overrides.json must be at most ${MAX_TAXONOMY_OVERRIDE_BYTES} bytes`);
  }
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("taxonomy-overrides.json must contain valid JSON");
  }
  return normalizeTaxonomyOverrides(raw);
}

export function normalizeTaxonomyOverrides(value) {
  if (!value || typeof value !== "object") throw new Error("Taxonomy override must be an object");
  if (value.version !== TAXONOMY_OVERRIDE_VERSION) throw new Error(`Taxonomy override version must be ${TAXONOMY_OVERRIDE_VERSION}`);
  if (value.forceRediscovery != null && typeof value.forceRediscovery !== "boolean") throw new Error("forceRediscovery must be boolean");
  const categories = value.categories == null ? undefined : validateTaxonomyCategories(value.categories);
  return {
    version: TAXONOMY_OVERRIDE_VERSION,
    ...(value.forceRediscovery === true ? { forceRediscovery: true } : {}),
    ...(categories ? { categories } : {}),
  };
}

function snapshotKey(item) {
  return item.repoId > 0 ? `id:${item.repoId}` : `name:${item.name.toLowerCase()}`;
}

function driftBetween(previous, current) {
  const left = new Map(previous.map((item) => [snapshotKey(item), item]));
  const right = new Map(current.map((item) => [snapshotKey(item), item]));
  const keys = new Set([...left.keys(), ...right.keys()]);
  let changed = 0;
  for (const key of keys) {
    const before = left.get(key);
    const after = right.get(key);
    if (!before || !after || before.name !== after.name || before.contentHash !== after.contentHash) changed += 1;
  }
  return { changed, ratio: changed / Math.max(1, previous.length, current.length) };
}

function boundedDriftRatio(value) {
  if (!Number.isFinite(value)) return DEFAULT_TAXONOMY_MAX_DRIFT_RATIO;
  return Math.max(0, Math.min(1, Number(value)));
}

function taxonomyFrom(input, repositories, categories, providerId, model) {
  return {
    schemaVersion: TAXONOMY_SCHEMA_VERSION,
    corpusFingerprint: input.corpusFingerprint,
    repositories: repositories.map((item) => ({ ...item })),
    categories: categories.map((category) => ({ ...category, aliases: [...category.aliases] })),
    source: { providerId, model },
  };
}

function diagnosticsBase(documents, providerId, model, previousAvailable, exactCorpusMatch, changedRepositories, driftRatio) {
  return { documents, providerId, model, previousAvailable, exactCorpusMatch, changedRepositories, driftRatio };
}

export async function resolvePortfolioTaxonomy(repos, provider = DISABLED_TAXONOMY_DISCOVERY_PROVIDER, options = {}) {
  const corpus = await buildTaxonomyDiscoveryInput(repos);
  const previous = await verifiedPreviousTaxonomy(options.previousTaxonomy);
  const overrides = options.overrides == null ? undefined : normalizeTaxonomyOverrides(options.overrides);
  const chosen = provider ?? DISABLED_TAXONOMY_DISCOVERY_PROVIDER;
  let identity;
  try {
    identity = normalizedProviderIdentity(chosen);
  } catch (error) {
    identity = { id: "invalid", model: "invalid" };
    return {
      taxonomy: previous ?? undefined,
      diagnostics: {
        ...diagnosticsBase(repos.length, identity.id, identity.model, Boolean(previous), false, 0, previous ? 1 : 0),
        reused: Boolean(previous), discovered: false, overridden: false, stale: Boolean(previous), reason: previous ? "invalid-provider-reused" : "invalid-provider",
      },
      error: String(error instanceof Error ? error.message : error).slice(0, 300),
    };
  }

  const exactCorpusMatch = Boolean(previous && previous.corpusFingerprint === corpus.input.corpusFingerprint);
  const drift = previous ? driftBetween(previous.repositories, corpus.repositories) : { changed: 0, ratio: 0 };
  const base = diagnosticsBase(repos.length, identity.id, identity.model, Boolean(previous), exactCorpusMatch, drift.changed, drift.ratio);

  if (overrides?.categories?.length) {
    return {
      taxonomy: taxonomyFrom(corpus.input, corpus.repositories, overrides.categories, "override", "taxonomy-overrides-v1"),
      diagnostics: { ...base, providerId: "override", model: "taxonomy-overrides-v1", reused: false, discovered: false, overridden: true, stale: false, reason: "override" },
    };
  }

  const forceRediscovery = options.forceRediscovery === true || overrides?.forceRediscovery === true;
  const maxDriftRatio = boundedDriftRatio(options.maxDriftRatio);
  if (previous && !forceRediscovery && exactCorpusMatch) {
    return { taxonomy: previous, diagnostics: { ...base, reused: true, discovered: false, overridden: false, stale: false, reason: "unchanged" } };
  }
  if (previous && !forceRediscovery && drift.ratio <= maxDriftRatio) {
    return { taxonomy: previous, diagnostics: { ...base, reused: true, discovered: false, overridden: false, stale: drift.changed > 0, reason: "small-drift" } };
  }

  if (identity.id === "disabled") {
    return {
      taxonomy: previous ?? undefined,
      diagnostics: { ...base, reused: Boolean(previous), discovered: false, overridden: false, stale: Boolean(previous && !exactCorpusMatch), reason: previous ? "provider-disabled-reused" : "provider-disabled" },
    };
  }

  try {
    const raw = await chosen.discover(corpus.input);
    const rawCategories = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? raw.categories : undefined;
    const categories = validateTaxonomyCategories(rawCategories);
    return {
      taxonomy: taxonomyFrom(corpus.input, corpus.repositories, categories, identity.id, identity.model),
      diagnostics: { ...base, reused: false, discovered: true, overridden: false, stale: false, reason: forceRediscovery ? "forced-discovery" : previous ? "drift-discovery" : "initial-discovery" },
    };
  } catch (error) {
    return {
      taxonomy: previous ?? undefined,
      diagnostics: { ...base, reused: Boolean(previous), discovered: false, overridden: false, stale: Boolean(previous), reason: previous ? "provider-error-reused" : "provider-error" },
      error: String(error instanceof Error ? error.message : error).slice(0, 300),
    };
  }
}
