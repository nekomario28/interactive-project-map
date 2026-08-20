# Semantic Classification Plan

Tracking issue: #20

Status: **P3 architecture/evaluation preparation complete; human review is the next quality gate**

P1/P2, frozen taxonomy state, taxonomy assignment, bounded ambiguity-only adjudication, provider-neutral evaluation, a public-portfolio review candidate, category-ID-invariant discovery evaluation, and a local-first provider benchmark plan are merged. P3 is **not quality-complete** until the candidate fixture is independently human-reviewed and real provider/configuration results pass measured promotion criteria.

## 1. Merged checkpoint

- P1A / PR #31 — `bb0d7b5cb5f57f5112436dfd16987c993fd022d0`: Unicode-safe normalization, bounded README enrichment, regression fixtures.
- P1B / PR #33 — `de609e89c18e1b4ed25bebb146c3ff2be1050fb7`: deterministic evidence/confidence, bounded manifest/framework evidence, no language semantic fallback.
- P2A / PR #35 — `961c28429770f9366f86e0387d4829682bd3e47e`: `RepoSemanticDocument`, provider-neutral embedding/cache abstraction.
- P2B / PR #36 — `3c3e9099d00e6904aa19485c389ced194935e84e`: bounded sparse semantic edges and Galaxy/Obsidian exploratory integration.
- P3A / PR #39 — `6dad03fa74beb5733c30a7a44bb1dadd22caeca3`: taxonomy schema, corpus fingerprint, freeze/reuse, drift protection, human overrides, discovery boundary.
- P3B1 / PR #41 — `6f2d4df00ae0e824ff7dbb736c033905bed00afb`: frozen-taxonomy assignment, score/margin gate, shared embedding cache, explicit ambiguity.
- P3B2 / PR #42 — `824550a74a33e46ca4ceffd9f43d58befcc40df0`: bounded ambiguity-only structured adjudicator, strict validation, call cap, fallback.
- Evaluation / PR #44 — `bccdd966213e3db15ee53cbac0a1c063f2b80a36`: independent-fixture assignment quality, coverage/ambiguity, churn, balance, provider/cache/call metrics and explicit optional thresholds.
- Review candidate / PR #45 — `8b97698b22b6b845e5486c442f726743969b0a3d`: evidence-backed 12-public-repository candidate fixture and human review checklist; explicitly not ground truth.
- Discovery evaluation / PR #46 — `cc4f936499670a77fea3e0d99509eeeffff9b7a3`: category-ID-invariant pairwise precision/recall/F1, Adjusted Rand Index, purity, split/merge diagnostics and coverage gate.
- Provider benchmark plan / PR #47 — `6c50971fa0c8a2c28805729bdabfda9c8e925dbe`: dated local-first embedding candidate matrix and staged embedding → discovery → adjudicator experiment order.

Generated consumer workflows intentionally remain pinned to the reviewed **generator implementation** commit:

```text
824550a74a33e46ca4ceffd9f43d58befcc40df0
```

PRs #44–#47 add evaluation/docs only and do not require repinning consumer generation.

Every merged P3 gate above passed full Verify plus Chromium and iPhone WebKit before merge.

## 2. Core invariant

> **repository = semantic node; category/language/status = facets; semantic similarity = optional sparse edges; AI runs at generation time, never as a normal viewer dependency.**

Do not introduce generic triple extraction, concept-node explosion, dense emitted graphs, unconditional per-repository LLM loops, browser-side AI calls, or language as semantic-domain fallback.

## 3. Generation pipeline

```text
GitHub metadata + bounded README/manifest evidence
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
P3A frozen taxonomy / corpus fingerprint
        │
        ├── human taxonomy/repository overrides
        │
        ▼
P3B1 taxonomy assignment
  override
    > exact P1 taxonomy match @ confidence >= 0.90
    > embedding score >= 0.62 AND margin >= 0.08
    > ambiguous
        │
        ▼
P3B2 optional ambiguity-only adjudicator
  max 20 cases / batch 8 / accept confidence >= 0.70
        │
        ▼
repository.taxonomyAssignment
        │
        └── remains separate from P1 classification/groupId
```

Default embedding, taxonomy-discovery and adjudication providers remain disabled. No production AI vendor is selected.

## 4. Stability / boundedness contracts

P2 semantic edges:

```text
topK = 3
minimum cosine similarity = 0.72
hard topK cap = 8
hard emitted edge cap = 1200
```

For 300 repositories and `k=4`: 44,850 comparisons, retained candidates <= 1,200, emitted edges <= 1,200. Dense all-pairs output remains prohibited.

P3A taxonomy reuse:

1. exact corpus → reuse with zero discovery calls;
2. changed-repository ratio <= 0.15 → reuse original frozen baseline;
3. small-drift reuse does not advance the baseline;
4. larger drift or force refresh makes discovery eligible;
5. disabled/failing provider preserves a previous valid taxonomy;
6. no previous taxonomy + disabled provider → continue without taxonomy.

Taxonomy category schema remains bounded to 1–16 validated categories with stable IDs, labels/descriptions/aliases, valid parents and no cycles.

## 5. Assignment/adjudication contracts

P3B1 precedence:

1. explicit repository override;
2. P1 exact category present in frozen taxonomy with confidence >= 0.90;
3. embedding comparison with score >= 0.62 and top1-top2 margin >= 0.08;
4. otherwise ambiguous.

The Action shares repository embedding cache between P2 and P3B1. Low-score/narrow-margin cases are not forced.

