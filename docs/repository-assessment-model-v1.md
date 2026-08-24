# Repository assessment model v1

Status: **experimental contract / no production scoring formula yet**

This document defines the next assessment layer for Interactive Project Map (IPM): repository quality, impact, scale, maturity/activity, evidence confidence, and personal contribution. It is intentionally separate from the existing project-purpose taxonomy and from the current production graph/rendering contract.

The first goal is not to manufacture one universal `quality = 83` number. The first goal is to make heterogeneous repositories comparable **without rewarding irrelevant process, ignoring real external impact, or attributing a large collaborative project's full reputation to one person**.

Machine-readable policy: [`../data/repository-assessment-policy.v1.json`](../data/repository-assessment-policy.v1.json).

Contract fixtures: [`../fixtures/repository-assessment-cases.v1.json`](../fixtures/repository-assessment-cases.v1.json).

## 1. Relationship to the existing taxonomy

The existing Standard Taxonomy v1 remains authoritative for semantic project classification.

- **Primary category** answers what the project is for.
- **Artifact facets** answer what kind of artifact the repository provides.
- **Platform / ecosystem / topic facets** remain orthogonal context.
- Repository assessment must not create a second competing global archetype taxonomy.

Assessment routing therefore consumes taxonomy/facet evidence instead of replacing it.

Example:

```text
robot-driving-dataset
  category: robotics-automation
  artifact: dataset
  ecosystem: ros2
  topic: autonomous-driving

assessment modules:
  base + dataset + robotics/data-domain modifiers when justified
```

A repository may expose multiple meaningful artifacts. A research repository can legitimately combine research code, a dataset, a model, and a demo. Assessment profiles are therefore **composable modules**, not one mutually-exclusive archetype enum.

## 2. Assessment context comes before scoring

Before evaluating a repository, recover the context that controls which evidence is meaningful:

```text
purpose / primary category
artifact facets
platform / ecosystem / topic facets
lifecycle
repository relation / ownership
project scope and collaboration scale
existing external or project-owned assessments
available evidence and unknown evidence
```

Lifecycle is assessment context, not a new primary taxonomy category. Initial lifecycle vocabulary:

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

This prevents a frozen dataset or completed research snapshot from being penalized merely because it has no recent commits.

## 3. Applicability is a first-class state

Every candidate requirement/evidence mechanism must be classified before it is scored:

- `required` — absence materially undermines the repository's stated contract.
- `recommended` — normally useful in this context, but not universally required.
- `optional` — useful evidence/polish but not a quality requirement.
- `not-applicable` — irrelevant to this repository's purpose/lifecycle and excluded from scoring denominator.
- `external` — an authoritative external/project-owned evaluator already owns this dimension; ingest/reference its result rather than independently duplicating it.
- `unknown` — applicability or evidence is not established.

`not-applicable`, `external`, and `unknown` must never be silently converted to zero.

A repository does not earn bonus quality merely by having unnecessary CI, tests, releases, workflows, or process files. Conversely, the absence of those mechanisms is not a defect when the repository has no contract that needs them.

## 4. Assess outcomes, not specific mechanisms

The common assessment dimensions are outcome-oriented:

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

Mechanisms are evidence for those dimensions, not universal score rows.

For example, Verification asks:

> Is there credible evidence that the contracts that matter for this repository are checked?

Valid evidence may include CI, unit/integration tests, a local validator, schema validation, a deterministic generator check, a scientific benchmark, a dataset integrity checker, an external conformance harness, or a reviewed frozen acceptance record.

The policy may mark dimensions `not-applicable` when the dimension itself is genuinely irrelevant, but should prefer applicability at the evidence/requirement level when the broader quality outcome still matters.

## 5. Artifact-specific routing

Artifact facets select additional evidence expectations.

### Dataset

Emphasize:

- schema/metadata and field definitions;
- provenance and collection/generation/processing history;
- license and usage conditions;
- checksums/integrity evidence;
- versioning/freeze identity;
- accessibility and machine-readable loading;
- interoperability/standard formats when relevant;
- reproducible generation/curation pipeline when relevant;
- limitations, bias, privacy, responsible-use notes when relevant;
- examples/loaders/queries.

Do **not** claim intrinsic label correctness, scientific validity, or population representativeness merely from repository hygiene.

### Model

Emphasize:

- model documentation/card;
- training/evaluation provenance;
- model/weight identity and versioning;
- reproducibility where possible;
- evaluation coverage and limitations;
- intended and unsupported use;
- safety/security properties when relevant.

