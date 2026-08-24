# Repository personal-contribution calibration v1

Status: **experimental evidence-vector calibration / no Personal Contribution score yet**

This document defines the person-side evidence boundary for team projects, externally owned contributed repositories, forks, and repositories whose collaboration state is not yet known. Project reputation remains project-side evidence while the assessed person's role is represented independently.

Relation semantics follow [`repository-relation-axes-v1.md`](repository-relation-axes-v1.md).

## Core separation

Never compute personal contribution from project popularity or size:

```text
PROJECT SIDE
  stars / forks / adoption
  project Quality
  project Scale
  contributor population

PERSON SIDE
  accepted changes
  review participation
  maintained components
  maintainer responsibility
  release responsibility
  sustained duration
  local delta for forks
```

A 100k-star project can have very high project Impact while a particular person's Personal Contribution remains unknown, small, or substantial depending on direct evidence.

## Counts are evidence, not merit by themselves

Merged PRs, commits, reviews, issues, and active duration are retained as observations. They do not directly become a contribution score.

Counterexamples:

- one PR can be a typo or a major subsystem;
- many commits can be mechanical/generated churn;
- a few architectural changes can carry high responsibility;
- review/release/component ownership can matter more than LOC;
- duration without material responsibility is not automatically high contribution.

`mergedPullRequests = 42` is evidence, not `Contribution = 72`.

## Responsibility evidence

Keep responsibility signals separate from activity volume:

```text
maintainer role
release involvement
maintained/core component responsibility
```

Missing boolean evidence remains `unknown` rather than silently becoming false.

## Orthogonal relation semantics

### Direct personal project

Direct attribution is permitted only for a fully established:

```text
ownership = owned
collaboration = solo
lineage = original
```

Namespace ownership alone does not prove `solo`.

### Team project

```text
ownership = owned
collaboration = team
lineage = original
```

Project merit remains project-side. Individual prominence requires person-side contribution/responsibility evidence.

### Fork lineage

```text
lineage = fork
```

Only local delta and direct work can support authored personal merit. Upstream project Quality/Impact/Scale remain context-only. Fork lineage can coexist with unknown/solo/team collaboration; it is not an ownership state.

### Contributed ownership relation

```text
ownership = contributed
```

Externally owned project Quality/Impact/Scale may be shown as project context, but personal portfolio attribution is gated by Personal Contribution. The external project's collaboration can remain unknown without weakening this boundary.

### Unresolved owned collaboration

```text
ownership = owned
collaboration = unknown
lineage = original
```

This is the normal safe L0 state when graph metadata proves ownership but not solo/team authorship. It must **not** be treated as direct solo work. Project-side assessment may continue; personal prominence remains unresolved.

## No project-side leakage

The person-side extractor rejects project-wide values such as:

```text
project stars
project forks
project contributor count
project Quality
project Impact
project Scale
```

Those are joined only later by prominence calibration. This makes accidental reputation inheritance a visible contract error.

## Output direction

```text
relation
  ownership / collaboration / lineage

activity
  merged PRs
  commits
  reviews
  issues
  active duration

responsibility
  maintainer role
  release involvement
  maintained component responsibility

local delta
  unknown/observed for fork lineage

attribution profile
  direct | team | fork | contributed | unresolved

compositePersonalContribution
  null in this phase
```

## Acceptance invariants

1. Project reputation/Scale cannot enter the person-side extractor.
2. One merged PR alone does not determine contribution magnitude.
3. Responsibility evidence remains distinct from activity counts.
4. Missing role evidence remains unknown rather than false.
5. `ownership=contributed` requires person-side evidence before personal prominence.
6. `collaboration=team` requires person-side evidence before personal prominence.
7. `lineage=fork` requires local-delta attribution rather than upstream inheritance.
8. Only `owned × solo × original` permits direct attribution.
9. `owned × unknown × original` never silently becomes solo.
10. No scalar Personal Contribution score is frozen in this phase.
