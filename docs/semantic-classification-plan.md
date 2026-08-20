# Semantic Classification Plan

Tracking issue: #20

Status: **standard primary taxonomy v1 is implemented and is now the default generated assignment layer; cross-user validation and visible-hierarchy promotion are next**

`interactive-project-map` is intended for arbitrary GitHub users. The canonical semantic architecture therefore uses one versioned cross-user primary taxonomy rather than inventing a different primary category vocabulary for every portfolio.

## 1. Merged checkpoint

- P1A / PR #31 — `bb0d7b5cb5f57f5112436dfd16987c993fd022d0`: Unicode-safe normalization, bounded README enrichment, regression fixtures.
- P1B / PR #33 — `de609e89c18e1b4ed25bebb146c3ff2be1050fb7`: deterministic evidence/confidence, bounded manifest/framework evidence, no language semantic fallback.
- P2A / PR #35 — `961c28429770f9366f86e0387d4829682bd3e47e`: `RepoSemanticDocument`, provider-neutral embedding/cache abstraction.
- P2B / PR #36 — `3c3e9099d00e6904aa19485c389ced194935e84e`: bounded sparse semantic edges and Galaxy/Obsidian exploratory integration.
- P3A / PR #39 — `6dad03fa74beb5733c30a7a44bb1dadd22caeca3`: portfolio taxonomy schema/fingerprint/freeze/reuse and override/discovery infrastructure.
- P3B1 / PR #41 — `6f2d4df00ae0e824ff7dbb736c033905bed00afb`: taxonomy assignment, score/margin gate, shared embedding cache and explicit ambiguity.
- P3B2 / PR #42 — `824550a74a33e46ca4ceffd9f43d58befcc40df0`: bounded ambiguity-only adjudicator and strict fallback.
- Evaluation / PR #44 — `bccdd966213e3db15ee53cbac0a1c063f2b80a36`: assignment quality, coverage/ambiguity, churn, balance and provider/cache/call metrics.
- Review candidate / PR #45 — `8b97698b22b6b845e5486c442f726743969b0a3d`: 12-repository evidence-backed review candidate.
- Discovery evaluation / PR #46 — `cc4f936499670a77fea3e0d99509eeeffff9b7a3`: category-ID-invariant pairwise F1 / ARI / purity evaluation.
- Provider benchmark plan / PR #47 — `6c50971fa0c8a2c28805729bdabfda9c8e925dbe`: local-first provider experiment order.
- Standard taxonomy foundation / PR #49 — `45c033239e9fcf399d23be966eafcabca3583e29`: `ipm-standard-v1`, machine-readable schema, namespaced facets and reviewed 12-repository standard fixture.
- Standard taxonomy default / PR #51 — `efc3af6531c505665ee5fc1517d07676cc80cc0a`: standard-v1 becomes the default generated `taxonomyAssignment`; real public 12-repository Gate reaches 12/12 accuracy, 100% coverage and zero ambiguity.

Generated consumer workflows are pinned to the reviewed default-standard implementation commit:

```text
efc3af6531c505665ee5fc1517d07676cc80cc0a
```

## 2. Canonical invariant

> **repository = semantic node; standard primary category = project purpose; language/platform/artifact/ecosystem/topic = orthogonal facets; optional semantic/local-cluster edges = exploration; AI = generation-time only.**

Do not use implementation language as semantic domain. Do not introduce browser-side AI, dense all-pairs graph output, generic concept-node explosion or unconditional per-repository LLM calls.

## 3. Standard taxonomy v1

Canonical machine-readable schema:

- `data/standard-taxonomy.v1.json`
- taxonomy ID: `ipm-standard-v1`
- scope: `github-project-purpose`

Stable primary categories:

```text
ai-ml
data-analytics
visualization-knowledge
applications-services
developer-tools
systems-infrastructure
security-privacy
networking-distributed
hardware-embedded
robotics-automation
game-development
game-modding
science-engineering
education-learning
media-creative
business-productivity
```

There is deliberately no successful `general-other` category. A repository that cannot be classified safely remains explicit ambiguous/Uncategorized.

Breaking semantic splits/merges require a new taxonomy version. Labels/descriptions/aliases may improve additively while stable IDs remain unchanged.

## 4. Facet model

Primary category answers **what the project is for**. Orthogonal information is stored as namespaced facets.

Closed vocabularies:

- `artifact:*` — application, service, library, framework, tool, game-mod, dataset, model, documentation, template, configuration, firmware, research, other.
- `platform:*` — web, desktop, mobile, cli, api, server, embedded, game, cross-platform, other.

Open normalized namespaces:

- `ecosystem:*` — for example `ecosystem:github`, `ecosystem:minecraft`, `ecosystem:ros2`.
- `topic:*` — for example `topic:project-visualization`, `topic:slam`, `topic:board-game`.

Examples:

- React does not imply a `Web` primary category; web is `platform:web`.
- ROS 2 does not imply Python/C++; project purpose is normally `robotics-automation`, with `ecosystem:ros2`.
- Minecraft/NeoForge mods use `game-modding`, with `artifact:game-mod` and `ecosystem:minecraft`.
- `interactive-project-map` uses `visualization-knowledge`, with `artifact:application`, `platform:web`, `ecosystem:github`, `topic:project-visualization`.

GitHub Topics are useful evidence/facets but are repository-defined and are not the canonical hierarchy. ACM CCS remains vocabulary/hierarchy inspiration rather than a direct UI taxonomy because it targets computing research classification.

## 5. Current default generation pipeline

