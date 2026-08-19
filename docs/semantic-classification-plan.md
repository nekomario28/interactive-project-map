# Semantic Classification Plan

Tracking issue: #20

Status: **design fixed; implementation not started**

This document is the canonical handoff for implementing semantic repository classification in `interactive-project-map`. It is intentionally detailed enough that a new development session can start from the repository without needing the original discussion.

## 1. Problem statement

The current classifier in `src/graph.ts` builds a searchable string from:

- repository name
- GitHub description
- primary language
- GitHub topics

It then scores six fixed keyword groups:

- Robotics / ROS 2
- AI / Machine Learning
- Minecraft Modding
- Hardware / Embedded
- Web / Apps
- Coursework / Learning

If none matches, the repository is classified by primary language.

This has three structural problems.

### 1.1 Sparse GitHub metadata is treated as complete semantic evidence

A repository with an empty description/topics but a precise README can only fall back to language. That produces categories such as `Java`, `Python`, or `RTF`, which describe implementation technology rather than project domain.

### 1.2 Current normalization destroys non-ASCII evidence

`normalizeSearch()` currently removes characters outside `[a-z0-9+#]`. Japanese descriptions therefore contribute little or no useful text to classification.

### 1.3 Classification and visualization are too tightly reduced to a single category label

The project now has ten visual presets. A single Owner → Category → Repository tree is sufficient for Tree/Radial, but Galaxy and Obsidian-like can benefit from repository-to-repository semantic relationships, while Matrix should keep language as a technical facet rather than pretending it is a project category.

## 2. Design goals

The replacement pipeline must:

1. improve semantic categorization without requiring AI calls during normal page viewing;
2. preserve the existing static-first architecture;
3. use cheap deterministic evidence before expensive semantic/LLM operations;
4. keep repository nodes as the primary units instead of expanding every concept into a knowledge graph;
5. keep semantic domain and technical language as separate facets;
6. expose sparse repository-similarity edges for Galaxy/Obsidian-like;
7. optionally expose stable subcategories for Tree/Sunburst;
8. remain deterministic enough that unchanged repositories do not jump categories every refresh;
9. support old `graph.json` files during migration;
10. bound network work, graph size, and AI cost.

## 3. Explicit non-goals

Do **not** turn this project into a generic knowledge-graph extractor.

Out of scope:

- subject-predicate-object extraction for arbitrary README concepts;
- concept nodes such as `ROS2`, `Gazebo`, `Python`, `Minecraft` as first-class graph nodes;
- unbounded all-to-all similarity edges;
- calling an LLM once for every repository on every refresh;
- requiring an embedding or LLM provider in the browser viewer;
- replacing GitHub language metadata; language remains useful as a technical facet;
- adopting a heavyweight GraphRAG pipeline wholesale.

## 4. Recommended architecture

```text
GitHub repository metadata
  + bounded README excerpt
  + lightweight manifest/framework evidence
  + fork/source metadata
            │
            ▼
  RepoSemanticDocument (one per repo)
            │
   ┌────────┴─────────┐
   │                  │
   ▼                  ▼
deterministic       embedding
classification      representation
   │                  │
   │                  ├── sparse repo↔repo similarity edges
   │                  │
   └───── confidence ─┤
                      ▼
            portfolio taxonomy
          discovery / frozen schema
                      │
                      ▼
           primary category +
           secondary tags +
           evidence + confidence
                      │
             optional sparse graph
                      │
              hierarchical community
              detection for large sets
                      │
                      ▼
                  graph.json
                      │
       ┌──────────────┼────────────────┐
       ▼              ▼                ▼
 Tree/Sunburst   Galaxy/Obsidian   Matrix/Sankey/etc.
 hierarchy       semantic edges    facets/status
```

The generated `graph.json` remains the source consumed by normal viewers. AI work is a generation-time concern only.

## 5. What to borrow from existing projects

The intent is to reuse ideas first. Copy implementation code only after confirming that doing so is simpler than a local implementation and after preserving attribution/license requirements.

### 5.1 Atomic — adopt the semantic-unit model

Repository: <https://github.com/kenforthewin/atomic>
License: MIT (verified 2026-08-20)

Useful ideas:

