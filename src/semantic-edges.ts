import { DISABLED_EMBEDDING_PROVIDER, embedSemanticDocuments } from "./embedding.ts";
import { buildRepoSemanticDocuments } from "./semantic-document.ts";
import type {
  EmbeddingCache,
  EmbeddingProvider,
  GitHubRepo,
  RepoSemanticDocument,
  SemanticEdge,
  SemanticEdgeDiagnostics,
  SemanticEdgeGenerationResult,
} from "./types";

export const DEFAULT_SEMANTIC_TOP_K = 3;
export const DEFAULT_SEMANTIC_MIN_SIMILARITY = 0.72;
export const MAX_SEMANTIC_TOP_K = 8;
export const MAX_SEMANTIC_EDGES = 1200;

type Candidate = { index: number; score: number };

export interface SemanticEdgeOptions {
  topK?: number;
  minSimilarity?: number;
  maxEdges?: number;
  batchSize?: number;
}

function boundedTopK(value: number | undefined): number {
  if (!Number.isFinite(value) || Number(value) <= 0) return DEFAULT_SEMANTIC_TOP_K;
  return Math.max(1, Math.min(MAX_SEMANTIC_TOP_K, Math.floor(Number(value))));
}

function boundedThreshold(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_SEMANTIC_MIN_SIMILARITY;
  return Math.max(0, Math.min(1, Number(value)));
}

function boundedMaxEdges(value: number | undefined, documents: number, topK: number): number {
  const natural = Math.min(MAX_SEMANTIC_EDGES, Math.max(0, documents * topK));
  if (!Number.isFinite(value) || Number(value) < 0) return natural;
  return Math.max(0, Math.min(MAX_SEMANTIC_EDGES, Math.floor(Number(value)), natural));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) throw new Error("Semantic vectors must have one consistent non-zero dimension");
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Error("Semantic vectors must contain only finite numbers");
    dot += left * right;
    normA += left * left;
    normB += right * right;
  }
  if (normA <= 0 || normB <= 0) return 0;
  return Math.max(-1, Math.min(1, dot / Math.sqrt(normA * normB)));
}

function candidateSort(documents: RepoSemanticDocument[]) {
  return (a: Candidate, b: Candidate): number => b.score - a.score
    || documents[a.index].name.localeCompare(documents[b.index].name);
}

function retainCandidate(
  target: Candidate[],
  candidate: Candidate,
  topK: number,
  documents: RepoSemanticDocument[],
): void {
  target.push(candidate);
  target.sort(candidateSort(documents));
  if (target.length > topK) target.length = topK;
}

function edgeKey(source: string, target: string): string {
  return source < target ? `${source}\u0000${target}` : `${target}\u0000${source}`;
}

function roundedScore(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function buildSparseSemanticEdges(
  documents: RepoSemanticDocument[],
  vectors: number[][],
  options: SemanticEdgeOptions = {},
): { edges: SemanticEdge[]; diagnostics: SemanticEdgeDiagnostics } {
  if (documents.length !== vectors.length) throw new Error("Semantic document/vector count mismatch");
  const topK = boundedTopK(options.topK);
  const minSimilarity = boundedThreshold(options.minSimilarity);
  const maxEdges = boundedMaxEdges(options.maxEdges, documents.length, topK);
  const neighbors: Candidate[][] = Array.from({ length: documents.length }, () => []);
  let comparisons = 0;

  for (let first = 0; first < documents.length; first += 1) {
    for (let second = first + 1; second < documents.length; second += 1) {
      comparisons += 1;
      const score = cosineSimilarity(vectors[first], vectors[second]);
      if (score < minSimilarity) continue;
      retainCandidate(neighbors[first], { index: second, score }, topK, documents);
      retainCandidate(neighbors[second], { index: first, score }, topK, documents);
    }
  }

  const retainedCandidates = neighbors.reduce((total, list) => total + list.length, 0);
  const deduped = new Map<string, SemanticEdge>();
  for (let sourceIndex = 0; sourceIndex < neighbors.length; sourceIndex += 1) {
    const source = `repository:${documents[sourceIndex].name}`;
    for (const candidate of neighbors[sourceIndex]) {
      const target = `repository:${documents[candidate.index].name}`;
      if (source === target) continue;
      const key = edgeKey(source, target);
      const normalizedSource = source < target ? source : target;
      const normalizedTarget = source < target ? target : source;
      const existing = deduped.get(key);
      if (!existing || candidate.score > existing.score) {
        deduped.set(key, {
          source: normalizedSource,
          target: normalizedTarget,
          type: "semantic",
          score: roundedScore(candidate.score),
        });
      }
    }
  }

  const edges = [...deduped.values()]
    .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source) || a.target.localeCompare(b.target))
    .slice(0, maxEdges);

  return {
    edges,
    diagnostics: {
      documents: documents.length,
      comparisons,
      retainedCandidates,
      emittedEdges: edges.length,
      topK,
      minSimilarity,
      maxEdges,
    },
  };
}

function providerLabel(provider: EmbeddingProvider | null | undefined): { id: string; model: string; disabled: boolean } {
  const chosen = provider ?? DISABLED_EMBEDDING_PROVIDER;
  const id = String(chosen.id || "disabled").slice(0, 120) || "disabled";
  const model = String(chosen.model || "disabled").slice(0, 180) || "disabled";
  return { id, model, disabled: id === "disabled" };
}

export async function generateSemanticEdges(
  repos: GitHubRepo[],
  provider: EmbeddingProvider | null | undefined = DISABLED_EMBEDDING_PROVIDER,
  cache?: EmbeddingCache,
  options: SemanticEdgeOptions = {},
): Promise<SemanticEdgeGenerationResult> {
  const documents = buildRepoSemanticDocuments(repos);
  const topK = boundedTopK(options.topK);
  const minSimilarity = boundedThreshold(options.minSimilarity);
  const maxEdges = boundedMaxEdges(options.maxEdges, documents.length, topK);
  const label = providerLabel(provider);

  try {
    const embedded = await embedSemanticDocuments(documents, provider, cache, { batchSize: options.batchSize });
    if (embedded.diagnostics.disabled || documents.length < 2) {
      return {
        edges: [],
        embedding: embedded.diagnostics,
        diagnostics: {
          documents: documents.length,
          comparisons: 0,
          retainedCandidates: 0,
          emittedEdges: 0,
          topK,
          minSimilarity,
          maxEdges,
        },
      };
    }
    const sparse = buildSparseSemanticEdges(documents, embedded.vectors, options);
    return { edges: sparse.edges, embedding: embedded.diagnostics, diagnostics: sparse.diagnostics };
  } catch (error) {
    return {
      edges: [],
      embedding: {
        providerId: label.id,
        model: label.model,
        documents: documents.length,
        cacheHits: 0,
        embedded: 0,
        dimension: 0,
        disabled: label.disabled,
      },
      diagnostics: {
        documents: documents.length,
        comparisons: 0,
        retainedCandidates: 0,
        emittedEdges: 0,
        topK,
        minSimilarity,
        maxEdges,
      },
      error: String(error instanceof Error ? error.message : error).slice(0, 300),
    };
  }
}
