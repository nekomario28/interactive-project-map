# Repository personal-contribution calibration v1

Status: **experimental evidence-vector calibration / no Personal Contribution score yet**

This document defines the person-side evidence boundary for large team projects, externally owned contributed repositories, and forks. It complements [`repository-impact-calibration-v1.md`](repository-impact-calibration-v1.md): project reputation remains project-side evidence, while the assessed person's role is represented independently.

## Core separation

Never compute personal contribution from project popularity or size:

```text
PROJECT SIDE
  stars / forks / adoption
  project quality
  project scale
  contributor population

PERSON SIDE
  accepted changes
  review participation
  maintained components
  maintainer / ownership role
  release responsibility
  sustained duration
  other direct responsibility evidence
```

A 100k-star project can have very high project Impact while a particular person's Personal Contribution remains unknown, small, medium, or large depending on direct evidence.

## Counts are evidence, not merit by themselves

The extractor preserves counts such as merged PRs, commits, reviews, issues, and active duration, but does not turn them into a scalar score.

Important counterexamples:

- one PR can be a typo or a major subsystem;
- hundreds of commits can be mechanical/generated churn;
- a small number of architectural changes can carry high responsibility;
- review/release/component ownership can matter more than raw authored LOC;
- long duration without material responsibility is not automatically high contribution.

Therefore `mergedPullRequests=42` is an observation, not `Contribution=72`.

## Responsibility evidence

Responsibility-oriented evidence is preserved separately from activity volume:

```text
maintainer role
release involvement
maintained/core component ownership
```

Additional repository-specific authority may be added later if it has a stable, auditable source.

Review participation is kept as an activity/collaboration signal; review count alone does not prove maintainer authority.

## Relation semantics

### `owned-solo`

If the relation itself has been established from trustworthy evidence, person-side attribution can be direct. Namespace ownership alone is not enough to assign this relation.

### `owned-team`

Project ownership does not mean one person authored the whole project. Person-side prominence requires contribution/responsibility evidence when the UI makes claims about the individual.

### `owned-fork`

Only the local delta and direct fork work can support personal contribution. Upstream project activity/reputation remains outside the person-side extractor.

### `contributed`

The externally owned project's Impact/Quality/Scale may be visible as project context, but portfolio attribution requires a Personal Contribution gate.

## Missing evidence

Each evidence channel distinguishes `observed` from `unknown`. Missing reviews, release role, or maintained-component evidence must not be silently converted to false unless the source actually establishes false.

Boolean responsibility fields therefore use:

```text
observed true
observed false
unknown
```

This prevents a limited API query from asserting that someone is not a maintainer merely because maintainer evidence was not fetched.

## No project-side leakage

The person-side extractor rejects project-wide popularity/scale inputs such as project stars, project forks, project contributor count, project Impact, project Quality, or project Scale. Those belong in the project-side vector and are joined only at later portfolio-prominence calibration.

This is deliberately strict: it makes accidental reputation inheritance a detectable contract violation rather than a subtle weighting bug.

## Output direction

The output is an inspectable vector:

```text
activity
  merged PRs
  commits
  reviews
  issues
  active duration

responsibility
  maintainer role
  release involvement
  maintained core/component responsibility

local delta
  required/unknown/observed for forks

attribution
  relation-specific contribution gate requirements

compositePersonalContribution
  null in this phase
```

## Acceptance invariants

1. Project stars/forks/contributor population cannot enter the person-side extractor.
2. One merged PR alone does not determine contribution magnitude.
3. Maintainer/release/core-component evidence is preserved separately from activity counts.
4. Missing role evidence remains unknown rather than false.
5. `contributed` and `owned-team` require person-side evidence before individual attribution.
6. `owned-fork` requires local-delta evidence for personal attribution.
7. `owned-solo` direct attribution depends on the relation having already been established, not GitHub namespace ownership alone.
8. No scalar Personal Contribution score or prominence weight is frozen in this phase.