- one note/document as one semantic unit;
- embeddings as a representation separate from visible tags;
- semantic similarity links;
- hierarchical/automatic tagging concepts.

Adaptation here:

- one GitHub repository becomes one semantic unit;
- do not import Atomic's application/database architecture;
- use embeddings only during static graph generation;
- expose only top-k, thresholded similarity edges.

### 5.2 sift-kg — adopt corpus-level schema discovery

Repository: <https://github.com/juanceresa/sift-kg>
License: MIT (verified 2026-08-20)

Useful idea:

- look at the complete corpus before deciding the domain/schema;
- persist discovered structure so later runs reuse it;
- keep the structure inspectable/editable.

Adaptation here:

- discover a portfolio-specific taxonomy instead of hard-coding all category names;
- save/freeze the taxonomy in generated state/config;
- allow explicit user overrides;
- do **not** adopt entity/relation knowledge-graph extraction.

### 5.3 Microsoft GraphRAG — adopt optional hierarchical communities

Repository: <https://github.com/microsoft/graphrag>
License: MIT (verified 2026-08-20)

Useful idea:

- hierarchical graph communities, particularly Leiden-style community organization.

Adaptation here:

- only consider community detection after a sparse repo-similarity graph exists;
- enable it only when repository count and cluster quality justify it;
- use communities as optional subcategories for Tree/Sunburst;
- do not import the complete GraphRAG indexing/RAG stack.

### 5.4 References that should not be adopted wholesale

`rahulnyk/knowledge_graph` and `hanxiao/knowledge-graph-extractor` are useful references for text-to-graph extraction and semantic deduplication, but their central abstraction is the wrong one for this project: they expand concepts/entities/relations, whereas this project should preserve **repository = node**.

## 6. Data model

Introduce a generation-time semantic model before changing viewer behavior.

Suggested types (names may change during implementation):

```ts
interface RepoSemanticDocument {
  repoId: number;
  name: string;
  description: string;
  topics: string[];
  readmeExcerpt?: string;
  language?: string | null;
  frameworks: string[];
  manifests: string[];
  fork?: {
    isFork: boolean;
    sourceName?: string;
    sourceDescription?: string;
  };
}

interface ClassificationEvidence {
  source: "name" | "description" | "topic" | "readme" | "manifest" | "dependency" | "fork-source" | "embedding" | "llm" | "override";
  value: string;
  weight?: number;
}

interface RepositoryClassification {
  categoryId: string;
  categoryLabel: string;
  secondaryTags: string[];
  confidence: number; // normalized 0..1
  method: "deterministic" | "semantic" | "llm" | "override";
  evidence: ClassificationEvidence[];
}

interface TaxonomyCategory {
  id: string;
  label: string;
  description: string;
  aliases?: string[];
  parentId?: string;
}

interface SemanticEdge {
  source: string;
  target: string;
  type: "semantic";
  score: number;
}
```

### 6.1 `graph.json` migration

Do not remove existing fields immediately.

Add optional fields first:

- repository `groupId` / `groupLabel`: continue to be populated for compatibility;
- repository `classification`: new structured classification;
- graph `taxonomy`: optional category definitions;
- graph `semanticEdges`: optional sparse similarity edges;
- graph `classificationVersion`: schema/pipeline version.

Old viewers must tolerate the new fields. New viewers must tolerate old graphs where they are absent.

## 7. Evidence acquisition

### 7.1 Tier 0 — existing GitHub metadata

Keep:

- name
- description
- topics
- primary language
- fork/archive state

Language must **not** be the semantic fallback category after migration.

### 7.2 Tier 1 — README enrichment

Fetch README only during graph generation and keep it bounded.

Recommended behavior:

- try GitHub's canonical README endpoint or common root README names;
- cap decoded input by bytes and/or characters;
- prioritize the title, first explanatory paragraphs, badges/keywords, and early feature section;
- strip obvious generated badge URLs/HTML noise before semantic use;
- cache by repository + README blob SHA/ETag where the generation environment permits it;
- a failed/missing README must never fail the whole graph build.

Initial limit suggestion: **8–16 KiB of cleaned text per repository**. Benchmark before raising it.

### 7.3 Tier 2 — manifests/framework hints

Do not recursively scan repositories.

Probe a bounded set of high-value files, for example:

