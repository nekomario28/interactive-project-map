# Semantic Classification Plan

Tracking issue: #20

Status: **P2 complete (P2A/P2B merged); P3 not started**

This document is the canonical handoff for semantic repository classification in `interactive-project-map`. It describes the architecture that is already merged through P2, the invariants that must not regress, and the next implementation boundary for P3.

## 1. Implementation checkpoint

### P1 — deterministic enrichment and evidence ✅

- P1A merged in PR #31 (`bb0d7b5cb5f57f5112436dfd16987c993fd022d0`)
  - Unicode-safe normalization;
  - bounded README enrichment;
  - concrete semantic regression fixtures.
- P1B merged in PR #33 (`de609e89c18e1b4ed25bebb146c3ff2be1050fb7`)
  - structured deterministic classification evidence;
  - confidence and secondary evidence;
  - bounded adaptive manifest/framework enrichment;
  - semantic `Uncategorized` fallback instead of programming-language fallback;
  - language retained as an independent technical facet.

### P2 — semantic representation and sparse relationships ✅

- P2A merged in PR #35 (`961c28429770f9366f86e0387d4829682bd3e47e`)
  - stable bounded `RepoSemanticDocument`;
  - vendor-neutral `EmbeddingProvider` abstraction;
  - explicit disabled provider path;
  - SHA-256 cache identity including semantic-document schema version, provider id, model id, and normalized content;
  - batching, cache reuse, and strict vector validation.
- P2B merged in PR #36 (`3c3e9099d00e6904aa19485c389ced194935e84e`)
  - bounded top-k cosine-similarity semantic edges;
  - provider-failure fallback to deterministic-only graph generation;
  - optional `semanticEdges` stored separately from structural graph edges;
  - Galaxy/Obsidian exploratory integration;
  - static graph sanitization and old/new graph compatibility;
  - 300-repository sparse-output stress gate.

Generated consumer workflows are pinned to the reviewed immutable P2 implementation commit:

```text
3c3e9099d00e6904aa19485c389ced194935e84e
```

P3+ is intentionally not implemented yet. There is currently:

- no portfolio-specific taxonomy discovery;
- no frozen taxonomy/schema persistence;
- no category-description embedding assignment;
- no LLM adjudication;
- no selected production embedding vendor.

The default embedding path remains explicitly **disabled**.

## 2. Core invariant

Preserve this invariant throughout all future phases:

> **repository = semantic node; category/language/status = facets; semantic similarity = optional sparse edges; AI runs at generation time, never as a normal viewer dependency.**

Do not turn this project into a generic knowledge-graph extractor.

Explicit non-goals remain:

- subject-predicate-object extraction for arbitrary README concepts;
- first-class concept nodes such as `ROS2`, `Gazebo`, `Python`, or `Minecraft`;
- unbounded all-to-all graph output;
- unconditional per-repository LLM calls;
- browser-side embedding or LLM requests;
- replacing GitHub language metadata;
- importing a heavyweight GraphRAG stack wholesale.

## 3. Current semantic pipeline

```text
GitHub repository metadata
  + bounded README excerpt
  + bounded root-manifest/framework evidence
            │
            ▼
 deterministic classification
  + evidence / confidence
            │
            ├───────────────┐
            │               │
            ▼               ▼
 RepoSemanticDocument   technical facets
            │           (language/status/etc.)
            ▼
 optional EmbeddingProvider
            │
            ▼
 content-hash/provider/model cache
            │
            ▼
 bounded cosine similarity
            │
            ▼
 sparse semanticEdges
            │
            ▼
 graph.json
   │             │               │
   ▼             ▼               ▼
Tree/etc.    Galaxy/Obsidian   Matrix/Sankey
structure    semantic layer    facets/status
```

The generated `graph.json` remains the source consumed by normal viewers. Semantic providers are generation-time components only.

## 4. P1 current behavior

### 4.1 Unicode-safe normalization

Normalization uses Unicode-aware NFKC handling rather than ASCII-only stripping.

Requirements that are now regression-tested:

- Japanese/non-Latin text remains usable;
- technology tokens such as `C++`, `C#`, `ROS2`, and `NeoForge` remain meaningful;
- ASCII alias matching avoids substring errors such as `react` matching `reactor`;
- Japanese-adjacent strings such as `ROS2でロボット制御` remain classifiable.

