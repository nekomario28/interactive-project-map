# Repository assessment model v1

Status: **experimental contract / no production scoring formula yet**

This document defines the repository-assessment layer for Interactive Project Map (IPM): Quality, Impact, Scale, Maturity/Activity, evidence Confidence, Personal Contribution, and later Portfolio Prominence. It is intentionally separate from the existing project-purpose taxonomy and from the current production graph/rendering contract.

The goal is not to manufacture one universal `quality = 83` number. The goal is to make heterogeneous repositories comparable **without rewarding irrelevant process, ignoring real external impact, or attributing a large collaborative project's full reputation to one person**.

Machine-readable policy: [`../data/repository-assessment-policy.v1.json`](../data/repository-assessment-policy.v1.json).

Contract fixtures: [`../fixtures/repository-assessment-cases.v1.json`](../fixtures/repository-assessment-cases.v1.json).

Focused evidence layers:

- [`repository-quality-evidence-v1.md`](./repository-quality-evidence-v1.md)
- [`repository-impact-calibration-v1.md`](./repository-impact-calibration-v1.md)
- [`repository-contribution-calibration-v1.md`](./repository-contribution-calibration-v1.md)

## 1. Relationship to Standard Taxonomy v1

Standard Taxonomy v1 remains authoritative for semantic project classification.

- **Primary category** answers what the project is for.
- **Artifact facets** answer what kind of artifact the repository provides.
- **Platform / ecosystem / topic facets** remain orthogonal context.
- Assessment must not create a second per-user global archetype taxonomy.

Assessment routing consumes taxonomy/facet evidence instead of replacing it.

A repository can expose multiple meaningful artifacts. A research repository may legitimately combine research code, a dataset, a model, documentation, and a demo. Assessment profiles are therefore **composable artifact modules**, not one mutually-exclusive archetype enum.

## 2. Assessment context comes before scoring

Before evaluating a repository, recover the context that controls which evidence matters:

```text
purpose / primary category
artifact facets
platform / ecosystem / topic facets
lifecycle
repository relation / ownership
project scope and collaboration scale
existing project-owned or external assessments
available, missing, stale, conflicting, and unknown evidence
```

Lifecycle is assessment context, not a new primary taxonomy category:

```text
active
maintenance
stable
frozen
snapshot
archived
experimental
unknown
```

A frozen dataset or completed research snapshot must not be penalized merely because it has no recent commits.

## 3. Applicability, authority, and evidence state are separate axes

The earlier draft incorrectly treated `external` as an applicability state. That collapses two independent questions and is no longer the contract.

### Applicability

Applicability answers: **does this outcome matter for this repository's declared purpose/lifecycle?**

```text
required
recommended
optional
not-applicable
unknown
```

- `required` — absence materially undermines the stated contract.
- `recommended` — normally useful for this context, but not universally required.
- `optional` — useful evidence/polish but not a quality requirement.
- `not-applicable` — irrelevant to the repository's purpose/lifecycle and excluded from Quality scoring.
- `unknown` — applicability is not established.

### Assessment authority

Authority answers: **who or what produced the evidence?**

```text
repository-native
project-owned
external
mixed
unknown
```

Examples:

```text
security-safety
  applicability = required
  authority     = external
```

```text
verification
  applicability = recommended
  authority     = mixed
```

The second case can represent repository-native tests plus an independent conformance harness.

### Evidence state

Evidence state answers: **what is currently known about the evidence?**

```text
observed
absent
not-collected
stale
conflicting
unknown
```

These axes are orthogonal. `not-applicable`, `external`, and `unknown` must never be silently converted to the same numeric zero.

## 4. Assess outcomes, not mechanisms

Common Quality dimensions are outcome-oriented:

```text
understandability
verification
reproducibility
maintainability
integrity
interoperability
security-safety
stewardship
```

Mechanisms are evidence for those outcomes, not universal score rows.

Verification asks whether credible evidence exists that the contracts which matter are checked. Evidence may come from CI, tests, a local validator, schema validation, deterministic generator checks, scientific benchmarks, dataset integrity checks, external conformance harnesses, or reviewed frozen acceptance records.

A repository does not earn Quality merely by having more workflows, badges, process files, or releases. Conversely, a repository is not defective for omitting mechanisms that do not serve its contract.

## 5. Artifact-specific routing

Artifact facets select default emphasis. Emphasized dimensions currently default to `recommended`; other dimensions default to `optional` until domain/project context overrides them.

### Dataset

Emphasize schema/metadata, provenance, license/usage, checksums/integrity, version/freeze identity, accessibility/loaders, interoperability, reproducible generation/curation where relevant, limitations/bias/privacy, and stewardship.

