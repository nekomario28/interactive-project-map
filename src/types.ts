export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  GITHUB_TOKEN?: string;
  API_RATE_LIMITER?: RateLimitBinding;
  UPSTREAM_RATE_LIMITER?: RateLimitBinding;
  GLOBAL_UPSTREAM_RATE_LIMITER?: RateLimitBinding;
}

export type ClassificationEvidenceSource =
  | "name"
  | "description"
  | "topic"
  | "readme"
  | "manifest"
  | "dependency"
  | "fork-source"
  | "embedding"
  | "llm"
  | "override";

export interface ClassificationEvidence {
  categoryId: string;
  source: ClassificationEvidenceSource;
  value: string;
  weight: number;
  path?: string;
}

export interface RepositoryClassification {
  categoryId: string;
  categoryLabel: string;
  secondaryTags: string[];
  confidence: number;
  method: "deterministic" | "semantic" | "llm" | "override";
  evidence: ClassificationEvidence[];
}

export interface GitHubRepo {
  id: number;
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  archived: boolean;
  updated_at: string;
  homepage?: string | null;
  /** Generation-time semantic evidence. README text is intentionally not emitted as a graph node field. */
  readmeExcerpt?: string;
  /** Bounded, root-level manifest identities discovered during graph generation. */
  manifests?: string[];
  /** Recognized framework/dependency identifiers extracted from bounded manifests. */
  frameworks?: string[];
  /** Used when safely rehydrating a generated static graph; normal GitHub REST results omit this. */
  classification?: RepositoryClassification;
}

export interface RepoSemanticDocument {
  repoId: number;
  name: string;
  description: string;
  topics: string[];
  readmeExcerpt: string;
  language: string | null;
  frameworks: string[];
  manifests: string[];
  fork: {
    isFork: boolean;
    sourceName?: string;
    sourceDescription?: string;
    sourceTopics?: string[];
  };
}

export interface EmbeddingProvider {
  id: string;
  model: string;
  embed(texts: string[]): Promise<number[][]>;
}

export interface EmbeddingCache {
  get(key: string): Promise<number[] | null>;
  set(key: string, vector: number[]): Promise<void>;
}

export interface EmbeddingDiagnostics {
  providerId: string;
  model: string;
  documents: number;
  cacheHits: number;
  embedded: number;
  dimension: number;
  disabled: boolean;
}

export interface EmbeddedSemanticCorpus {
  vectors: number[][];
  cacheKeys: string[];
  diagnostics: EmbeddingDiagnostics;
}

export interface SemanticEdge {
  source: string;
  target: string;
  type: "semantic";
  score: number;
}

export interface SemanticEdgeDiagnostics {
  documents: number;
  comparisons: number;
  retainedCandidates: number;
  emittedEdges: number;
  topK: number;
  minSimilarity: number;
  maxEdges: number;
}

export interface SemanticEdgeGenerationResult {
  edges: SemanticEdge[];
  embedding: EmbeddingDiagnostics;
  diagnostics: SemanticEdgeDiagnostics;
  error?: string;
}

export type GalaxyNodeType = "owner" | "group" | "repository";

export interface GalaxyNode {
  id: string;
  label: string;
  type: GalaxyNodeType;
  url?: string;
  description?: string;
  language?: string | null;
  topics?: string[];
  stars?: number;
  forks?: number;
  fork?: boolean;
  archived?: boolean;
  updatedAt?: string;
  groupId?: string;
  groupLabel?: string;
  repositoryCount?: number;
  classification?: RepositoryClassification;
}

export interface GalaxyEdge {
  source: string;
  target: string;
  type: "ownership" | "membership";
}

export interface GalaxyGraph {
  owner: string;
  generatedAt: string;
  repositoryCount: number;
  groupCount: number;
  nodes: GalaxyNode[];
  edges: GalaxyEdge[];
  classificationVersion?: number;
  semanticEdges?: SemanticEdge[];
}