- `package.json`
- `pyproject.toml`
- `requirements.txt`
- `Cargo.toml`
- `go.mod`
- `pom.xml`
- `build.gradle` / `build.gradle.kts`
- `gradle.properties`
- `mods.toml` / `neoforge.mods.toml`
- `package.xml` (ROS)
- `docker-compose.yml` / `compose.yaml` only as supporting evidence

Extract dependency/framework identifiers, not entire files.

Examples:

- `rclpy`, `rclcpp`, ROS package metadata → Robotics evidence;
- `neoforge`, `forge`, `fabric`, Minecraft mod metadata → Minecraft evidence;
- `react`, `next`, `svelte`, `vue` → Web evidence;
- `torch`, `transformers`, `tensorflow` → AI/ML evidence.

This tier should remain deterministic and cheap.

### 7.4 Tier 3 — fork/source evidence

Fork metadata can contain stronger semantics than the local fork description.

Use source/parent name, description, and topics as supporting evidence where available. Do not let source metadata override clear local README evidence because forks may diverge substantially.

## 8. Unicode-safe normalization

This is the first code change to make.

Current behavior strips Japanese text. Replace ASCII-only normalization with Unicode-aware normalization.

Requirements:

- lower/case-fold where meaningful;
- Unicode normalization (`NFKC` is a reasonable candidate);
- preserve letters/numbers from non-Latin scripts;
- normalize punctuation/separators to spaces;
- keep technology tokens such as `C++`, `C#`, `ROS2`, `NeoForge` usable;
- tests must include Japanese repository descriptions.

Do not rely on simple whitespace tokenization for Japanese semantic matching. Deterministic matching can use normalized substring/alias matching, while embedding/LLM stages naturally handle Japanese later.

## 9. P1 — deterministic enrichment before AI

P1 should be independently useful and mergeable.

### 9.1 Target behavior

Classification considers:

1. explicit user override;
2. high-confidence GitHub topics;
3. strong manifest/framework evidence;
4. name/description/README aliases;
5. fork/source supporting evidence;
6. otherwise `Uncategorized` / `Other`, **not language**.

Language stays on the repository node for Matrix and details.

### 9.2 Evidence scoring

Avoid one opaque score. Preserve evidence records and combine them predictably.

Example starting weights, to be tuned by fixtures:

- explicit override: terminal/highest priority;
- exact GitHub topic: 1.0;
- known manifest/dependency: 0.9;
- strong README alias: 0.7;
- description alias: 0.7;
- name alias: 0.5;
- fork/source evidence: 0.4;
- primary language: **0 for semantic domain**.

Do not interpret these as probabilities. Convert final margin/coverage into a normalized `confidence` only after tests establish sensible thresholds.

### 9.3 Ambiguity

A repository may legitimately span domains. P1 should still choose one primary category for compatibility while retaining secondary evidence/tags.

If top categories are close, mark confidence low rather than invent certainty.

## 10. P2 — embeddings and sparse semantic edges

P2 introduces semantic relationships without requiring taxonomy discovery yet.

### 10.1 Embedding provider abstraction

The core graph code must not depend directly on one vendor.

Suggested interface:

```ts
interface EmbeddingProvider {
  id: string;
  model: string;
  embed(texts: string[]): Promise<number[][]>;
}
```

Also support an explicit `disabled` path so the project still works without embeddings.

### 10.2 Cache identity

Embedding cache key should include at least:

- normalized semantic-document content hash;
- provider id;
- model id;
- semantic-document schema version.

An unchanged repo must not be re-embedded unnecessarily.

### 10.3 Sparse edges

Never emit every pair.

Starting rule to test:

- compute similarity;
- retain top `k=3` or `k=4` neighbors per repository;
- require a minimum threshold;
- symmetrize/deduplicate edges;
- cap total semantic edges;
- avoid same-fork-family edges dominating the graph unless semantic content supports them.

This keeps edge growth near O(n·k), not O(n²).

### 10.4 Viewer use

- Obsidian-like: semantic edges can become the primary exploratory links; membership/category forces may remain weak structural guidance.
- Galaxy: use semantic edges for proximity/relationship highlighting while category sectors remain a broad organizing force.
- Tree/Radial: semantic edges normally hidden.
- Matrix: unchanged; language remains a separate facet.

