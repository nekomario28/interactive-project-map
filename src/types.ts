export interface RateLimitBinding { limit(options: { key: string }): Promise<{ success: boolean }>; }
export interface Env { GITHUB_TOKEN?: string; API_RATE_LIMITER?: RateLimitBinding; UPSTREAM_RATE_LIMITER?: RateLimitBinding; GLOBAL_UPSTREAM_RATE_LIMITER?: RateLimitBinding; }

export type ClassificationEvidenceSource = "name" | "description" | "topic" | "readme" | "manifest" | "dependency" | "fork-source" | "embedding" | "llm" | "override";
export interface ClassificationEvidence { categoryId: string; source: ClassificationEvidenceSource; value: string; weight: number; path?: string; }
export interface RepositoryClassification { categoryId: string; categoryLabel: string; secondaryTags: string[]; confidence: number; method: "deterministic" | "semantic" | "llm" | "override"; evidence: ClassificationEvidence[]; }
export interface RepositoryTaxonomyAssignment { categoryId: string; categoryLabel: string; secondaryTags: string[]; confidence: number; method: "override" | "deterministic" | "semantic" | "llm"; evidence: ClassificationEvidence[]; score?: number; margin?: number; }

export interface GitHubRepo {
  id: number; name: string; html_url: string; description: string | null; language: string | null; topics?: string[];
  stargazers_count: number; forks_count: number; fork: boolean; archived: boolean; updated_at: string; homepage?: string | null;
  readmeExcerpt?: string; manifests?: string[]; frameworks?: string[]; classification?: RepositoryClassification;
}

export interface RepoSemanticDocument {
  repoId: number; name: string; description: string; topics: string[]; readmeExcerpt: string; language: string | null;
  frameworks: string[]; manifests: string[];
  fork: { isFork: boolean; sourceName?: string; sourceDescription?: string; sourceTopics?: string[]; };
}

export interface EmbeddingProvider { id: string; model: string; embed(texts: string[]): Promise<number[][]>; }
export interface EmbeddingCache { get(key: string): Promise<number[] | null>; set(key: string, vector: number[]): Promise<void>; }
export interface EmbeddingDiagnostics { providerId: string; model: string; documents: number; cacheHits: number; embedded: number; dimension: number; disabled: boolean; }
export interface EmbeddedSemanticCorpus { vectors: number[][]; cacheKeys: string[]; diagnostics: EmbeddingDiagnostics; }

export interface SemanticEdge { source: string; target: string; type: "semantic"; score: number; }
export interface SemanticEdgeDiagnostics { documents: number; comparisons: number; retainedCandidates: number; emittedEdges: number; topK: number; minSimilarity: number; maxEdges: number; }
export interface SemanticEdgeGenerationResult { edges: SemanticEdge[]; embedding: EmbeddingDiagnostics; diagnostics: SemanticEdgeDiagnostics; error?: string; }

export interface TaxonomyCategory { id: string; label: string; description: string; aliases: string[]; parentId?: string; }
export interface TaxonomyRepositoryFingerprint { repoId: number; name: string; contentHash: string; }
export interface PortfolioTaxonomy {
  schemaVersion: number; corpusFingerprint: string; repositories: TaxonomyRepositoryFingerprint[]; categories: TaxonomyCategory[];
  source: { providerId: string; model: string; };
}

export interface TaxonomyDiscoveryRepository {
  repoId: number; name: string; description: string; topics: string[]; readmeExcerpt: string; language: string | null; frameworks: string[]; manifests: string[];
  classification?: { categoryId: string; categoryLabel: string; confidence: number; secondaryTags: string[]; };
}
export interface TaxonomyDiscoveryInput { schemaVersion: number; corpusFingerprint: string; targetCategoryCount: number; repositories: TaxonomyDiscoveryRepository[]; }
export interface TaxonomyDiscoveryProvider { id: string; model: string; discover(input: TaxonomyDiscoveryInput): Promise<unknown>; }

export interface TaxonomyRepositoryOverride { categoryId: string; secondaryTags?: string[]; }
export interface TaxonomyOverrideFile {
  version: number; forceRediscovery?: boolean; categories?: TaxonomyCategory[]; repositories?: Record<string, TaxonomyRepositoryOverride>;
}

export type TaxonomyResolutionReason = "override" | "unchanged" | "small-drift" | "provider-disabled" | "provider-disabled-reused" | "initial-discovery" | "drift-discovery" | "forced-discovery" | "provider-error" | "provider-error-reused" | "invalid-provider" | "invalid-provider-reused";
export interface TaxonomyDiagnostics {
  documents: number; providerId: string; model: string; previousAvailable: boolean; exactCorpusMatch: boolean; changedRepositories: number; driftRatio: number;
  reused: boolean; discovered: boolean; overridden: boolean; stale: boolean; reason: TaxonomyResolutionReason;
}
export interface TaxonomyResolutionResult { taxonomy?: PortfolioTaxonomy; diagnostics: TaxonomyDiagnostics; error?: string; }

export interface TaxonomyAssignmentDiagnostics {
  documents: number; categories: number; assigned: number; ambiguous: number; overridden: number; deterministic: number; semantic: number;
  providerId: string; model: string; disabled: boolean; repositoryCacheHits: number; repositoryEmbedded: number; categoryCacheHits: number; categoryEmbedded: number;
}
export interface TaxonomyAssignmentResult { assignments: Record<string, RepositoryTaxonomyAssignment>; ambiguous: string[]; diagnostics: TaxonomyAssignmentDiagnostics; error?: string; }

export interface TaxonomyAdjudicationRepository {
  name: string; description: string; topics: string[]; readmeExcerpt: string; language: string | null; frameworks: string[]; manifests: string[];
  classification?: { categoryId: string; categoryLabel: string; confidence: number; secondaryTags: string[]; };
}
export interface TaxonomyAdjudicationCategory { id: string; label: string; description: string; aliases: string[]; parentId?: string; }
export interface TaxonomyAdjudicationCase { repoName: string; repository: TaxonomyAdjudicationRepository; categories: TaxonomyAdjudicationCategory[]; }
export interface TaxonomyAdjudicationProvider { id: string; model: string; adjudicate(cases: TaxonomyAdjudicationCase[]): Promise<unknown>; }
export interface TaxonomyAdjudicationDiagnostics {
  eligible: number; attempted: number; accepted: number; declined: number; invalid: number; remaining: number; capped: boolean; calls: number;
  providerId: string; model: string; disabled: boolean;
}
export interface TaxonomyAdjudicationResult { assignments: Record<string, RepositoryTaxonomyAssignment>; ambiguous: string[]; diagnostics: TaxonomyAdjudicationDiagnostics; error?: string; }

export type GalaxyNodeType = "owner" | "group" | "repository";
export interface GalaxyNode {
  id: string; label: string; type: GalaxyNodeType; url?: string; description?: string; language?: string | null; topics?: string[]; stars?: number; forks?: number;
  fork?: boolean; archived?: boolean; updatedAt?: string; groupId?: string; groupLabel?: string; repositoryCount?: number; classification?: RepositoryClassification;
  taxonomyAssignment?: RepositoryTaxonomyAssignment;
}
export interface GalaxyEdge { source: string; target: string; type: "ownership" | "membership"; }
export interface GalaxyGraph {
  owner: string; generatedAt: string; repositoryCount: number; groupCount: number; nodes: GalaxyNode[]; edges: GalaxyEdge[];
  classificationVersion?: number; semanticEdges?: SemanticEdge[]; taxonomy?: PortfolioTaxonomy; taxonomyAssignmentVersion?: number;
}