Repository quality and model capability are separate claims.

### Research

Emphasize:

- method clarity;
- experiment configuration;
- dataset/model/dependency provenance;
- reproducibility;
- claim-to-evidence traceability;
- negative results/limitations;
- benchmark identity and acceptance evidence where present.

A research repository may have no meaningful CI requirement.

### Library / framework

Emphasize API/docs, compatibility contracts, verification, release/versioning discipline, dependency handling, examples, migration/stability evidence, and ecosystem integration as applicable.

### Application / service / tool

Emphasize install/run path, verification, operational/release evidence, maintainability, security/safety as applicable, user-facing documentation, and service/API contracts where relevant.

### Documentation / template / configuration / snapshot

Emphasize clarity, reference correctness, provenance/version, integrity, reproducible generation when relevant, and declared lifecycle. Do not manufacture a CI/release requirement just to populate the scorecard.

These modules are routing defaults. A domain-specific canonical benchmark or contract may supersede them.

## 6. Evidence provenance and confidence

Assessment evidence retains provenance. Initial trust classes:

```text
A = independently reproducible / machine-verified external evidence
B = canonical project-owned benchmark, acceptance, release, or validation evidence
C = direct repository structure/content/metadata evidence
D = maintainer declaration / unverified self-description
U = unknown / unavailable
```

These are confidence inputs, not moral grades. A project-owned benchmark can be authoritative for a project contract while still having different independence from a reproducible external check.

External systems may own only one dimension. Examples include security scorecards, coverage systems, code-quality analyzers, benchmark suites, scientific evaluators, dataset validators, or conformance harnesses. Their results must be mapped to the dimension they actually measure; they must not replace the entire repository assessment.

Every externally ingested result should preserve source identity, version/revision where available, observation time, and claim boundary.

## 7. Multi-axis repository model

The model keeps at least these axes distinct:

### Quality

Fitness and execution quality relative to the repository's applicable purpose/contract. It is derived from applicable quality dimensions and their evidence.

### Impact

External interest, recognition, reuse, adoption, or ecosystem effect.

**Stars are important evidence.** They are a strong public interest/recognition signal and should materially affect Impact and portfolio prominence. They are not direct proof of implementation quality.

Forks are also important, but represent a different signal: reuse, modification, experimentation, and/or contribution intent. Do not simply add forks one-for-one to stars.

Other Impact signals may include contributors, dependents, downloads/installs, citations, deployments, downstream integrations, or domain-specific uptake when trustworthy data exists.

Heavy-tailed counters must not drive geometry linearly. `log1p`-class transforms are the default family for stars/forks/count-like popularity signals. Exact coefficients are deliberately not frozen in v1.

Portfolio-relative percentiles/tiers may be used for presentation. They must be labeled as **within this portfolio**, never as global percentiles. Category/artifact/age-normalized corpus comparisons require a real corpus and are deferred until such evidence exists.

Repository age matters for accumulated popularity. If historical data becomes available, total Impact and impact velocity should remain separate views; current star count alone must not be used to fabricate growth history.

### Scale

Technical and organizational scope. Candidate evidence includes subsystem breadth, integration breadth, supported platforms, operational surface, contributor/coordination scale, and longevity. LOC, dependency count, commit count, or workflow count alone are not Scale.

### Maturity

Readiness relative to the declared lifecycle and purpose: experimental, developing, stable/reference/production-ready/frozen, etc. Maturity is not the same as recent Activity.

### Activity

Current activity/freshness state. It is displayed separately because inactivity can be correct for a frozen dataset, snapshot, or completed reference artifact.

### Confidence

Strength and coverage of evidence behind the assessment. Sparse evidence can produce a provisional high Quality result with low confidence; the UI must not present that as equivalent to a heavily evidenced high result.

### Personal contribution

For shared, contributed, or forked repositories, the portfolio owner/person's demonstrated contribution and responsibility. It is not inferred from project popularity.

## 8. Collaborative and large-project semantics

Project merit and personal merit are separate:

```text
PROJECT SIDE
  quality
  impact
  scale
  maturity/activity

PERSON SIDE
  personal contribution
  responsibility / ownership
  duration
  breadth / critical components
  review / release / maintenance role
```

A single typo PR into a 100k-star repository must not inherit that repository's full portfolio prominence for the contributor.

A long-term maintainer of a large collaborative project **should** receive substantial personal portfolio credit when direct evidence supports core ownership, review responsibility, release work, maintained components, sustained contributions, or similarly material responsibility.