Repository hygiene does not prove intrinsic label correctness, scientific validity, or population representativeness.

### Model

Emphasize model documentation, training/evaluation provenance, weight/version identity, reproducibility, evaluation coverage, intended/unsupported use, limitations, and safety/security when relevant.

Repository Quality and model capability are separate claims.

### Research

Emphasize method clarity, experiment configuration, dataset/model/dependency provenance, reproducibility, claim-to-evidence traceability, negative results/limitations, and benchmark identity.

A research repository may have no meaningful CI requirement.

### Library / framework

Emphasize API/docs, compatibility contracts, verification, release/versioning discipline, dependency handling, examples, migration/stability evidence, and ecosystem integration as applicable.

### Application / service / tool

Emphasize install/run path, verification, operational/release evidence, maintainability, security/safety as applicable, user-facing documentation, and service/API contracts where relevant.

### Documentation / template / configuration

Emphasize clarity, reference correctness, provenance/version, integrity, reproducible generation when relevant, and declared lifecycle. Do not manufacture a CI/release requirement just to populate a scorecard.

### Firmware / game-mod

Use the same common dimensions but include hardware/device validation or loader/game compatibility evidence where applicable.

These modules are routing defaults. A domain-specific canonical benchmark or contract may supersede them.

## 6. Evidence provenance and Confidence

Evidence retains provenance. Current trust classes:

```text
A = independently reproducible / machine-verified external evidence
B = canonical project-owned benchmark, acceptance, release, or validation evidence
C = direct repository structure/content/metadata evidence
D = maintainer declaration / unverified self-description
U = unknown / unavailable
```

These are Confidence inputs, not moral grades and not direct Quality points.

Every material external/project-owned result should preserve source identity, revision/version where available, observation time when relevant, and claim boundary. External systems may own only one dimension; a security scorecard, benchmark suite, coverage service, dataset validator, or scientific evaluator must not automatically replace the entire repository assessment.

Conflicting evidence must remain visible rather than being silently averaged away.

## 7. Quality evidence vector before Quality score

`buildQualityEvidenceVector()` produces an explainable vector before any composite score exists. Each common dimension retains:

```text
applicability
authority
evidenceState
disposition
evidenceCount
evidence[]
```

Current dispositions include:

```text
evidenced
unevidenced
excluded
unresolved-applicability
stale
conflicting
```

The current output explicitly keeps:

```text
compositeQualityScore = null
```

Impact counters such as stars, forks, downloads, dependents, citations, upstream stars, or project stars are rejected as Quality evidence inputs.

## 8. Multi-axis repository model

### Quality

Fitness and execution quality relative to the repository's applicable purpose/contract. It must eventually derive from the applicable Quality evidence vector, not from repository popularity or process-file counts.

### Impact

External interest, recognition, reuse, adoption, or ecosystem effect.

**Stars are important evidence.** They are a strong public interest/recognition signal and should materially affect Impact and later Portfolio Prominence. They are not direct implementation-quality evidence.

Forks are also important but represent reuse/modification/experimentation/contribution intent rather than one-for-one adopters. Team/course workflows may generate forks for collaboration, so fork context matters.

Other Impact signals may include dependents, downloads/installs, citations, downstream integrations, deployments, or domain-specific uptake when trustworthy data exists.

Heavy-tailed counters use bounded nonlinear normalization such as `log1p` by default. Exact Impact weights are not frozen.

Fork upstream popularity remains contextual. A fork whose own repository has zero stars does not inherit its upstream project's star count as owner Impact.

### Scale

Technical and organizational scope. Candidate evidence includes subsystem breadth, integration breadth, supported platforms, operational surface, contributor/coordination scale, and longevity. LOC, dependency count, commit count, or workflow count alone are not Scale.

### Maturity

Readiness relative to declared lifecycle and purpose. Maturity is separate from recent Activity.

### Activity

Current activity/freshness state. Inactivity can be correct for a frozen dataset, snapshot, or completed reference artifact.

### Confidence

Strength and coverage of evidence behind the assessment. Sparse evidence may produce a provisional conclusion but must not be presented as equivalent to heavily evidenced results.

### Personal Contribution

For shared, contributed, or forked repositories, the portfolio owner's demonstrated contribution and responsibility. It is never inferred from project popularity.

## 9. Collaborative and large-project semantics

Project merit and personal merit remain separate:

```text
PROJECT SIDE
  quality
  impact
  scale
  maturity/activity

PERSON SIDE
  contribution activity
  responsibility / ownership
  duration
  breadth / critical components
  review / release / maintenance role
```

