# Semantic Classification Plan

Tracking issue: #20

Status: **P3 architecture + evaluation harness complete; human-reviewed fixture and provider comparison next**

This is the canonical handoff for semantic repository classification in `interactive-project-map`. P1/P2, frozen taxonomy state, taxonomy assignment, bounded ambiguity-only adjudication, and provider-neutral evaluation tooling are merged. P3 is **not quality-complete** until a real portfolio is independently labelled, candidate provider/configurations are measured, and promotion criteria pass.

## 1. Merged checkpoint

- P1A / PR #31 — `bb0d7b5cb5f57f5112436dfd16987c993fd022d0`: Unicode-safe normalization, bounded README enrichment, regression fixtures.
- P1B / PR #33 — `de609e89c18e1b4ed25bebb146c3ff2be1050fb7`: structured deterministic evidence/confidence, bounded manifest/framework evidence, no language semantic fallback.
- P2A / PR #35 — `961c28429770f9366f86e0387d4829682bd3e47e`: `RepoSemanticDocument`, provider-neutral embedding abstraction, batching/cache/vector validation.
- P2B / PR #36 — `3c3e9099d00e6904aa19485c389ced194935e84e`: bounded sparse semantic edges and Galaxy/Obsidian exploratory integration.
- P3A / PR #39 — `6dad03fa74beb5733c30a7a44bb1dadd22caeca3`: taxonomy schema, corpus fingerprint, freeze/reuse, drift protection, human overrides, provider-neutral discovery boundary.
- P3B1 / PR #41 — `6f2d4df00ae0e824ff7dbb736c033905bed00afb`: frozen-taxonomy assignment, score/margin gate, shared embedding cache, explicit ambiguity.
- P3B2 / PR #42 — `824550a74a33e46ca4ceffd9f43d58befcc40df0`: bounded ambiguity-only structured adjudicator, strict validation, hard call cap, fallback.
- Evaluation / PR #44 — `bccdd966213e3db15ee53cbac0a1c063f2b80a36`: independent human-fixture evaluation, accuracy/coverage/ambiguity, taxonomy/assignment churn, category balance, provider/cache/call metrics and optional CI thresholds.

Generated consumer workflows intentionally remain pinned to the reviewed generator implementation commit:

```text
824550a74a33e46ca4ceffd9f43d58befcc40df0
```

PR #44 changes evaluation tooling only; it does not require repinning consumer generation.

P3A, P3B1, P3B2 and the evaluation harness each passed full Verify plus Chromium and iPhone WebKit before merge.

## 2. Core invariant

> **repository = semantic node; category/language/status = facets; semantic similarity = optional sparse edges; AI runs at generation time, never as a normal viewer dependency.**

Do not introduce generic triple extraction, concept-node explosion, dense emitted graphs, unconditional per-repository LLM loops, browser-side AI calls, or language as semantic-domain fallback.

## 3. Current pipeline

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
        ├── remains separate from P1 classification/groupId
        │
        ▼
graph.json
        │
        ▼
P3 evaluation harness
  graph.json + independent human expected fixture
  + optional previous graph + run diagnostics