### 4.2 Evidence sources and weights

Current deterministic evidence preserves individual records rather than only an opaque final score.

Baseline weights:

- exact GitHub topic: `1.0`;
- known manifest/dependency/framework evidence: `0.9`;
- README alias: `0.7`;
- description alias: `0.7`;
- repository-name alias: `0.5`;
- primary language: `0` for semantic domain.

Language remains available on repository nodes for technical views such as Matrix/details.

### 4.3 README enrichment

README enrichment is bounded and generation-only.

Current properties include:

- canonical GitHub README endpoint;
- bounded raw bytes and cleaned characters;
- generated badge/URL/code noise removal;
- Unicode preservation;
- bounded concurrency;
- missing README is non-fatal;
- rate limiting stops new enrichment work rather than failing graph generation.

README text itself is not emitted as a public repository-node field.

### 4.4 Manifest/framework enrichment

Manifest enrichment does not recursively scan repositories.

It probes a fixed allowlist of high-value root files, including representative files such as:

- `package.json`;
- `pyproject.toml`;
- `requirements.txt`;
- `Cargo.toml`;
- `go.mod`;
- `pom.xml`;
- Gradle metadata;
- NeoForge/Forge/Fabric metadata;
- ROS `package.xml`;
- selected compose files as supporting evidence.

Current hard bounds include:

- at most 3 manifest files read per probed repository;
- 16 KiB raw cap per manifest;
- repository concurrency 4;
- adaptive probing: repositories already confidently classified can skip the manifest network phase;
- 403/429 stops new manifest work;
- failures degrade gracefully.

Only recognized framework/dependency identifiers and manifest identities are retained as semantic evidence.

## 5. Current graph data model

The existing compatibility tree remains intact:

```text
Owner → Category → Repository
```

Compatibility fields such as `groupId` / `groupLabel` are still populated.

Repository nodes may also contain structured classification data:

```ts
interface RepositoryClassification {
  categoryId: string;
  categoryLabel: string;
  secondaryTags: string[];
  confidence: number;
  method: "deterministic" | "semantic" | "llm" | "override";
  evidence: ClassificationEvidence[];
}
```

The graph may contain:

```ts
interface SemanticEdge {
  source: string;
  target: string;
  type: "semantic";
  score: number;
}
```

Semantic edges are stored in:

```ts
GalaxyGraph.semanticEdges?: SemanticEdge[]
```

They are intentionally **not** mixed into the canonical ownership/membership `edges` array.

This separation is important for backward compatibility and for keeping hierarchy/facet views independent from exploratory semantic relationships.

## 6. RepoSemanticDocument — merged P2A contract

One repository maps to one bounded semantic document.

Current interface:

```ts
interface RepoSemanticDocument {
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
```

Current semantic-document schema version:

```text
1
```

Normalization deliberately removes cosmetic instability:

- Unicode NFKC;
- whitespace normalization;
- deterministic list deduplication/sorting;
- bounded string/list lengths.

Meaningful content changes must change document identity. Cosmetic whitespace or list-order changes should not.

## 7. Embedding provider and cache — merged P2A contract

Core code does not depend on one vendor.

```ts
interface EmbeddingProvider {
  id: string;
  model: string;
  embed(texts: string[]): Promise<number[][]>;
}
```

There is an explicit disabled provider path. When disabled:

- no provider request occurs;
- no cache work is required;
- graph generation continues normally;
- no semantic edges are emitted.

### 7.1 Cache identity

Embedding cache identity contains all of:

- semantic-document schema version;
- provider id;
- model id;
- SHA-256 of normalized semantic-document content.

Conceptually:

```text
embedding:semantic-v1:<provider>:<model>:<sha256>
```

An unchanged repository therefore does not need to be re-embedded when the cache is present.

### 7.2 Validation and failure behavior

Embedding output is rejected when it has:

- wrong vector count;
- non-finite values;
- empty vectors;
- inconsistent dimensions.

Corrupt cache entries are treated as misses instead of poisoning the run.

Cache persistence is an optimization. Cache read/write failure must not break otherwise-valid provider output.

Default embedding batch size is bounded; production implementations must preserve batching and provider-specific timeout/retry budgets.

## 8. Sparse semantic edges — merged P2B contract

