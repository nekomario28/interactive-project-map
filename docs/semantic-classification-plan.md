# Semantic Classification Plan

Tracking issue: #20

Status: **standard-taxonomy migration complete; `ipm-standard-v1` is the default assignment and visible hierarchy for standard mode. Optional local clustering/P4 is a separate future experiment, not part of the canonical migration.**

`interactive-project-map` is intended for arbitrary GitHub users. The canonical semantic architecture uses one versioned cross-user primary taxonomy rather than inventing a different primary vocabulary for every portfolio.

## 1. Completed migration checkpoint

- P1A / PR #31 — `bb0d7b5cb5f57f5112436dfd16987c993fd022d0`: Unicode-safe normalization, bounded README enrichment, regression fixtures.
- P1B / PR #33 — `de609e89c18e1b4ed25bebb146c3ff2be1050fb7`: deterministic evidence/confidence, bounded manifest/framework evidence, no language semantic fallback.
- P2A / PR #35 — `961c28429770f9366f86e0387d4829682bd3e47e`: bounded `RepoSemanticDocument`, provider-neutral embedding/cache abstraction.
- P2B / PR #36 — `3c3e9099d00e6904aa19485c389ced194935e84e`: bounded sparse semantic edges and Galaxy/Obsidian exploratory integration.
- P3A / PR #39 — `6dad03fa74beb5733c30a7a44bb1dadd22caeca3`: taxonomy schema/fingerprint/freeze/reuse and override/discovery infrastructure.
- P3B1 / PR #41 — `6f2d4df00ae0e824ff7dbb736c033905bed00afb`: taxonomy assignment, score/margin gate, shared embedding cache and explicit ambiguity.
- P3B2 / PR #42 — `824550a74a33e46ca4ceffd9f43d58befcc40df0`: bounded ambiguity-only adjudicator and strict fallback.
- Evaluation / PR #44 — `bccdd966213e3db15ee53cbac0a1c063f2b80a36`: accuracy, coverage/ambiguity, churn, balance and provider/cache/call metrics.
- Discovery evaluation / PR #46 — `cc4f936499670a77fea3e0d99509eeeffff9b7a3`: category-ID-invariant pairwise F1 / ARI / purity evaluation.
- Provider benchmark plan / PR #47 — `6c50971fa0c8a2c28805729bdabfda9c8e925dbe`: local-first optional-provider experiment order.
- Standard taxonomy foundation / PR #49 — `45c033239e9fcf399d23be966eafcabca3583e29`: `ipm-standard-v1`, machine-readable schema, namespaced facets and reviewed 12-repository fixture.
- Standard taxonomy default / PR #51 — `efc3af6531c505665ee5fc1517d07676cc80cc0a`: standard-v1 becomes the default generated assignment layer.
- Cross-category Gate / PR #55 — `97eb1484ab8c56743d8b93f1aec9822dd16534a3`: all 16 standard categories plus major confusable boundaries.
- Hosted parity / PR #56 — `03e759b1134768df5de6287d7d11384bc28122ee`: Node Action and hosted TypeScript use the same standard semantic contract.
- Generalization / PR #58 — `a71289470acd5cb6029fb00522b6f8dbd40181e2`: single-source signal profile; Spanish/Chinese/Korean/German, sparse-metadata and negative-boundary Gates.
- Visible hierarchy / PR #59 — `977531824bc7a65c703c692ea4de98b4fed7ca5f`: standard assignment promoted into visible `Owner → Category → Repository` hierarchy in Action, hosted dynamic and sanitized static paths.

Generated consumer workflows are pinned to the reviewed visible-hierarchy implementation commit:

```text
977531824bc7a65c703c692ea4de98b4fed7ca5f
```

## 2. Canonical invariant

> **repository = semantic node; standard primary category = project purpose; language/platform/artifact/ecosystem/topic/status = orthogonal facets; semantic/local-cluster relations = optional exploration; AI = generation-time only.**

Do not use implementation language as semantic domain. Do not introduce browser-side AI, dense emitted all-pairs graphs, generic concept-node explosion or unconditional per-repository LLM calls.

## 3. Standard taxonomy v1

Canonical machine-readable schema:

- `data/standard-taxonomy.v1.json`
- taxonomy ID: `ipm-standard-v1`
- scope: `github-project-purpose`

Stable primary IDs:

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

There is deliberately no successful `general-other`. A repository that cannot be classified safely stays explicit ambiguous/Uncategorized. Breaking semantic splits/merges require a new taxonomy version; labels/descriptions/aliases may improve additively while stable IDs remain unchanged.

## 4. Current default generation pipeline

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
ipm-standard-v1
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
        │
        ▼
standard visible hierarchy promotion
  assigned repo -> standard category
  unresolved repo -> Uncategorized