```text
GitHub metadata + bounded README/manifest evidence
        │
        ▼
P1 deterministic evidence
        │
        ▼
RepoSemanticDocument
        │
        ├── optional EmbeddingProvider/cache ──► sparse semanticEdges
        │
        ▼
standard deterministic mapper
  score >= 3
  top1-top2 margin >= 0.75
        │
        ▼
ipm-standard-v1 taxonomy
        │
        ▼
P3B1 assignment
  repository override
    > accepted standard deterministic mapping @ confidence >= 0.90
    > optional embedding score >= 0.62 AND margin >= 0.08
    > ambiguous
        │
        ▼
optional P3B2 ambiguity-only adjudicator
        │
        ▼
repository.taxonomyAssignment
```

Default standard assignment requires no external AI provider. Embedding and adjudicator providers remain disabled unless explicitly supplied.

The standard mapper has its own score+margin Gate; accepted mappings are confidence-calibrated to the unchanged P3B1 `>=0.90` contract. P3B1's threshold was not lowered.

## 6. Compatibility / portfolio-local mode

The earlier portfolio-specific taxonomy machinery remains available as an explicit compatibility/experimental path when:

- internal `taxonomyMode: "portfolio"` is requested;
- a taxonomy discovery provider is supplied; or
- `taxonomy-overrides.json` defines custom category definitions.

Repository-only overrides continue to work in standard mode and may target standard-v1 category IDs.

Portfolio-local discovery is no longer the preferred canonical primary taxonomy. Its future role is an optional `localCluster` / community / exploratory layer that can reveal portfolio-specific neighborhoods without changing cross-user primary category IDs.

## 7. Current reviewed portfolio Gate

Human-reviewed expected fixture:

- `docs/semantic-evaluation-nekomario28.standard-v1.json`

Current 12 public graph-eligible repositories map to:

```text
game-modding            7
robotics-automation      2
game-development        1
hardware-embedded        1
visualization-knowledge  1
```

The profile repository `nekomario28/nekomario28` is excluded consistently with graph generation.

Every PR now runs the real Action against the current public portfolio and requires:

```text
assigned accuracy = 1.0
end-to-end accuracy = 1.0
coverage = 1.0
ambiguity rate = 0
missing rate = 0
```

At PR #51 this Gate passed 12/12 with zero mismatches and zero ambiguity.

This is a strong portfolio regression Gate, not proof that the taxonomy/classifier is universally complete across GitHub.

## 8. Cross-user validation before visible hierarchy promotion

The next quality boundary is **not** another provider. It is broader cross-user/category coverage.

Before `taxonomyAssignment` replaces visible `groupId/groupLabel` globally:

1. build a category-balanced cross-user regression corpus covering all 16 standard categories;
2. include multilingual and sparse-metadata examples;
3. include negative/confusable pairs such as visualization vs developer-tools, game-development vs game-modding, robotics vs science simulation, and hardware integration vs desktop applications;
4. require category IDs to remain stable across refreshes;
5. measure exact-ID assignment accuracy together with coverage/ambiguity;
6. preserve explicit ambiguity rather than forcing weak examples;
7. test old static graphs and custom portfolio mode for backwards compatibility.

Only after that Gate should standard `taxonomyAssignment` be promoted into the primary visible hierarchy used by Radial/Tree/Treemap/Timeline/Cluster/Sunburst/Galaxy layouts.

## 9. Embedding / provider benchmark order

Provider selection remains optional and evidence-driven.

Current local-first order:

```text
A0 deterministic-only control
A1 EmbeddingGemma 300M
A2 Qwen3-Embedding-0.6B
A3 BGE-M3
A4 Qwen3-Embedding-4B only as a quality ceiling if smaller models fail
```

Evaluate stages separately:

1. fixed standard taxonomy assignment — exact-ID accuracy + coverage/ambiguity;
2. optional portfolio-local discovery — category-ID-invariant pairwise F1 / ARI / purity + human wording review;
3. ambiguity-only adjudication — only after earlier stages are fixed.

Do not tune thresholds per model before baseline comparison.

## 10. Sparse-edge / viewer invariants

P2 semantic edges remain separate from structural ownership/membership edges:

```text
topK = 3
minimum cosine similarity = 0.72
hard topK cap = 8
hard emitted edge cap = 1200
```

Galaxy Classic/Systems/Hybrid and Obsidian may display semantic exploratory links. Other hierarchy/facet views retain structural semantics.

Obsidian physics remain unchanged:

```text
center = 0.0026
repel = 9200
link = 0.022
linkDistance = 138
damping = 0.855
```

Also preserve direct drag + `reheat(0.55)`, no release anchor, no privileged physical anchors and no local-neighborhood reheating.

## 11. Next execution order

1. Build a broad standard-v1 cross-user regression corpus spanning all 16 categories and major confusable boundaries.
2. Add deterministic standard-mapper unit/acceptance Gates for that corpus.
3. Add TypeScript/hosted-worker parity so dynamic hosted graphs expose the same standard semantic layer as generated static graphs where practical.
4. Re-run standard assignment quality and ambiguity metrics.
5. If deterministic coverage is insufficient, benchmark A1 → A2 → A3 while leaving standard taxonomy IDs fixed.
6. Only after cross-user Gate passes, promote standard assignment into visible primary hierarchy under a migration flag/test matrix.
7. Keep portfolio-local discovery as optional exploratory clustering rather than canonical cross-user categories.
8. Consider P4 hierarchy/community work only if large-portfolio readability still needs it.