Current defaults:

```text
topK = 3
minimum cosine similarity = 0.72
hard topK cap = 8
hard emitted semantic-edge cap = 1200
```

The edge builder:

1. computes cosine similarity;
2. discards scores below the threshold;
3. retains only top-k neighbor candidates per repository;
4. symmetrizes and deduplicates unordered pairs;
5. deterministically orders output;
6. caps final emitted edges to `min(n*k, 1200)` unless an explicitly smaller cap is supplied.

Pairwise similarity computation is currently O(n²), but retained state and graph output are bounded near O(n·k). The project explicitly does **not** materialize or emit a dense pair matrix.

### 8.1 300-repository gate

For 300 repositories and `k=4`:

- pairwise comparisons: `44,850`;
- retained candidates: at most `300 × 4 = 1,200`;
- emitted edges: at most `1,200`.

This is the required stress behavior until a future approximate-nearest-neighbor implementation is justified by measurement.

### 8.2 Provider failure

If the optional embedding provider fails:

- semantic edge generation returns an empty semantic layer plus bounded diagnostics/error text;
- deterministic classification and normal map generation continue;
- no viewer becomes dependent on provider availability.

## 9. Viewer integration — merged P2B behavior

The project now has **twelve** visible visual presets.

Semantic edges are used only where they improve exploratory behavior.

### 9.1 Galaxy family

Galaxy Classic / Systems / Hybrid can consume `semanticEdges` as a faint exploratory relationship layer.

Important constraints:

- canonical ownership/membership edges remain separate;
- Galaxy Systems/Hybrid keep their existing structural edge policy;
- semantic drawing wraps the final Galaxy edge policy after `DOMContentLoaded`;
- search dimming and focus emphasis remain intact;
- semantic links are subtle by default and stronger when incident to selection/hover.

### 9.2 Obsidian-like

Semantic links enter the existing global force layout as ordinary relation links.

The historical Obsidian force constants remain fixed:

```js
center: 0.0026
repel: 9200
link: 0.022
linkDistance: 138
damping: 0.855
```

Interaction invariants also remain:

- deterministic scatter;
- no privileged physical anchors;
- all edge types use the same global force system;
- drag directly moves the node and reheats with `reheat(0.55)`;
- release creates no pin/release anchor;
- released node rejoins the global system;
- empty-space drag pans;
- scroll/pinch zoom remains unchanged.

Do not reintroduce local-neighborhood reheating, release anchors, or owner/category physical anchors.

### 9.3 Hierarchy/facet presets

Tree, Radial, Treemap, Timeline, Cluster, Sunburst, Matrix, and Sankey do not automatically promote semantic edges into their primary structure.

In particular:

- Tree/Radial continue to express hierarchy;
- Matrix continues to use language as a technical facet;
- semantic links do not silently alter aggregate counts/flows.

## 10. Static graph security and migration

Old graph files without new semantic fields remain supported.

New static semantic edges are sanitized before use:

- `type` must be exactly `semantic`;
- source/target must both be known repository IDs;
- self-edges are rejected;
- score must be finite and within `[0,1]`;
- reversed duplicates are canonicalized/deduplicated;
- total semantic edges are capped at 1200.

Structural group/edge data from static input remains untrusted and is rebuilt from sanitized repository nodes as before.

Existing **twelve** visual presets remain compatible with old graph files during migration.

## 11. Tests and acceptance evidence through P2

P1/P2 regression coverage now includes:

- Unicode normalization including Japanese;
- documented P1 domain fixtures;
- deterministic evidence extraction and category confidence;
- `Uncategorized` instead of language fallback;
- README cleaning/truncation/concurrency/rate-limit behavior;
- manifest/framework extraction and bounds;
- old/new static graph compatibility;
- semantic-document source/static parity;
- semantic-document hash stability;
- provider/model cache-key separation;
- cache reuse for unchanged repositories;
- disabled provider path;
- invalid provider vector rejection;
- top-k thresholding/deduplication;
- explicit semantic edge caps;
- 300-repository retained/output bound;
- provider-failure fallback;
- semantic-edge sanitization;
- Galaxy Systems/Hybrid/Obsidian semantic runtime checks;
- Tree exclusion from the exploratory semantic layer;
- unchanged Obsidian force constants and release semantics.

