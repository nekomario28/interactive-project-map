import { canonicalSemanticDocument, semanticDocumentText, SEMANTIC_DOCUMENT_VERSION } from "./semantic-document.ts";
import type {
  EmbeddedSemanticCorpus,
  EmbeddingCache,
  EmbeddingProvider,
  RepoSemanticDocument,
} from "./types";

export const DEFAULT_EMBEDDING_BATCH_SIZE = 32;

export const DISABLED_EMBEDDING_PROVIDER: EmbeddingProvider = Object.freeze({
  id: "disabled",
  model: "disabled",
  async embed(): Promise<number[][]> {
    throw new Error("Disabled embedding provider must not be invoked");
  },
});

export class MemoryEmbeddingCache implements EmbeddingCache {
  private readonly values = new Map<string, number[]>();

  async get(key: string): Promise<number[] | null> {
    const value = this.values.get(key);
    return value ? [...value] : null;
  }

  async set(key: string, vector: number[]): Promise<void> {
    this.values.set(key, [...vector]);
  }

  get size(): number {
    return this.values.size;
  }
}

function providerIdentity(provider: EmbeddingProvider): { id: string; model: string } {
  const id = String(provider?.id ?? "").trim();
  const model = String(provider?.model ?? "").trim();
  if (!id || id.length > 120) throw new Error("Embedding provider id must be 1-120 characters");
  if (!model || model.length > 180) throw new Error("Embedding model id must be 1-180 characters");
  return { id, model };
}

function isFiniteVector(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= 65_536
    && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("WebCrypto SHA-256 is required for embedding cache identity");
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function semanticDocumentContentHash(document: RepoSemanticDocument): Promise<string> {
  return sha256Hex(canonicalSemanticDocument(document));
}

export async function embeddingCacheKey(
  document: RepoSemanticDocument,
  provider: EmbeddingProvider,
): Promise<string> {
  const { id, model } = providerIdentity(provider);
  const hash = await semanticDocumentContentHash(document);
  return [
    "embedding",
    `semantic-v${SEMANTIC_DOCUMENT_VERSION}`,
    encodeURIComponent(id),
    encodeURIComponent(model),
    hash,
  ].join(":");
}

function boundedBatchSize(value: number | undefined): number {
  if (!Number.isFinite(value) || Number(value) <= 0) return DEFAULT_EMBEDDING_BATCH_SIZE;
  return Math.max(1, Math.min(128, Math.floor(Number(value))));
}

async function cacheGet(cache: EmbeddingCache | undefined, key: string): Promise<number[] | null> {
  if (!cache) return null;
  try {
    const vector = await cache.get(key);
    return isFiniteVector(vector) ? [...vector] : null;
  } catch {
    return null;
  }
}

async function cacheSet(cache: EmbeddingCache | undefined, key: string, vector: number[]): Promise<void> {
  if (!cache) return;
  try {
    await cache.set(key, [...vector]);
  } catch {
    // Cache persistence is an optimization; provider output remains authoritative.
  }
}

export async function embedSemanticDocuments(
  documents: RepoSemanticDocument[],
  provider: EmbeddingProvider | null | undefined = DISABLED_EMBEDDING_PROVIDER,
  cache?: EmbeddingCache,
  options: { batchSize?: number } = {},
): Promise<EmbeddedSemanticCorpus> {
  const chosen = provider ?? DISABLED_EMBEDDING_PROVIDER;
  const { id, model } = providerIdentity(chosen);
  if (id === "disabled") {
    return {
      vectors: [],
      cacheKeys: [],
      diagnostics: {
        providerId: id,
        model,
        documents: documents.length,
        cacheHits: 0,
        embedded: 0,
        dimension: 0,
        disabled: true,
      },
    };
  }

  const cacheKeys = await Promise.all(documents.map((document) => embeddingCacheKey(document, chosen)));
  const vectors: Array<number[] | null> = Array.from({ length: documents.length }, () => null);
  const missing: number[] = [];
  let cacheHits = 0;

  for (let index = 0; index < documents.length; index += 1) {
    const cached = await cacheGet(cache, cacheKeys[index]);
    if (cached) {
      vectors[index] = cached;
      cacheHits += 1;
    } else {
      missing.push(index);
    }
  }

  const batchSize = boundedBatchSize(options.batchSize);
  let embedded = 0;
  for (let offset = 0; offset < missing.length; offset += batchSize) {
    const indexes = missing.slice(offset, offset + batchSize);
    const texts = indexes.map((index) => semanticDocumentText(documents[index]));
    const batch = await chosen.embed(texts);
    if (!Array.isArray(batch) || batch.length !== indexes.length) {
      throw new Error(`Embedding provider returned ${Array.isArray(batch) ? batch.length : "invalid"} vectors for ${indexes.length} documents`);
    }
    for (let batchIndex = 0; batchIndex < indexes.length; batchIndex += 1) {
      const vector = batch[batchIndex];
      if (!isFiniteVector(vector)) throw new Error("Embedding provider returned an invalid vector");
      const index = indexes[batchIndex];
      vectors[index] = [...vector];
      embedded += 1;
    }
  }

  const complete = vectors.map((vector) => {
    if (!vector) throw new Error("Embedding corpus is incomplete");
    return vector;
  });
  const dimension = complete[0]?.length ?? 0;
  for (const vector of complete) {
    if (vector.length !== dimension) throw new Error("Embedding provider/cache returned inconsistent vector dimensions");
  }

  for (const index of missing) await cacheSet(cache, cacheKeys[index], complete[index]);

  return {
    vectors: complete.map((vector) => [...vector]),
    cacheKeys,
    diagnostics: {
      providerId: id,
      model,
      documents: documents.length,
      cacheHits,
      embedded,
      dimension,
      disabled: false,
    },
  };
}
