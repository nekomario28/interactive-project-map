# Semantic Classification Plan

Tracking issue: #20

Status: **P3A complete; P3B next**

This is the canonical handoff for semantic repository classification in `interactive-project-map`. P1, P2, and the P3A taxonomy-stability foundation are merged. P3 is not complete until taxonomy-based repository assignment and the ambiguity-only adjudication boundary are implemented and evaluated.

## 1. Implementation checkpoint

### P1 — deterministic enrichment and evidence ✅

- P1A / PR #31 — `bb0d7b5cb5f57f5112436dfd16987c993fd022d0`
  - Unicode-safe normalization;
  - bounded README enrichment;
  - concrete regression fixtures.
- P1B / PR #33 — `de609e89c18e1b4ed25bebb146c3ff2be1050fb7`
  - structured evidence/confidence;
  - bounded manifest/framework enrichment;
  - semantic `Uncategorized` instead of programming-language fallback;
  - language retained as a technical facet.

### P2 — semantic representation and sparse relationships ✅

- P2A / PR #35 — `961c28429770f9366f86e0387d4829682bd3e47e`
  - stable bounded `RepoSemanticDocument`;
  - vendor-neutral embedding abstraction;
  - explicit disabled provider;
  - SHA-256 content/provider/model cache identity;
  - batching/cache reuse/vector validation.
- P2B / PR #36 — `3c3e9099d00e6904aa19485c389ced194935e84e`
  - bounded top-k cosine semantic edges;
  - provider-failure fallback;
  - `semanticEdges` separate from ownership/membership `edges`;
  - Galaxy/Obsidian exploratory integration;
  - 300-repository sparse-output gate.

### P3A — taxonomy schema, freeze/reuse, and human override ✅

- P3A / PR #39 — `6dad03fa74beb5733c30a7a44bb1dadd22caeca3`
  - versioned `TaxonomyCategory` / `PortfolioTaxonomy` contracts;
  - corpus-wide discovery input and provider-neutral `TaxonomyDiscoveryProvider` boundary;
  - deterministic corpus fingerprint built from normalized semantic-document hashes;
  - generated `project-map/taxonomy.json` freeze state;
  - optional human-authored `project-map/taxonomy-overrides.json`;
  - exact-corpus reuse with zero additional discovery calls;
  - default 15% small-drift reuse;
  - discovery baseline intentionally does not move during small-drift reuse, preventing cumulative drift from bypassing the threshold;
  - explicit force-refresh boundary;
  - disabled/failing provider preserves an existing frozen taxonomy;
  - category ID/label/description/alias/parent validation and parent-cycle rejection;
  - valid taxonomy preserved in `graph.json`; malformed taxonomy is discarded by static sanitization without rejecting the rest of the graph;
  - taxonomy/semantic corpus aligned to repositories actually admitted by `buildGraph`, including consistent profile-repository exclusion;
  - P1 deterministic classification summary included in bounded discovery input.

Generated consumer workflows are pinned to the reviewed immutable P3A implementation commit:

```text
6dad03fa74beb5733c30a7a44bb1dadd22caeca3
```

P3A passed the full Verify workflow plus Chromium and iPhone WebKit before merge.

## 2. Core invariant

Preserve this invariant throughout P3B/P4:

> **repository = semantic node; category/language/status = facets; semantic similarity = optional sparse edges; AI runs at generation time, never as a normal viewer dependency.**

Do not introduce:

- generic subject-predicate-object knowledge-graph expansion;
- first-class concept nodes for every README term;
- unbounded semantic graph output;
- unconditional per-repository LLM calls;
- browser-side embedding/taxonomy/LLM requests;
- language as semantic-domain fallback.

## 3. Current generation pipeline

```text
GitHub metadata
 + bounded README
 + bounded manifest/framework evidence
        │
        ▼
deterministic classification
 + evidence/confidence
        │
        ▼
RepoSemanticDocument
        │
        ├──────────────► optional embedding provider/cache
        │                         │
        │                         ▼
        │                  sparse semanticEdges
        │
        ▼
portfolio corpus fingerprint
        │
        ├─ taxonomy-overrides.json present → authoritative schema, no discovery call
        │
        ├─ exact corpus → reuse taxonomy.json
        │
        ├─ drift ≤ 15% → reuse original frozen taxonomy
        │
        └─ larger/forced drift → optional TaxonomyDiscoveryProvider
                                  │
                                  ▼
                             taxonomy.json
                                  │
                                  ▼
                              graph.json
```

No production embedding, taxonomy-discovery, or LLM provider is selected by default. Disabled paths remain valid first-class behavior.

## 4. P2 sparse-edge contract that must not regress

Current defaults:

```text
topK = 3
minimum cosine similarity = 0.72
hard topK cap = 8
hard emitted edge cap = 1200
```

The implementation may perform pairwise O(n²) comparisons at current portfolio sizes, but retained candidates/output remain bounded near O(n·k). It must never materialize or emit a dense all-pairs graph.

For 300 repositories and `k=4`:

- comparisons = 44,850;
- retained candidates ≤ 1,200;
- emitted semantic edges ≤ 1,200.

## 5. P3A taxonomy state contract

Generated state:

```text
project-map/taxonomy.json
```

Human-authoritative optional input:

```text
project-map/taxonomy-overrides.json
```