A single small PR into a 100k-star repository must not inherit that repository's full personal prominence.

Conversely, a demonstrated maintainer/core contributor role in a large project can be a flagship contribution when direct evidence supports core ownership, review responsibility, release work, maintained components, sustained contributions, or similarly material responsibility.

Merged PR count, commits, reviews, issues, release involvement, maintained components, role records, active duration, accepted upstream evidence, and local fork delta are evidence features. No single count is sufficient alone.

Project Stars, project contributor counts, or upstream Stars are forbidden inputs to the Personal Contribution evidence extractor.

### Forks

Inherited upstream README/tests/CI/security/reputation are project/upstream context, not authored personal merit. Fork assessment separates:

```text
upstream/project context
local delta
personal contribution
```

### Contributed repositories

The existing IPM `relation: contributed` contract remains non-ownership. Assessment must not move external repositories into owned category membership.

## 10. Ranking is not one number

The model distinguishes:

- Quality ranking/tier;
- Impact ranking/tier;
- category-aware strongest projects;
- overall **Portfolio Prominence** used for display priority.

Portfolio Prominence may later combine Quality, Impact, Scale, Personal Contribution, Maturity, and distinctiveness/category coverage. Impact must have material influence, but project-side Impact cannot substitute for person-side Contribution.

No universal numeric weights or tier thresholds are frozen yet. Candidate formulas must be evaluated against structurally different fixtures and real portfolios first.

Avoid false precision. Tiny raw-score differences should not continuously reorder visual geometry. Prefer stable tiers such as:

```text
flagship
strong
solid
developing
experimental/reference
```

Category champions can be more useful than one global top-N because they preserve portfolio breadth.

## 11. Visualization direction

No existing visual preset is replaced by assessment work. Assessment is an overlay/mode over the existing graph.

Candidate semantic channels:

```text
node / label prominence -> portfolio prominence
quality ring/tier       -> quality
halo                    -> impact
inner arc/treatment     -> personal contribution
status/dash/opacity     -> existing relation/lifecycle/status semantics
```

A popular repository may gain a stronger halo/prominence while another repository retains a higher Quality ring.

Geometry should be tiered/quantized where continuous values would cause daily score drift to move the graph unnecessarily.

The final visual mapping requires rendered comparison before becoming production contract.

## 12. Static-first acquisition budget

Assessment must preserve IPM's static-first architecture. Normal profile/viewer traffic should consume generated assessment artifacts rather than trigger deep GitHub scans.

Use bounded acquisition levels:

```text
L0 metadata
  all eligible repositories

L1 repository structure
  manifests/basic validation evidence where needed

L2 deep assessment
  bounded featured/candidate repositories or dimensions whose evidence requires it
```

Do not deep-scan hundreds of repositories by default merely because the renderer can display them.

A likely first generated artifact remains `project-map/assessment.json`, joined to `graph.json` by stable repository identity. Coupling it directly into `graph.json` remains deferred until a measured benefit justifies it.

## 13. v1 invariants / acceptance gates

Before a production scoring formula or SVG overlay is accepted:

1. Stars/forks may raise Impact/prominence but cannot directly raise intrinsic Quality.
2. `not-applicable` mechanisms/dimensions cannot reduce Quality by being absent.
3. `external` remains an authority state, not applicability.
4. External evidence stays sourced and affects only supported dimensions/claims.
5. A frozen dataset can remain high quality with low Activity and no CI.
6. A zero-star repository can remain high Quality.
7. A highly starred repository may outrank it in Portfolio Prominence while still having lower Quality.
8. A tiny contribution to a famous project does not inherit its full personal prominence.
9. A demonstrated maintainer/core contributor role in a large project can become a flagship contribution.
10. Fork/upstream Quality and popularity are not attributed as authored personal merit without local evidence.
11. Unknown evidence is not silently converted to failure or success.
12. Cross-user primary categories remain Standard Taxonomy v1 categories.
13. Mixed artifact repositories compose modules rather than being forced into one archetype.
14. The same scoring policy must expose its component vector and evidence; an SVG or composite number cannot become the only authority.

## 14. Deferred until calibration evidence exists

Do not yet freeze:

- universal axis weights;
- exact Quality composite formula;
- exact Portfolio Prominence formula;
- tier thresholds;
- global/category percentile claims;
- star velocity without historical data;
- deep-scan scope for every repository;
- graph.json schema integration;
- production SVG appearance.

The next implementation stages are: finish Quality/Impact/Contribution evidence vectors, add Scale/Maturity context where necessary, then compare candidate prominence formulas against contract fixtures and real portfolio samples before selecting any production score or visual mapping.