```

Default embedding, taxonomy-discovery and adjudication providers remain disabled. No production AI vendor is selected.

## 4. P2 sparse-edge contract

Defaults:

```text
topK = 3
minimum cosine similarity = 0.72
hard topK cap = 8
hard emitted edge cap = 1200
```

For 300 repositories and `k=4`: 44,850 comparisons, retained candidates <= 1,200, emitted semantic edges <= 1,200. Dense all-pairs storage/output remains prohibited.

## 5. P3A taxonomy stability contract

Generated state: `project-map/taxonomy.json`.
Human-authoritative optional input: `project-map/taxonomy-overrides.json`.

Reuse policy:

1. exact corpus → reuse, zero discovery calls;
2. changed-repository ratio <= 0.15 → reuse original frozen baseline;
3. small-drift reuse does not advance the baseline;
4. larger drift or force refresh makes discovery eligible;
5. disabled/failing provider preserves a previous valid taxonomy;
6. no previous taxonomy + disabled provider → continue without taxonomy.

Category schema is bounded and validated: 1–16 categories, stable IDs, bounded labels/descriptions/aliases, valid parents, no cycles.

## 6. P3B1 assignment contract

`repository.taxonomyAssignment` remains separate from P1 `classification`, `groupId`, and `groupLabel`.

Precedence:

1. explicit repository override;
2. P1 exact category in frozen taxonomy with confidence >= 0.90;
3. category-description embedding with `score >= 0.62` and `top1-top2 margin >= 0.08`;
4. otherwise ambiguous.

The Action shares repository embedding cache between P2 semantic-edge generation and P3B1 assignment. Low-score/narrow-margin cases are not forced.

## 7. P3B2 ambiguity-only contract

Only P3B1 ambiguous repositories are eligible. Already-assigned repositories are never sent.

```text
maximum cases per generation = 20
batch size = 8
hard batch cap = 16
minimum accepted confidence = 0.70
```

Accepted output requires exact repo identity, taxonomy-existing category, valid confidence and bounded non-empty reason. Invalid/declined/provider-error/cardinality-error paths preserve P3B1 assignments and unresolved ambiguity. Default adjudicator is disabled and performs zero calls.

## 8. Evaluation contract — merged PR #44

The evaluator takes:

- generated `graph.json`;
- a separate **human-labelled** expected fixture;
- optional previous `graph.json` for stability measurement;
- optional generation diagnostics for provider/cache/call metrics.

The pipeline's own taxonomy or assignments must **never** be copied into expected labels and treated as ground truth.

Measured assignment quality:

- assigned accuracy = correct / assigned;
- coverage = assigned / present expected repositories;
- end-to-end accuracy = correct / present expected repositories;
- ambiguity and missing rates;
- mismatches / ambiguous / missing lists;
- method contribution: override / deterministic / semantic / llm;
- per-category coverage and assigned accuracy.

Assigned accuracy must always be interpreted with coverage; refusing most cases is not an acceptable way to manufacture high accuracy.

Measured taxonomy/stability quality:

- unused/singleton categories;
- largest assigned category share;
- added/removed/renamed taxonomy IDs;
- taxonomy churn rate;
- repository assignment churn;
- corpus fingerprint change.

Measured cost/execution signals:

- semantic-edge comparisons/retained/emitted;
- embedding cache hits/new embeddings;
- taxonomy discovery/reuse/drift reason;
- repository/category assignment cache hits;
- adjudicator eligible/attempted/accepted/declined/invalid/calls.

`npm run evaluate:semantic` has no quality threshold by default. Explicit thresholds can gate accuracy, coverage, ambiguity, missing data, taxonomy/assignment churn, category concentration and adjudicator call count.

## 9. Current real-portfolio review candidate

A first **AI-assisted, non-authoritative** draft for the current 12 graph-eligible public repositories lives at:

- `docs/semantic-evaluation-nekomario28.candidate.json`
- `docs/semantic-evaluation-nekomario28-review.md`

It intentionally carries `candidate` status and must not be used as a promotion/release gate until a human reviews every repository.

Initial candidate taxonomy:

- `minecraft-modding` — 7 repositories;
- `robotics` — 2;
- `game-development` — 1;
- `hardware-integration` — 1;
- `developer-tools` — 1.

The profile repository `nekomario28/nekomario28` is excluded consistently with the graph builder.

## 10. Migration / viewer boundary

Do **not** promote `taxonomyAssignment` into the visible P1 hierarchy yet.

There are 12 visible presets. Galaxy Classic/Systems/Hybrid and Obsidian may use P2 semantic links. Tree/Radial/Treemap/Timeline/Cluster/Sunburst/Matrix/Sankey keep their current structural/facet semantics until measured promotion.

Obsidian force invariants remain:

```text
center = 0.0026
repel = 9200
link = 0.022
linkDistance = 138
damping = 0.855
```

Also preserve direct drag + `reheat(0.55)`, no release anchor, no privileged physical anchors, and no local-neighborhood reheating.

## 11. What remains before P3 quality-complete

- human review/acceptance or correction of the real-portfolio expected fixture;
- real portfolio taxonomy discovery demonstrated to produce useful stable categories;
- comparison of candidate embedding/taxonomy/adjudicator configurations using the frozen independent fixture;
- measured accuracy + coverage + ambiguity + churn + category balance + call/cache cost;
- privacy/cost review of any production provider;
- provider/config selection only if measurements justify it;
- promotion of `taxonomyAssignment` to primary hierarchy only after the Gate passes.

P4 community/hierarchy work remains deferred until these measurements demonstrate a need.

## 12. Next execution order

1. Human-review `semantic-evaluation-nekomario28-review.md`; accept/edit every row.
2. Freeze the accepted labels into a non-`candidate` expected fixture.
3. Establish candidate provider/config matrix: local/offline first where practical, then remote options if quality warrants the privacy/cost tradeoff.
4. Generate comparable graphs with identical corpus/fixture and record run diagnostics.
5. Run `npm run evaluate:semantic` for accuracy, coverage, ambiguity, taxonomy shape, churn and calls/cache.
6. Tune thresholds only from measured evidence, not aesthetics.
7. Select provider/config or retain deterministic/local-only behavior.
8. Only then consider hierarchy promotion; P4 comes afterward if still justified.