```

Default standard assignment requires no external AI provider. Embedding and adjudicator providers remain disabled unless explicitly supplied.

## 5. Cross-user validation now in CI

The pre-promotion acceptance criteria are complete:

- all 16 primary categories have balanced conformance coverage;
- explicit confusable boundaries cover visualization↔developer-tools, game-development↔game-modding, robotics↔science, hardware↔applications, AI↔data, systems↔networking, business↔applications and media↔visualization;
- multilingual generalization includes Spanish, Simplified Chinese, Korean and German in addition to English/Japanese coverage;
- sparse topic/README/framework/P1-prior cases are tested;
- weak technology/language hints and balanced neighboring-domain ties remain ambiguous;
- Action and hosted TypeScript classification stay byte-for-byte equivalent on the conformance/generalization corpora;
- old/static graph sanitization and portfolio/custom-taxonomy compatibility are gated;
- all 12 visual presets plus Chromium and iPhone WebKit regressions passed visible-hierarchy promotion.

The reviewed current public portfolio Gate remains:

```text
expected = 12
correct = 12
coverage = 1.0
ambiguity rate = 0
missing rate = 0
```

This remains a portfolio regression Gate, not proof of universal GitHub accuracy.

## 6. Facets and visible hierarchy

Primary category answers **what the project is for**. Orthogonal information stays namespaced:

- `artifact:*`
- `platform:*`
- `ecosystem:*`
- `topic:*`

Examples:

- React is `platform:web`, not a primary Web category.
- ROS 2 is normally `ecosystem:ros2` under `robotics-automation`.
- Minecraft/NeoForge mods use `game-modding` plus `artifact:game-mod` / `ecosystem:minecraft`.
- `interactive-project-map` uses `visualization-knowledge` plus GitHub/project-visualization facets.

Standard mode now rebuilds visible group nodes and membership/ownership edges from trusted standard assignments. Only categories used by the current portfolio are shown. Unresolved repositories remain under explicit `Uncategorized`.

P1 `classification` is retained as compatibility/evidence data. `semanticEdges` stay separate from structural hierarchy.

## 7. Compatibility / optional portfolio-local mode

The earlier portfolio-specific taxonomy machinery remains available only as an explicit compatibility/experimental path when:

- internal `taxonomyMode: "portfolio"` is requested;
- a taxonomy discovery provider is supplied; or
- `taxonomy-overrides.json` defines custom categories.

Repository-only overrides remain valid in standard mode and may target standard-v1 IDs.

Portfolio-local discovery is **not** a second canonical taxonomy. If revisited, it should surface as optional `localCluster` / subcategory/community exploration while preserving standard primary IDs.

## 8. Optional providers

Provider selection is no longer a prerequisite for the canonical taxonomy.

If deterministic coverage on future independently labelled corpora becomes insufficient, benchmark in this order without changing standard IDs or thresholds before the baseline:

```text
A0 deterministic-only
A1 EmbeddingGemma 300M
A2 Qwen3-Embedding-0.6B
A3 BGE-M3
A4 Qwen3-Embedding-4B only as a quality ceiling
```

Evaluate fixed-taxonomy assignment, optional local discovery, and ambiguity-only adjudication separately.

## 9. Sparse-edge / viewer invariants

P2 semantic edges remain separate from structural ownership/membership edges:

```text
topK = 3
minimum cosine similarity = 0.72
hard topK cap = 8
hard emitted edge cap = 1200
```

Galaxy Classic/Systems/Hybrid and Obsidian may display semantic exploratory links. Other views preserve their aggregation/hierarchy semantics.

Obsidian physics remain unchanged:

```text
center = 0.0026
repel = 9200
link = 0.022
linkDistance = 138
damping = 0.855
```

Preserve direct drag + `reheat(0.55)`, no release anchor, no privileged physical anchors and no local-neighborhood reheating.

## 10. Migration closure and next work

The standard-taxonomy migration line is complete at PR #59 plus the consumer pin closeout. Further semantic work is optional and should be justified by measured value.

Next independent workstreams:

1. **Search-aware repo/category highlighting** — Issue #57. Use standard category IDs/facets, preserve layout/physics, dim rather than remove nonmatches, and add keyboard navigation plus browser regressions.
2. **Optional P4/local clusters** — only test on sufficiently large portfolios. Keep any communities exploratory unless controlled readability/semantic evaluation shows value.
3. **Provider benchmarking** — only if broader independently labelled data shows deterministic coverage is insufficient.

Canonical details: `docs/standard-taxonomy-v1.md`, `data/standard-taxonomy.v1.json`, `data/standard-taxonomy-signals.v1.json`, `docs/semantic-evaluation.md`, `docs/semantic-taxonomy-partition-evaluation.md`, and `docs/semantic-provider-benchmark-matrix.md`.