## 11. P3 — portfolio-specific taxonomy discovery

The current six categories are reasonable defaults but should not be treated as universal truth.

### 11.1 Discovery input

Use compact representations of **all** included repositories, not one independent LLM prompt per repo.

Each item should include:

- repository name;
- compact semantic summary/evidence;
- topics/framework hints;
- optionally nearest semantic neighbors.

### 11.2 Discovery output

Target roughly 5–10 primary categories for medium portfolios, with constraints:

- categories describe project domains/purposes, not programming languages;
- labels are short and human-readable;
- descriptions are explicit enough to embed/match against;
- avoid singleton categories unless semantically necessary;
- avoid one giant catch-all category when meaningful structure exists;
- stable IDs are derived separately from human labels.

Suggested structured output:

```json
{
  "version": 1,
  "categories": [
    {
      "id": "robotics",
      "label": "Robotics",
      "description": "Robot simulation, control, navigation, manipulation, and sim-to-real projects",
      "aliases": ["ROS", "ROS 2", "Gazebo", "Isaac"]
    }
  ]
}
```

### 11.3 Freeze and reuse

Taxonomy discovery should not run on every refresh.

Persist:

- taxonomy version;
- corpus fingerprint;
- categories;
- optional manually edited aliases/descriptions.

Rediscover only when explicitly requested or when corpus drift exceeds a threshold (for example, substantial repo additions/removals). Exact policy should be tested rather than guessed.

### 11.4 Assignment

Once taxonomy exists:

1. deterministic evidence can directly assign very high-confidence cases;
2. compare repository embedding with category-description embeddings;
3. if the score/margin is strong, assign semantically;
4. only ambiguous cases go to a small LLM judge;
5. persist the final result and evidence.

This avoids N unconditional LLM calls.

## 12. P4 — optional hierarchical communities

Only add this after P2/P3 metrics show value.

Use the sparse semantic graph as input to a community algorithm such as Leiden.

Enable only when:

- repository count is large enough;
- communities are stable under small refreshes;
- modularity/quality and minimum group sizes exceed chosen thresholds;
- the result improves Tree/Sunburst readability in fixtures.

A community is not automatically a semantic label. If communities become subcategories, label them using deterministic dominant evidence or a bounded LLM summarization step.

Expected use:

```text
Robotics
├── Simulation
│   ├── ...
│   └── ...
├── Sim ↔ Real
│   ├── ...
│   └── ...
└── Runtime / Control
    └── ...
```

Do not force hierarchy for small portfolios.

## 13. Overrides and user control

Automatic classification must remain correctable.

Recommended config shape:

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

Exact file format/location should align with existing project configuration conventions during implementation.

Overrides outrank all automatic evidence.

## 14. Static-first and security constraints

The project currently advertises a static-first architecture. Preserve it.

- generation workflow may call GitHub and optional semantic providers;
- generated artifacts contain classification results;
- public browser viewers consume static artifacts;
- no provider API key is exposed to GitHub Pages;
- no README content is sent to an external AI service unless the user explicitly enabled/configured that provider;
- provider failures degrade to deterministic classification rather than breaking map generation.

For public repositories, README content is public, but external-provider use should still be opt-in/configurable.

## 15. Cost and performance controls

Hard limits must exist before enabling AI stages.

Recommended controls:

- max repositories already exists; preserve it;
- README byte/character cap;
- bounded manifest probe list;
- batch embedding calls;
- content-hash cache;
- top-k semantic edges;
- taxonomy discovery only on corpus change/manual refresh;
- ambiguity-only LLM judging;
- provider timeout/retry budget;
- deterministic fallback.

Record generation diagnostics such as:

- number of READMEs fetched/cache-hit/missing;
- deterministic assignments;
- semantic assignments;
- LLM-adjudicated assignments;
- low-confidence count;
- embedding cache hits;
- semantic edge count.

## 16. Testing strategy

### 16.1 Unit tests

Add tests for:

- Unicode normalization including Japanese;
- deterministic evidence extraction;
- category scoring/margins;
- `Other/Uncategorized` behavior instead of language fallback;
- README truncation/cleaning;
- manifest extraction;
- semantic-document hash stability;
- top-k edge bounding/deduplication;
- taxonomy parsing/validation;
- old/new graph compatibility.

