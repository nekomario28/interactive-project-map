import { embedSemanticDocuments, DISABLED_EMBEDDING_PROVIDER } from "./embedding.ts";
import { buildRepoSemanticDocuments } from "./semantic-document.ts";
import type {
  ClassificationEvidence,
  EmbeddingCache,
  EmbeddingProvider,
  GitHubRepo,
  PortfolioTaxonomy,
  RepositoryTaxonomyAssignment,
  TaxonomyAssignmentResult,
  TaxonomyCategory,
  TaxonomyOverrideFile,
} from "./types";

export const TAXONOMY_ASSIGNMENT_VERSION = 1;
export const DEFAULT_TAXONOMY_ASSIGNMENT_MIN_SCORE = 0.62;
export const DEFAULT_TAXONOMY_ASSIGNMENT_MIN_MARGIN = 0.08;
export const DEFAULT_TAXONOMY_DETERMINISTIC_CONFIDENCE = 0.9;
export const TAXONOMY_CATEGORY_EMBEDDING_VERSION = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function bounded(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return clamp(Number(value), min, max);
}

function boundedBatchSize(value: number | undefined): number {
  if (!Number.isFinite(value) || Number(value) <= 0) return 32;
  return Math.max(1, Math.min(128, Math.floor(Number(value))));
}

function providerIdentity(provider: EmbeddingProvider): { id: string; model: string } {
  const id = String(provider?.id ?? "").trim();
  const model = String(provider?.model ?? "").trim();
  if (!id || id.length > 120) throw new Error("Embedding provider id must be 1-120 characters");
  if (!model || model.length > 180) throw new Error("Embedding model id must be 1-180 characters");
  return { id, model };
}

function finiteVector(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= 65_536
    && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("WebCrypto SHA-256 is required for taxonomy assignment cache identity");
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function canonicalTaxonomyCategory(category: TaxonomyCategory): string {
  return JSON.stringify({
    id: category.id,
    label: category.label,
    description: category.description,
    aliases: [...category.aliases].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })),
    parentId: category.parentId ?? "",
  });
}

export function taxonomyCategoryText(category: TaxonomyCategory): string {
  const lines = [
    `category: ${category.id}`,
    `label: ${category.label}`,
    `description: ${category.description}`,
  ];
  if (category.aliases.length) lines.push(`aliases: ${category.aliases.join(", ")}`);
  if (category.parentId) lines.push(`parent: ${category.parentId}`);
  return lines.join("\n");
}

export async function taxonomyCategoryEmbeddingCacheKey(
  category: TaxonomyCategory,
  provider: EmbeddingProvider,
): Promise<string> {
  const { id, model } = providerIdentity(provider);
  const hash = await sha256Hex(canonicalTaxonomyCategory(category));
  return [
    "embedding",
    `taxonomy-category-v${TAXONOMY_CATEGORY_EMBEDDING_VERSION}`,
    encodeURIComponent(id),
    encodeURIComponent(model),
    hash,
  ].join(":");
}

async function cacheGet(cache: EmbeddingCache | undefined, key: string): Promise<number[] | null> {
  if (!cache) return null;
  try {
    const value = await cache.get(key);
    return finiteVector(value) ? [...value] : null;
  } catch {
    return null;
  }
}

async function cacheSet(cache: EmbeddingCache | undefined, key: string, vector: number[]): Promise<void> {
  if (!cache) return;
  try {
    await cache.set(key, [...vector]);
  } catch {
    // Cache persistence is an optimization only.
  }
}

async function embedTaxonomyCategories(
  categories: TaxonomyCategory[],
  provider: EmbeddingProvider,
  cache?: EmbeddingCache,
  batchSize?: number,
): Promise<{ vectors: number[][]; cacheHits: number; embedded: number; dimension: number }> {
  const keys = await Promise.all(categories.map((category) => taxonomyCategoryEmbeddingCacheKey(category, provider)));
  const vectors: Array<number[] | null> = Array.from({ length: categories.length }, () => null);
  const missing: number[] = [];
  let cacheHits = 0;
  for (let index = 0; index < categories.length; index += 1) {
    const cached = await cacheGet(cache, keys[index]);
    if (cached) {
      vectors[index] = cached;
      cacheHits += 1;
    } else {
      missing.push(index);
    }
  }

  let embedded = 0;
  const size = boundedBatchSize(batchSize);
  for (let offset = 0; offset < missing.length; offset += size) {
    const indexes = missing.slice(offset, offset + size);
    const batch = await provider.embed(indexes.map((index) => taxonomyCategoryText(categories[index])));
    if (!Array.isArray(batch) || batch.length !== indexes.length) {
      throw new Error(`Embedding provider returned ${Array.isArray(batch) ? batch.length : "invalid"} vectors for ${indexes.length} taxonomy categories`);
    }
    for (let batchIndex = 0; batchIndex < indexes.length; batchIndex += 1) {
      const vector = batch[batchIndex];
      if (!finiteVector(vector)) throw new Error("Embedding provider returned an invalid taxonomy category vector");
      vectors[indexes[batchIndex]] = [...vector];
      embedded += 1;
    }
  }

  const complete = vectors.map((vector) => {
    if (!vector) throw new Error("Taxonomy category embedding corpus is incomplete");
    return vector;
  });
  const dimension = complete[0]?.length ?? 0;
  for (const vector of complete) {
    if (vector.length !== dimension) throw new Error("Embedding provider/cache returned inconsistent taxonomy category vector dimensions");
  }
  for (const index of missing) await cacheSet(cache, keys[index], complete[index]);
  return { vectors: complete.map((vector) => [...vector]), cacheHits, embedded, dimension };
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) throw new Error("Cannot compare embedding vectors with different dimensions");
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    aa += a[index] * a[index];
    bb += b[index] * b[index];
  }
  if (aa <= 0 || bb <= 0) return -1;
  return dot / Math.sqrt(aa * bb);
}

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function repositoryKey(name: string): string {
  return String(name || "").toLowerCase();
}