The Action owns `taxonomy.json` and must never rewrite `taxonomy-overrides.json`.

A valid frozen taxonomy includes:

- schema version;
- corpus fingerprint;
- discovery-baseline repository content hashes;
- stable category IDs;
- labels/descriptions/aliases and optional parent IDs;
- provider/model identity.

Raw README text is not persisted in taxonomy state.

### 5.1 Reuse / rediscovery rule

1. exact corpus fingerprint → reuse, no provider call;
2. changed-repository ratio ≤ 0.15 → reuse, no provider call;
3. small-drift reuse keeps the original discovery baseline;
4. drift above threshold → discovery eligible;
5. explicit force refresh → discovery eligible;
6. provider disabled/fails and a previous valid taxonomy exists → preserve it and report stale/fallback diagnostics;
7. provider disabled with no previous taxonomy → continue without taxonomy.

### 5.2 Human schema rule

If override `categories` are present they are authoritative, strictly validated, and discovery is skipped. Stable IDs are separate from display labels.

Current validation includes:

- 1–16 categories;
- lowercase stable IDs using letters/numbers/hyphens;
- unique IDs;
- non-empty bounded label/description;
- bounded aliases;
- parent must exist;
- self-parent/cycles rejected.

## 6. Viewer invariants

There are **twelve** visible presets.

Galaxy Classic / Systems / Hybrid and Obsidian may use `semanticEdges` as an exploratory relationship layer. Tree/Radial/Treemap/Timeline/Cluster/Sunburst/Matrix/Sankey do not automatically treat semantic links as their primary hierarchy/aggregation structure.

Obsidian historical force behavior must remain unchanged unless explicitly redesigned:

```text
center = 0.0026
repel = 9200
link = 0.022
linkDistance = 138
damping = 0.855
```

Also preserve:

- deterministic scatter;
- no privileged owner/category physical anchors;
- no local-neighborhood reheating;
- node drag directly changes position and calls `reheat(0.55)`;
- release creates no pin/release anchor;
- released nodes rejoin the global force system.

## 7. What remains in P3

Issue #20 currently treats these P3A items as complete:

- taxonomy persistence/freeze;
- human-editable taxonomy schema/override.

These remain incomplete:

- real portfolio-specific taxonomy discovery configuration/provider selection;
- repository assignment against the frozen taxonomy;
- primary category + secondary tags + confidence/evidence from taxonomy;
- ambiguity-only LLM adjudication.

A fake/local discovery provider is sufficient for the P3A architecture tests, but it does **not** justify marking automatic portfolio discovery complete.

## 8. P3B — next focused implementation

P3B should be implemented in two gates rather than introducing an LLM immediately.

### P3B1 — taxonomy-based semantic assignment

Use the existing P2 embedding abstraction to embed taxonomy category descriptions and repositories.

Assignment order:

1. explicit/human repository override if one is introduced;
2. retain very-high-confidence deterministic evidence where it cleanly maps to a frozen taxonomy category;
3. compare repository embedding with category-description embeddings;
4. require absolute score and top-vs-second margin thresholds;
5. assign only when confident;
6. keep low-confidence repositories explicitly unresolved/ambiguous rather than forcing a category.

Required tests before merge:

- source/script parity;
- provider/cache reuse;
- category-description cache identity includes taxonomy/category content;
- deterministic tie-breaking;
- threshold and margin behavior;
- unknown/low-score case remains ambiguous;
- provider failure leaves deterministic classification usable;
- unchanged taxonomy/repositories avoid redundant embedding calls;
- no browser provider dependency;
- existing twelve presets remain compatible.

### P3B2 — optional ambiguity-only judge

Only after P3B1 is stable:

- define a provider-neutral structured adjudicator;
- validate strict structured output;
- call it only for repositories that failed deterministic/embedding confidence gates;
- cap calls and diagnostics;
- deterministic fallback on timeout/error/invalid output;
- prohibit unconditional N-repository LLM loops by test.

## 9. P4 — only if evaluation justifies it

Optional hierarchical/community detection can use the sparse semantic graph only after P3 quality/stability is measured. Small portfolios must remain simple, hierarchy must be disableable, and a community is not automatically a semantic label.

## 10. Evaluation still required

Do not claim semantic-quality improvement solely from a nicer visualization.

Before declaring P3 complete, measure at least:

- taxonomy churn across unchanged/small-drift refreshes;
- manual taxonomy quality on a fixed portfolio fixture;
- repository assignment accuracy/ambiguity rate;
- semantic edge precision spot-check;
- provider call/cache counts;
- generation time and output size;
- number of LLM-adjudicated cases once/if P3B2 exists.

## 11. Start here next

The next implementation is **P3B1 taxonomy-based semantic assignment**, not production LLM integration.

Start in this order:

1. define a repository↔taxonomy-category assignment result and diagnostics contract;
2. derive bounded category semantic documents from frozen category id/label/description/aliases;
3. reuse the P2 `EmbeddingProvider` and cache boundary;
4. implement cosine scoring with absolute-score + margin gates;
5. preserve ambiguous/unassigned state rather than forcing a result;
6. attach taxonomy assignment evidence/confidence without removing P1 compatibility fields until migration is proven;
7. add fake-provider/cache/failure fixtures and Action integration;
8. only then consider P3B2 ambiguity-only adjudication.