### 16.2 Regression fixtures

Preserve the concrete repos and expected semantic direction in `docs/semantic-classification-evidence.md` and convert them into small local fixtures rather than tests that depend on live GitHub state.

Initial required cases:

- `lime_tidyup` → Robotics, not Python;
- `FTBPublicClaims` → Minecraft Modding, not Java;
- `BuyClaimChunks` → Minecraft Modding, not Java;
- `turing-smart-screen-python-owl` → Hardware/System Monitoring class, not RTF;
- Japanese description remains present after normalization;
- a genuinely uncategorizable repo becomes Other/Uncategorized rather than its implementation language.

### 16.3 Evaluation metrics

Before/after evaluation should include:

- manual classification accuracy on a fixed repo fixture set;
- percentage of language-fallback-like semantic errors;
- low-confidence rate;
- taxonomy churn across identical/near-identical refreshes;
- semantic edge precision by manual spot-check;
- graph size;
- generation network calls/time.

Do not claim improvement based only on a nicer visualization.

## 17. Implementation order

### PR 1 — P1A Unicode + README enrichment foundation

- Unicode-safe normalization.
- README fetch/clean/truncate helper.
- no embeddings/LLM.
- regression fixtures and tests.

**Gate:** known README-resolvable failures improve without breaking existing presets.

### PR 2 — P1B structured evidence + category/language separation

- `ClassificationEvidence` and confidence.
- manifest/framework probes.
- semantic category no longer falls back to language.
- compatibility fields preserved.

**Gate:** `graph.json` remains backward compatible and Matrix still receives language.

### PR 3 — P2 semantic document + embedding abstraction

- semantic document builder;
- provider interface;
- cache identity;
- local/fake deterministic test provider.

**Gate:** no production provider required for tests.

### PR 4 — P2 sparse semantic edges + viewer integration

- top-k similarity graph;
- Obsidian/Galaxy integration;
- edge-count/performance tests.

**Gate:** no dense edge explosion at 100–300 repos.

### PR 5 — P3 taxonomy discovery + persistence

- taxonomy schema;
- discovery provider boundary;
- validation/freeze/override behavior;
- semantic category assignment.

**Gate:** unchanged corpus preserves taxonomy IDs/labels unless explicitly rediscovered.

### PR 6 — P3 ambiguity-only LLM judge

- optional adjudicator;
- strict structured output validation;
- deterministic fallback on failure;
- diagnostics/cost counters.

**Gate:** unconditional per-repo LLM calls are prohibited by test/design.

### PR 7 — P4 hierarchical communities (only if evaluation justifies it)

- sparse graph community detection;
- stability thresholds;
- Tree/Sunburst subcategory integration.

**Gate:** retain ability to disable hierarchy; small portfolios remain simple.

## 18. Definition of done

The semantic-classification initiative is complete when:

- repository domain no longer defaults to language;
- Unicode/non-English metadata is preserved;
- README/manifest evidence fixes the known regressions;
- semantic relationships are available for exploratory presets;
- taxonomy can adapt to the portfolio rather than only six global groups;
- automatic taxonomy is stable and overrideable;
- AI providers are optional generation-time components;
- static viewers remain provider-independent;
- graph growth is bounded;
- the fixture/evaluation suite demonstrates a measurable classification improvement;
- docs describe provider configuration, privacy/cost implications, and migration behavior.

## 19. Start-here instructions for the next development session

A new session should **not start by integrating an LLM**.

Start with Issue #20 and this sequence:

1. inspect current `src/graph.ts`, `src/github.ts`, `src/types.ts`, graph-generation scripts, and tests;
2. run the current test suite and capture baseline;
3. implement Unicode-safe normalization with regression tests;
4. implement bounded README enrichment with a fake GitHub-fetch fixture;
5. reproduce the documented misclassification cases locally;
6. make P1A green before touching embeddings or taxonomy discovery;
7. open one focused PR for P1A.

When making architectural choices, preserve the invariant:

> **repository = semantic node; category/language/status = facets; semantic similarity = optional sparse edges; AI runs at generation time, never as a viewer dependency.**