function categoryMap(taxonomy: PortfolioTaxonomy): Map<string, TaxonomyCategory> {
  return new Map(taxonomy.categories.map((category) => [category.id, category]));
}

function overrideAssignment(
  repo: GitHubRepo,
  category: TaxonomyCategory,
  secondaryTags: string[],
): RepositoryTaxonomyAssignment {
  return {
    categoryId: category.id,
    categoryLabel: category.label,
    secondaryTags: secondaryTags.slice(0, 8),
    confidence: 1,
    method: "override",
    evidence: [{ categoryId: category.id, source: "override", value: `taxonomy-overrides:${repo.name}`, weight: 1 }],
  };
}

function deterministicAssignment(repo: GitHubRepo, category: TaxonomyCategory): RepositoryTaxonomyAssignment {
  const classification = repo.classification!;
  const evidence = classification.evidence
    .filter((item) => item.categoryId === category.id)
    .slice(0, 12)
    .map((item) => ({ ...item }));
  if (!evidence.length) {
    evidence.push({
      categoryId: category.id,
      source: "description",
      value: `P1 exact taxonomy category ${category.id}`,
      weight: classification.confidence,
    });
  }
  return {
    categoryId: category.id,
    categoryLabel: category.label,
    secondaryTags: [...classification.secondaryTags].slice(0, 8),
    confidence: rounded(classification.confidence),
    method: "deterministic",
    evidence,
  };
}

function semanticAssignment(
  repo: GitHubRepo,
  category: TaxonomyCategory,
  score: number,
  margin: number,
): RepositoryTaxonomyAssignment {
  const evidence: ClassificationEvidence[] = [{
    categoryId: category.id,
    source: "embedding",
    value: `cosine=${rounded(score)};margin=${rounded(margin)}`,
    weight: rounded(score),
  }];
  return {
    categoryId: category.id,
    categoryLabel: category.label,
    secondaryTags: [...(repo.classification?.secondaryTags ?? [])].slice(0, 8),
    confidence: rounded(clamp(score, 0, 1)),
    method: "semantic",
    score: rounded(score),
    margin: rounded(margin),
    evidence,
  };
}