Useful contribution evidence includes merged PRs, commits, reviews, issues, release involvement, maintained components, role/ownership records, active duration, and accepted upstream evidence. Commit count and LOC are insufficient by themselves.

### Forks

Inherited upstream README/tests/CI/security/reputation are project/upstream evidence, not authored personal merit. Fork assessment separates:

```text
upstream/project merit
local delta
personal contribution
```

### Contributed repositories

The existing IPM `relation: contributed` contract remains non-ownership. Assessment must not move external repositories into owned category membership. Project-side merit can still be displayed alongside person-side contribution evidence.

## 9. Ranking is not one number

The model distinguishes:

- Quality ranking/tier;
- Impact ranking/tier;
- category-aware strongest projects;
- overall **portfolio prominence** used for display priority.

Portfolio prominence may combine Quality, Impact, Scale, Personal Contribution, Maturity, and distinctiveness/category coverage. Impact must have material influence; a repository with thousands of stars should not be visually treated like an otherwise identical zero-star repository.

However, v1 intentionally freezes **no universal numeric weights**. Those weights must be selected only after fixture-based evaluation on structurally different portfolios.

Avoid false precision. Tiny raw-score differences should not produce visibly unstable `#1/#2` swaps. Prefer stable display tiers such as:

```text
flagship
strong
solid
developing
experimental/reference
```

Category champions/flagships may be more informative than one global top-N because they preserve portfolio breadth.

## 10. Visualization contract direction

No existing visual preset is replaced by this work. Assessment is an overlay/mode over the existing graph.

Candidate semantic channels:

```text
node / label prominence -> portfolio prominence
quality ring/tier       -> quality
halo                    -> impact
inner arc/treatment     -> personal contribution
status/dash/opacity     -> existing relation/lifecycle/status semantics
```

A popular repository may therefore gain a stronger halo/prominence while another repository retains a higher Quality ring.

Geometry should be tiered/quantized where continuous values would cause small daily score changes to reorder or move the graph unnecessarily.

The final visual mapping requires rendered comparison before it becomes production contract.

## 11. Static-first and acquisition budget

Quality analysis must preserve IPM's static-first architecture. Normal profile/viewer traffic should consume generated assessment artifacts rather than trigger a deep GitHub scan.

Use bounded acquisition levels:

```text
L0 metadata
  all eligible repositories

L1 repository structure
  repository files/manifests/basic validation evidence where needed

L2 deep assessment
  bounded featured/candidate repositories or dimensions whose evidence requires it
```

Do not deep-scan 300 repositories by default merely because the renderer supports 300 repositories.

The eventual generated contract should remain separate from `graph.json` initially unless a measured integration benefit justifies coupling. A likely first artifact is `project-map/assessment.json`, joined with `graph.json` by stable repository identity.

## 12. v1 invariants / acceptance gates

Before any production scoring formula or SVG overlay is merged, the implementation must satisfy the contract fixtures and these invariants:

1. Adding stars/forks may raise Impact/prominence but cannot directly raise intrinsic Quality.
2. `not-applicable` CI/tests/activity cannot reduce Quality merely by being absent.
3. External authoritative assessment remains visibly sourced and affects only supported dimensions/claims.
4. A frozen dataset can remain high quality with low Activity.
5. A zero-star repository can remain high Quality.
6. A highly starred repository can outrank that repository in **portfolio prominence** while still having lower Quality.
7. One tiny contribution to a famous large project does not inherit its full personal prominence.
8. A demonstrated maintainer/core contributor role in a large project can become a flagship contribution.
9. Forked/upstream quality and popularity are not attributed as authored personal merit without local contribution evidence.
10. Unknown evidence is not silently converted to failure or success.
11. Cross-user primary categories remain the Standard Taxonomy v1 categories; assessment routing does not invent per-user global category meanings.
12. The same scoring policy must explain its component vector and evidence; an SVG or composite number cannot become the only authority.

## 13. Deferred until the contract passes fixtures

Do not yet freeze:

- universal axis weights;
- exact Quality composite formula;
- exact portfolio prominence formula;
- tier thresholds;
- global/category percentile claims;
- star-velocity history without actual historical data;
- deep-scan scope for every repository;
- graph.json schema integration;
- production SVG appearance.

The next implementation phase is a deterministic assessment-policy evaluator against the checked-in fixtures, followed by real-portfolio calibration. Only after that should generated `assessment.json` and visual overlays be added.