P2A and P2B both passed the repository's full Verify workflow plus Chromium and iPhone WebKit browser gates before merge.

Do not claim future semantic-quality improvement solely from visualization appearance. Future evaluation still needs manual semantic-edge precision and taxonomy stability measurements.

## 12. P3 — portfolio-specific taxonomy discovery (next)

P3 is the next implementation boundary.

The current deterministic category set is a useful fallback, but it must not be treated as universal truth for every portfolio.

### 12.1 Required taxonomy schema

Before selecting any production discovery provider, define a versioned, validated taxonomy structure, for example:

```ts
interface TaxonomyCategory {
  id: string;
  label: string;
  description: string;
  aliases?: string[];
  parentId?: string;
}

interface PortfolioTaxonomy {
  version: number;
  corpusFingerprint: string;
  categories: TaxonomyCategory[];
}
```

Stable IDs must be separated from editable human labels.

### 12.2 Discovery input

Taxonomy discovery should inspect the portfolio as a corpus, not execute one independent LLM prompt per repository.

A compact corpus item can include:

- repository name;
- deterministic classification/evidence;
- compact semantic document fields;
- topics/framework hints;
- optional nearest semantic neighbors from P2.

### 12.3 Discovery output constraints

For a medium portfolio, target roughly 5–10 primary categories, subject to corpus size and actual structure.

Categories should:

- describe domain/purpose, not implementation language;
- use short human-readable labels;
- include explicit descriptions suitable for later embedding/matching;
- avoid unnecessary singleton categories;
- avoid one giant catch-all category where meaningful structure exists;
- preserve stable IDs across refreshes.

### 12.4 Freeze and reuse

Taxonomy discovery must not run on every refresh.

Persist at least:

- taxonomy version;
- corpus fingerprint;
- categories;
- aliases/descriptions;
- human overrides.

Unchanged corpora must preserve taxonomy IDs and labels exactly.

Small repository changes should not cause automatic taxonomy churn. Rediscovery policy must be tested using controlled corpus additions/removals rather than guessed.

### 12.5 Human override behavior

Automatic taxonomy must remain correctable.

The exact config shape can follow existing project conventions, but it should support concepts equivalent to:

```yaml
classification:
  taxonomy: auto
  overrides:
    some-repo:
      category: robotics
      tags: [sim-to-real, manipulation]
  categories:
    robotics:
      label: Robotics
      aliases: [ROS2, Gazebo]
```

Explicit override always outranks automatic assignment.

### 12.6 Category assignment after taxonomy exists

Recommended order:

1. explicit override;
2. very high-confidence deterministic evidence;
3. repository embedding vs category-description embedding;
4. confidence/margin gate;
5. optional LLM judge only for genuinely ambiguous cases;
6. persist final category, secondary tags, confidence, and evidence.

Do not call an LLM once for every repository.

## 13. P3 optional LLM judge boundary

LLM adjudication belongs after taxonomy persistence and semantic assignment are stable.

Requirements before enabling it:

- optional provider boundary;
- strict structured output schema;
- timeout and retry budget;
- deterministic fallback when unavailable or invalid;
- ambiguity gate so clear repositories never call the LLM;
- diagnostics counting adjudicated repositories;
- no provider API key in public Pages output;
- no browser-side LLM call.

An unconditional N-repository LLM loop is prohibited by design.

## 14. P4 — optional hierarchical communities

Only implement P4 if P2/P3 evaluation demonstrates value.

Potential input is the sparse semantic graph from P2.

A Leiden-style hierarchical/community layer is acceptable only when:

- portfolio size is large enough;
- communities are stable under small corpus changes;
- quality/modularity and minimum group size pass chosen thresholds;
- Tree/Sunburst readability improves in controlled fixtures.

A graph community is not automatically a semantic label. If promoted to a subcategory, its label still needs deterministic dominant evidence or another bounded labeling mechanism.

Small portfolios must remain simple and hierarchy must remain disableable.

## 15. Cost, privacy, and performance constraints

Maintain hard bounds before selecting any production AI provider.

Already present through P2:

- max repository limit;
- README byte/character cap;
- bounded manifest probe list/files/concurrency;
- embedding batch bounds;
- content-hash cache identity;
- top-k semantic edge retention;
- semantic edge global cap;
- deterministic provider-failure fallback;
- provider-independent browser viewers.