export async function assignRepositoriesToTaxonomy(
  repos: GitHubRepo[],
  taxonomy: PortfolioTaxonomy | null | undefined,
  provider: EmbeddingProvider | null | undefined = DISABLED_EMBEDDING_PROVIDER,
  cache?: EmbeddingCache,
  options: {
    overrides?: TaxonomyOverrideFile;
    deterministicConfidence?: number;
    minScore?: number;
    minMargin?: number;
    batchSize?: number;
  } = {},
): Promise<TaxonomyAssignmentResult> {
  const assignments: Record<string, RepositoryTaxonomyAssignment> = {};
  const ambiguous: string[] = [];
  const chosen = provider ?? DISABLED_EMBEDDING_PROVIDER;
  let identity: { id: string; model: string };
  try {
    identity = providerIdentity(chosen);
  } catch (error) {
    return {
      assignments,
      ambiguous: repos.map((repo) => repo.name).sort(),
      diagnostics: {
        documents: repos.length, categories: taxonomy?.categories.length ?? 0, assigned: 0, ambiguous: repos.length,
        overridden: 0, deterministic: 0, semantic: 0, providerId: "invalid", model: "invalid", disabled: false,
        repositoryCacheHits: 0, repositoryEmbedded: 0, categoryCacheHits: 0, categoryEmbedded: 0,
      },
      error: String(error instanceof Error ? error.message : error).slice(0, 300),
    };
  }

  if (!taxonomy || !taxonomy.categories.length) {
    return {
      assignments,
      ambiguous: repos.map((repo) => repo.name).sort(),
      diagnostics: {
        documents: repos.length, categories: 0, assigned: 0, ambiguous: repos.length,
        overridden: 0, deterministic: 0, semantic: 0, providerId: identity.id, model: identity.model, disabled: identity.id === "disabled",
        repositoryCacheHits: 0, repositoryEmbedded: 0, categoryCacheHits: 0, categoryEmbedded: 0,
      },
    };
  }

  const categories = [...taxonomy.categories].sort((a, b) => a.id.localeCompare(b.id));
  const byCategory = categoryMap(taxonomy);
  const repositoryOverrides = options.overrides?.repositories ?? {};
  const deterministicConfidence = bounded(options.deterministicConfidence, DEFAULT_TAXONOMY_DETERMINISTIC_CONFIDENCE, 0, 1);
  const unresolved: GitHubRepo[] = [];
  let overridden = 0;
  let deterministic = 0;

  for (const repo of repos) {
    const override = repositoryOverrides[repositoryKey(repo.name)];
    if (override) {
      const category = byCategory.get(override.categoryId);
      if (!category) throw new Error(`Taxonomy repository override for ${repo.name} references unknown category ${override.categoryId}`);
      assignments[repo.name] = overrideAssignment(repo, category, override.secondaryTags ?? []);
      overridden += 1;
      continue;
    }
    const classification = repo.classification;
    const category = classification ? byCategory.get(classification.categoryId) : undefined;
    if (classification && category && classification.confidence >= deterministicConfidence) {
      assignments[repo.name] = deterministicAssignment(repo, category);
      deterministic += 1;
      continue;
    }
    unresolved.push(repo);
  }

  if (!unresolved.length || identity.id === "disabled") {
    ambiguous.push(...unresolved.map((repo) => repo.name).sort());
    return {
      assignments,
      ambiguous,
      diagnostics: {
        documents: repos.length, categories: categories.length, assigned: overridden + deterministic, ambiguous: ambiguous.length,
        overridden, deterministic, semantic: 0, providerId: identity.id, model: identity.model, disabled: identity.id === "disabled",
        repositoryCacheHits: 0, repositoryEmbedded: 0, categoryCacheHits: 0, categoryEmbedded: 0,
      },
    };
  }

  try {
    const repoCorpus = await embedSemanticDocuments(buildRepoSemanticDocuments(unresolved), chosen, cache, { batchSize: options.batchSize });
    const categoryCorpus = await embedTaxonomyCategories(categories, chosen, cache, options.batchSize);
    if (repoCorpus.diagnostics.dimension !== categoryCorpus.dimension) {
      throw new Error("Repository and taxonomy category embedding dimensions differ");
    }
    const minScore = bounded(options.minScore, DEFAULT_TAXONOMY_ASSIGNMENT_MIN_SCORE, -1, 1);
    const minMargin = bounded(options.minMargin, DEFAULT_TAXONOMY_ASSIGNMENT_MIN_MARGIN, 0, 2);
    let semantic = 0;

    unresolved.forEach((repo, repoIndex) => {
      const candidates = categories.map((category, categoryIndex) => ({
        category,
        score: cosine(repoCorpus.vectors[repoIndex], categoryCorpus.vectors[categoryIndex]),
      })).sort((a, b) => b.score - a.score || a.category.id.localeCompare(b.category.id));
      const top = candidates[0];
      const second = candidates[1];
      const margin = second ? top.score - second.score : 1;
      if (top && top.score >= minScore && margin >= minMargin) {
        assignments[repo.name] = semanticAssignment(repo, top.category, top.score, margin);
        semantic += 1;
      } else {
        ambiguous.push(repo.name);
      }
    });
    ambiguous.sort();
    return {
      assignments,
      ambiguous,
      diagnostics: {
        documents: repos.length, categories: categories.length, assigned: overridden + deterministic + semantic, ambiguous: ambiguous.length,
        overridden, deterministic, semantic, providerId: identity.id, model: identity.model, disabled: false,
        repositoryCacheHits: repoCorpus.diagnostics.cacheHits, repositoryEmbedded: repoCorpus.diagnostics.embedded,
        categoryCacheHits: categoryCorpus.cacheHits, categoryEmbedded: categoryCorpus.embedded,
      },
    };
  } catch (error) {
    ambiguous.push(...unresolved.map((repo) => repo.name).sort());
    return {
      assignments,
      ambiguous,
      diagnostics: {
        documents: repos.length, categories: categories.length, assigned: overridden + deterministic, ambiguous: ambiguous.length,
        overridden, deterministic, semantic: 0, providerId: identity.id, model: identity.model, disabled: false,
        repositoryCacheHits: 0, repositoryEmbedded: 0, categoryCacheHits: 0, categoryEmbedded: 0,
      },
      error: String(error instanceof Error ? error.message : error).slice(0, 300),
    };
  }
}