P3B2 receives **only** P3B1 ambiguous repositories. Already-assigned repositories are never sent. Accepted output requires exact repo identity, a taxonomy-existing category, valid confidence and bounded non-empty reason. Invalid/declined/provider-error/cardinality-error paths preserve P3B1 results. Default adjudicator performs zero calls.

## 6. Evaluation: fixed-taxonomy assignment

`npm run evaluate:semantic` uses:

- generated `graph.json`;
- an independent human-labelled expected fixture;
- optional previous graph for churn;
- optional generation diagnostics for calls/cache.

The pipeline's own generated labels/assignments must **never** become their own ground truth.

Measure:

- assigned accuracy = correct / assigned;
- coverage = assigned / present;
- end-to-end accuracy = correct / present;
- ambiguity/missing rates and mismatch lists;
- method contribution and per-category quality;
- taxonomy shape, taxonomy churn and assignment churn;
- semantic-edge/embedding/taxonomy/assignment/adjudicator call/cache diagnostics.

Assigned accuracy must always be interpreted with coverage; refusing most cases is not a valid way to manufacture a high score.

## 7. Evaluation: automatic taxonomy discovery

Exact category IDs are not an appropriate sole score for discovery providers because two equivalent partitions can choose different IDs or wording.

`node scripts/evaluate-taxonomy-partition.mjs` therefore measures assigned repository partitions independently of category IDs:

- pairwise same-category precision / recall / F1;
- Adjusted Rand Index (ARI);
- purity;
- coverage / ambiguity;
- expected vs actual cluster count;
- expected-category fragmentation;
- discovered-cluster mixing.

Interpretation:

- over-splitting hurts pairwise recall / ARI;
- giant catch-all merging hurts pairwise precision / purity / ARI;
- ambiguity cannot hide poor coverage because coverage remains a separate Gate.

Human review is still required for generated label/description wording; clustering metrics cannot approve names.

## 8. Current public-portfolio candidate

Current graph-eligible public corpus: **12 repositories**. The profile repository `nekomario28/nekomario28` remains excluded by the graph builder and candidate fixture Gate.

Files:

- `docs/semantic-evaluation-nekomario28.candidate.json`
- `docs/semantic-evaluation-nekomario28-review.md`

Status: **AI-assisted candidate only; human review required.**

Candidate taxonomy:

- `minecraft-modding` — 7 repositories;
- `robotics` — 2;
- `game-development` — 1;
- `hardware-integration` — 1;
- `developer-tools` — 1.

The candidate has a CI regression checking strict schema, exactly 12 unique repositories, profile exclusion and this intentional five-category distribution. That structural Gate does **not** certify semantic correctness.

## 9. Local-first provider benchmark plan

See `docs/semantic-provider-benchmark-matrix.md`.

Initial embedding comparison after human review:

```text
A0 deterministic-only control
A1 EmbeddingGemma 300M
A2 Qwen3-Embedding-0.6B
A3 BGE-M3
A4 Qwen3-Embedding-4B only as a quality ceiling if smaller models fail
```

Experiment order is deliberately separated:

1. fixed reviewed taxonomy → compare embeddings with exact-ID assignment metrics;
2. automatic taxonomy discovery → compare partition F1 / ARI / purity + human wording review;
3. ambiguity-only adjudicator → evaluate last on unresolved cases only.

Keep score >= 0.62 and margin >= 0.08 unchanged for the first embedding pass. Only run a bounded sensitivity table after the baseline; do not tune each model independently to this 12-repository corpus.

The 12-repository fixture is a portfolio acceptance test, not evidence of general-purpose model superiority.

## 10. Viewer migration boundary

Do **not** promote `taxonomyAssignment` into visible P1 hierarchy yet.

There are 12 visible presets. Galaxy Classic/Systems/Hybrid and Obsidian may use P2 semantic links; Tree/Radial/Treemap/Timeline/Cluster/Sunburst/Matrix/Sankey retain current structural/facet semantics until promotion is measured.

Obsidian historical force invariants remain:

```text
center = 0.0026
repel = 9200
link = 0.022
linkDistance = 138
damping = 0.855
```

Also preserve direct drag + `reheat(0.55)`, no release anchor, no privileged physical anchors, and no local-neighborhood reheating.

## 11. Remaining P3 quality work

- human review/acceptance or correction of every row in `semantic-evaluation-nekomario28-review.md`;
- freeze accepted labels into a non-`candidate` expected fixture;
- run A0/A1/A2/A3 under identical corpus/taxonomy/thresholds and capture diagnostics;
- only run A4 if smaller local models leave meaningful errors/ambiguity;
- benchmark automatic taxonomy discovery separately with ID-invariant partition metrics and human label review;
- measure unchanged/small-drift taxonomy and assignment stability;
- add ambiguity-only adjudication only after earlier stages are fixed;
- review license/privacy/cost before any production provider selection;
- promote `taxonomyAssignment` to primary hierarchy only after the measured Gate passes.

P4 community/hierarchy work remains deferred until these measurements demonstrate a need.

## 12. Next execution order

1. Human-review the 12-row candidate; edit any category that does not describe repository purpose/domain.
2. Freeze the accepted expected fixture.
3. Benchmark A0 → A1 → A2 → A3 with fixed taxonomy and current thresholds.
4. If necessary, perform bounded threshold sensitivity and/or A4 quality-ceiling run.
5. Benchmark taxonomy discovery with pairwise F1 / ARI / purity + coverage and human wording review.
6. Test small-drift churn.
7. Benchmark P3B2 adjudication only on remaining ambiguity.
8. Decide whether a provider/config is justified or deterministic/local-only should remain default.
9. Only then consider hierarchy promotion; P4 follows afterward if still justified.
