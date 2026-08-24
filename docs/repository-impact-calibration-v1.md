# Repository impact calibration v1

Status: **experimental evidence-vector calibration / no composite Impact score yet**

This document narrows the `Impact` axis defined by [`repository-assessment-model-v1.md`](repository-assessment-model-v1.md). The goal is to preserve the importance of stars, forks, large collaborative projects, and downstream adoption without turning one popularity counter into repository Quality or personal merit.

Repository attribution follows [`repository-relation-axes-v1.md`](repository-relation-axes-v1.md): ownership, collaboration, and lineage are separate axes.

## Calibration evidence

Observed public snapshots on 2026-08-24 were frozen as calibration fixtures:

| Repository | Lineage | Repo stars | Repo forks | Upstream stars | Upstream forks | Lesson |
|---|---|---:|---:|---:|---:|---|
| `nekomario28/interactive-project-map` | original | 1 | 0 | — | — | Low recognition does not invalidate strong Quality evidence. |
| `nekomario28/ProjExD_Group10` | original | 1 | 5 | — | — | Fork count is reuse/derivative interest, not five proven adopters. |
| `nekomario28/gz-sim` | fork | 0 | 0 | 1461 | 458 | Upstream reputation is context, not local Impact. |
| `nekomario28/turing-smart-screen-python-owl` | fork | 0 | 0 | 2227 | 404 | The same upstream/local separation applies even to highly visible upstreams. |

These are frozen evidence snapshots, not live-count assertions.

## Impact is a vector first

```text
recognition
  stars

reuse / derivative interest
  forks

adoption
  dependents
  downloads / installs
  deployments when trustworthy

research / domain uptake
  citations or domain-specific uptake

collaboration / coordination context
  contributors

upstream context
  source stars/forks when lineage = fork
```

The vector remains inspectable even if a later scalar Impact score is introduced.

## Stars

Rules:

1. stars materially influence Impact and later portfolio prominence;
2. stars do not directly modify intrinsic Quality;
3. heavy-tailed counts use a nonlinear transform family such as `log1p`;
4. observed zero is not missing evidence;
5. missing observations remain unknown;
6. one current total does not prove growth velocity.

## Fork count

A repository's `forks_count` is named **reuse/derivative interest** because forks can represent reuse, modification, contribution workflow, experimentation, classroom/team work, derivatives, or abandoned copies.

Do not label the raw count `adopters` without stronger downstream evidence.

## Fork lineage and upstream context

`fork` is represented by:

```text
relation.lineage = fork
```

not by a compound ownership relation.

Keep local and upstream views separate:

```text
LOCAL REPOSITORY
  local stars
  local forks
  local delta
  personal contribution

UPSTREAM CONTEXT
  upstream stars
  upstream forks
  separately assessed upstream Quality / Scale
```

Upstream reputation may explain the importance of the surrounding project but cannot be copied into local Impact or authored personal merit.

The extractor rejects a duplicate `fork` boolean once lineage is present so the relation has one authority.

## Contributed ownership

For externally owned work:

```text
relation.ownership = contributed
```

Project-side Impact remains visible regardless of whether project collaboration is known. Personal portfolio credit remains separately gated by Personal Contribution.

This means a 100k-star project can correctly have very high project Impact while a one-line personal change receives very little personal prominence.

## Collaboration context

Contributor count can support project collaboration/coordination context and Scale. It does not identify how much the portfolio owner contributed.

`contributors = 300` plus one tiny personal change is different from a maintainer role backed by reviews, release work, maintained components, and sustained activity.

## Missing versus zero

The Impact vector distinguishes:

```text
observed zero
unknown / not acquired
not applicable where meaningful
```

Missing dependents/downloads/citations must not become numeric zero merely because IPM does not acquire them at L0.

## Absolute versus portfolio-relative presentation

Keep both concepts available:

```text
absolute transformed evidence
  log1p(stars), log1p(forks), ...

portfolio-relative position
  rank / percentile / tier within this portfolio
```

A local percentile is never a global percentile. Pure local ranking also cannot make one star look globally equivalent to thousands of stars.

## Deferred scalar decisions

This phase does not freeze:

- star-vs-fork weights;
- saturation points;
- contributor/adoption/citation weights;
- global percentile mappings;
- absolute-versus-local blends;
- final halo geometry.

## Acceptance invariants

1. `stars=0` is distinguishable from unknown stars.
2. More observed stars increase transformed recognition with nonlinear compression.
3. Fork count increases reuse/derivative-interest evidence, not literal adopter count.
4. Missing adoption/citation evidence remains unknown.
5. `relation.lineage = fork` keeps upstream popularity in `upstreamContext` only.
6. Ownership/collaboration/lineage remain independently inspectable.
7. `relation.ownership = contributed` requires a Personal Contribution gate for personal prominence.
8. Unknown owned collaboration never silently becomes solo attribution.
9. No Impact channel directly changes Quality.
10. The extractor does not freeze a scalar Impact or production prominence formula.
