# Semantic Classification Plan

Tracking issue: #20

Status: **P3 architecture complete through P3B2; provider selection and evaluation next**

This document is the canonical handoff for semantic repository classification in `interactive-project-map`. P1/P2, frozen taxonomy state, taxonomy-based repository assignment, and a bounded ambiguity-only adjudication boundary are merged. P3 is not declared semantically complete until a real portfolio taxonomy/provider configuration is evaluated and assignment quality is measured.

## 1. Implementation checkpoint

- P1A / PR #31 — `bb0d7b5cb5f57f5112436dfd16987c993fd022d0`: Unicode-safe normalization, bounded README enrichment, regression fixtures.
- P1B / PR #33 — `de609e89c18e1b4ed25bebb146c3ff2be1050fb7`: structured deterministic evidence/confidence, bounded manifest/framework evidence, no language semantic fallback.
- P2A / PR #35 — `961c28429770f9366f86e0387d4829682bd3e47e`: `RepoSemanticDocument`, provider-neutral embedding abstraction, cache identity/batching/validation.
- P2B / PR #36 — `3c3e9099d00e6904aa19485c389ced194935e84e`: bounded sparse semantic edges and Galaxy/Obsidian exploratory integration.
- P3A / PR #39 — `6dad03fa74beb5733c30a7a44bb1dadd22caeca3`: taxonomy schema, corpus fingerprint, freeze/reuse, drift protection, human taxonomy override, provider-neutral discovery boundary.
- P3B1 / PR #41 — `6f2d4df00ae0e824ff7dbb736c033905bed00afb`: taxonomy-based repository assignment with human override, high-confidence deterministic match, embedding score/margin gates, shared cache, explicit ambiguous state.
- P3B2 / PR #42 — `824550a74a33e46ca4ceffd9f43d58befcc40df0`: bounded ambiguity-only structured adjudicator, strict validation, call cap, provider-failure fallback.

Generated consumer workflows are pinned to the reviewed immutable P3B2 implementation commit:

```text
824550a74a33e46ca4ceffd9f43d58befcc40df0
```

P3A, P3B1, and P3B2 each passed full Verify plus Chromium and iPhone WebKit before merge.

## 2. Invariant

> **repository = semantic node; category/language/status = facets; semantic similarity = optional sparse edges; AI runs at generation time, never as a normal viewer dependency.**

Do not introduce generic triple extraction, concept-node explosion, dense graph output, unconditional per-repository LLM loops, browser-side AI calls, or language as semantic-domain fallback.

## 3. Current generation pipeline

```text
GitHub metadata
 + bounded README/manifest evidence
        │
        ▼
P1 deterministic classification/evidence
        │
        ▼
RepoSemanticDocument
        │
        ├── optional EmbeddingProvider/cache ──► P2 sparse semanticEdges
        │
        ▼
P3A corpus fingerprint / frozen taxonomy
        │
        ├── human taxonomy/repository overrides
        │
        ▼
P3B1 taxonomy assignment
  override
    > exact P1 taxonomy match @ confidence >= 0.90
    > embedding top score >= 0.62 AND margin >= 0.08
    > ambiguous
        │
        ▼
P3B2 optional ambiguity-only adjudicator
  max 20 cases / batch 8 / accept confidence >= 0.70
        │
        ▼
repository.taxonomyAssignment
        │
        ▼
graph.json
```

Default embedding, taxonomy-discovery, and adjudication providers remain explicitly disabled. No production AI vendor is selected.

## 4. P2 sparse-edge contract

Defaults:

```text
topK = 3
minimum cosine similarity = 0.72
hard topK cap = 8
hard emitted edge cap = 1200
```

For 300 repositories and `k=4`, the gate remains 44,850 comparisons, retained candidates <= 1,200, emitted edges <= 1,200. Pairwise comparison is currently acceptable at these sizes, but dense all-pairs storage/output is prohibited.

## 5. P3A taxonomy stability contract

Generated state: `project-map/taxonomy.json`.
Human-authoritative optional input: `project-map/taxonomy-overrides.json`.

Default reuse policy:

1. exact corpus → reuse with zero discovery calls;
2. changed-repository ratio <= 0.15 → reuse the original frozen baseline;
3. small-drift reuse does not advance the baseline, preventing cumulative-drift bypass;
4. larger drift or explicit force refresh makes discovery eligible;
5. disabled/failing provider preserves a previous valid taxonomy;
6. provider disabled with no previous taxonomy continues without taxonomy.

Category schema is bounded and validated: 1–16 categories, stable IDs, bounded labels/descriptions/aliases, valid parents, no cycles.

## 6. P3B1 assignment contract

`repository.taxonomyAssignment` is intentionally separate from P1 `classification`, `groupId`, and `groupLabel`.

Precedence:

1. explicit repository override;
2. P1 exact category present in frozen taxonomy with confidence >= 0.90;
3. category-description embedding comparison with `score >= 0.62` and `top1-top2 margin >= 0.08`;
4. otherwise explicit ambiguous.

Taxonomy category embedding cache identity includes category content plus provider/model. The Action shares repository embedding cache between P2 semantic edges and P3B1 so same-run repository vectors are not redundantly embedded.

Low-score/narrow-margin cases are not forced into a category.

## 7. P3B2 ambiguity-only contract

Only P3B1 ambiguous repositories are eligible for adjudication. Already-assigned repositories are never sent.

Hard/default controls:

```text
maximum cases per generation = 20
batch size = 8
hard batch cap = 16
minimum accepted confidence = 0.70
```

Accepted output requires exact repo identity, taxonomy-existing category, valid confidence, and a bounded non-empty reason. Null/empty category or low confidence declines. Unknown category, repo mismatch, malformed confidence, or missing reason is invalid and remains ambiguous.

Provider error or wrong batch cardinality preserves all P3B1 assignments and leaves unresolved cases ambiguous. The default adjudicator is disabled and performs zero calls.

## 8. Migration / viewer boundary

P3B1/P3B2 do **not** promote `taxonomyAssignment` into the visible P1 hierarchy yet. This prevents unmeasured taxonomy quality from silently changing all layouts.

There are 12 visible presets. Galaxy Classic/Systems/Hybrid and Obsidian may use P2 semantic links, while Tree/Radial/Treemap/Timeline/Cluster/Sunburst/Matrix/Sankey keep their existing structural/facet meaning.

Obsidian historical force invariants remain:

```text
center = 0.0026
repel = 9200
link = 0.022
linkDistance = 138
damping = 0.855
```

Also preserve direct drag + `reheat(0.55)`, no release anchor, no privileged physical anchors, and no local-neighborhood reheating.

## 9. What is still not complete

Architecture support exists, but these are deliberately unresolved:

- no production portfolio taxonomy discovery provider/model is selected or configured;
- no production embedding provider is selected by the project;
- no production LLM/adjudicator is selected or configured;
- actual portfolio-specific taxonomy quality has not been benchmarked against a fixed human-labelled fixture;
- taxonomy assignment accuracy/coverage/ambiguity has not been measured with a real provider;
- `taxonomyAssignment` has not been promoted to primary visual hierarchy;
- P4 hierarchical/community detection is not justified yet.

Issue #20 should therefore not be closed and P3 should not be called quality-complete merely because provider boundaries exist.

## 10. Next work: provider-neutral evaluation first

Before choosing a vendor or changing visible grouping, add a reproducible evaluation harness that can measure:

- assignment accuracy against expected labels;
- coverage / ambiguity rate;
- deterministic vs embedding vs adjudicator contribution;
- taxonomy churn under unchanged/small-drift corpora;
- provider calls/cache hits;
- semantic-edge precision spot-check support;
- generation time and output size.

The harness must work with fake/local providers so CI remains deterministic. Real provider/model evaluation can then be run explicitly without changing default behavior.

Only after measured results should the project decide whether to:

1. choose/configure a production or local taxonomy/embedding/adjudication provider;
2. tune score/margin/confidence thresholds;
3. promote `taxonomyAssignment` into primary `classification/groupId`;
4. proceed to P4 community/hierarchy work.