P3 should add:

- corpus fingerprint cache;
- taxonomy rediscovery threshold/manual refresh control;
- provider timeout/retry budget;
- ambiguity-only LLM count/cost budget;
- taxonomy churn diagnostics.

README/semantic content must not be sent to an external AI provider unless that provider is explicitly configured/enabled. Public repository content may be public, but external-provider use should still be opt-in and documented.

## 16. Metrics still required

Before declaring the whole semantic-classification initiative complete, measure:

- manual classification accuracy on a fixed fixture set;
- percentage of language-fallback-like semantic errors;
- low-confidence classification rate;
- embedding cache hit rate;
- semantic edge count;
- manual precision of semantic neighbor links;
- taxonomy churn across unchanged and near-identical corpora;
- graph artifact size;
- generation network calls/time;
- optional provider cost when enabled.

The initiative is not complete merely because Galaxy/Obsidian look richer.

## 17. Implementation order

### PR 1 — P1A Unicode + README enrichment foundation ✅ merged (#31)

Gate completed: README-resolvable fixture failures improve without breaking existing presets.

### PR 2 — P1B structured evidence + category/language separation ✅ merged (#33)

Gate completed: `graph.json` compatibility retained and language remains available as a technical facet.

### PR 3 — P2 semantic document + embedding abstraction ✅ merged (#35)

Gate completed: local/fake deterministic provider and cache tests require no production provider.

### PR 4 — P2 sparse semantic edges + viewer integration ✅ merged (#36)

Gate completed: no dense edge-output explosion at 100–300 repositories; browser integration passes Chromium/WebKit.

### PR 5 — P3 taxonomy discovery + persistence

Planned scope:

- taxonomy schema;
- corpus fingerprint;
- discovery-provider boundary;
- validation/freeze/reuse;
- human overrides;
- taxonomy stability tests.

**Gate:** unchanged corpus preserves taxonomy IDs/labels unless explicitly rediscovered.

### PR 6 — P3 semantic assignment + ambiguity-only LLM judge

Planned scope:

- category-description embeddings using existing P2 provider abstraction;
- semantic assignment thresholds/margins;
- optional structured adjudicator;
- deterministic fallback;
- diagnostics/cost counters.

**Gate:** unconditional per-repository LLM calls are prohibited and tested.

### PR 7 — P4 hierarchical communities, only if evaluation justifies it

**Gate:** hierarchy remains disableable; small portfolios stay simple; stability/quality thresholds are measured.

## 18. Definition of done for the full initiative

The full semantic-classification initiative is complete only when:

- repository domain never defaults to implementation language;
- Unicode/non-English metadata is preserved;
- README/manifest evidence fixes the documented regressions;
- semantic relationships are available for exploratory presets;
- taxonomy adapts to the portfolio rather than only six global groups;
- automatic taxonomy is stable and overrideable;
- semantic category assignment uses deterministic/embedding evidence before optional LLM adjudication;
- AI providers remain optional generation-time components;
- static viewers remain provider-independent;
- graph growth remains bounded;
- fixture/evaluation metrics demonstrate measurable semantic improvement;
- provider configuration, privacy/cost implications, migration, and overrides are documented.

## 19. Start here next

P1 and P2 are complete. A new development session should **not start by adding an unconditional LLM path**.

Start P3 from Issue #20 in this order:

1. inspect the merged `RepoSemanticDocument`, embedding cache identity, sparse `semanticEdges`, deterministic classification, and current fixtures;
2. define a versioned `TaxonomyCategory` / `PortfolioTaxonomy` schema and corpus fingerprint before selecting any discovery provider;
3. implement validation, freeze/reuse, and human override behavior with a fully local fake discovery provider;
4. prove unchanged corpora preserve taxonomy IDs/labels and that small corpus drift does not cause unnecessary churn;
5. add category-description embedding assignment using the existing P2 provider abstraction only after taxonomy persistence is stable;
6. route only genuinely ambiguous assignments to an optional structured LLM judge with deterministic fallback;
7. keep normal viewers static-only and keep production embedding/LLM providers opt-in.

The next focused implementation should therefore be **P3 taxonomy schema + corpus fingerprint + persistence/freeze + override behavior**, not production LLM integration.
