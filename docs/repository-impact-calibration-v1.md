# Repository impact calibration v1

Status: **experimental evidence-vector calibration / no composite Impact score yet**

This document narrows the `Impact` axis defined by [`repository-assessment-model-v1.md`](repository-assessment-model-v1.md). The goal is to preserve the importance of stars, forks, large collaborative projects, and downstream adoption without turning one popularity counter into repository Quality or personal merit.

## Why this calibration step exists

The first repository-assessment contract intentionally leaves numeric weights unfrozen. Real repository metadata immediately shows why.

Observed public snapshots on 2026-08-24:

| Repository | Relation | Repo stars | Repo forks | Upstream stars | Upstream forks | Calibration lesson |
|---|---|---:|---:|---:|---:|---|
| `nekomario28/interactive-project-map` | original | 1 | 0 | — | — | Low public recognition does not invalidate strong repository-quality evidence. |
| `nekomario28/ProjExD_Group10` | original | 1 | 5 | — | — | A fork count is a derivative/reuse/collaboration signal, not five proven independent adopters. |
| `nekomario28/gz-sim` | fork | 0 | 0 | 1461 | 458 | Large upstream reputation is useful project context but is not the fork owner's local Impact. |
| `nekomario28/turing-smart-screen-python-owl` | fork | 0 | 0 | 2227 | 404 | The same upstream/local separation is required even when inherited project quality is substantial. |

These are calibration snapshots, not live assertions. Their purpose is to freeze the semantic counterexamples that a later scoring formula must continue to satisfy.

## Impact is an evidence vector first

Do not start from:

```text
impact = stars + forks + contributors
```

Use separate evidence channels:

```text
recognition
  stars

reuse / derivative interest
  forks

adoption
  dependents
  downloads / installs
  deployments or domain-specific consumption when trustworthy

research / domain uptake
  citations or equivalent domain evidence when relevant

collaboration / coordination context
  contributors

upstream context
  parent/source stars and forks for a fork
```

A later composite Impact score may combine compatible channels, but the vector remains the inspectable authority.

## Stars

Stars are the strongest generally available GitHub-native public recognition signal in the current IPM metadata budget.

Rules:

1. stars materially influence `Impact` and eventually `portfolioProminence`;
2. stars do not directly modify intrinsic `Quality`;
3. star counts are heavy-tailed and use a nonlinear transform family such as `log1p` before any composition or geometry;
4. zero stars is an observed value, not missing evidence;
5. a missing star observation is `unknown`, not zero;
6. current total stars do not prove historical growth velocity.

## Forks

Fork count is important but semantically broader than adoption.

A fork can represent:

- reuse or modification;
- contribution workflow;
- experimentation;
- classroom/team collaboration;
- a derivative project;
- an abandoned copy.

Therefore a GitHub `forks_count` observation is named **reuse/derivative interest**, not `adopters`.

A later assessment may strengthen the interpretation when downstream activity, dependents, releases, package use, accepted contributions, or other evidence disambiguates it. The baseline extractor must not make that stronger claim.

## Upstream reputation for forks

For a fork, maintain two different views:

```text
LOCAL FORK / REPOSITORY
  local stars
  local forks
  local delta / personal contribution

UPSTREAM CONTEXT
  upstream stars
  upstream forks
  upstream project quality / scale when separately assessed
```

Upstream reputation can explain that a contribution occurred in an important project, but it cannot be copied into the fork owner's local Impact or Quality.

For an externally owned `relation: contributed` repository, repository Impact is project-side context. Portfolio attribution must still be gated by `Personal Contribution` rather than granting the contributor the whole project's reputation.

## Contributors

Contributor count is primarily collaboration/coordination evidence and may also support project Scale or community Impact. It is not a direct measure of the assessed person's contribution.

`contributors = 300` plus one tiny personal change must remain different from a maintainer role with review/release/component ownership evidence.

## Missing vs zero

The Impact vector distinguishes:

```text
observed: 0
unknown / not acquired
not applicable
```

This matters especially for dependents/downloads/citations because IPM does not currently acquire all of them for every repository. A missing endpoint/query must not make a project look like it has zero adoption.

## Absolute vs portfolio-relative presentation

Pure portfolio-relative normalization is not sufficient. If the largest project in a portfolio has one star, it should not receive the same absolute halo as a genuinely high-impact project merely because it ranks first locally.

Likewise, pure absolute normalization loses useful within-portfolio ordering for low-impact or early portfolios.

Keep two concepts separate:

```text
absolute transformed evidence
  e.g. log1p(stars), log1p(forks)

portfolio-relative position
  rank / percentile / tier within the current portfolio
```

Do not merge them until corpus calibration establishes an interpretable mapping. A local percentile must be labeled local.

## No scalar Impact formula in this phase

This phase intentionally does not freeze:

- star-vs-fork weights;
- an absolute saturation point;
- contributor weight;
- adoption/citation weights;
- a global percentile mapping;
- a portfolio-relative/absolute blend;
- a final halo radius formula.

The deterministic implementation only extracts the evidence vector and preserves attribution boundaries. The next calibration phase can compare candidate scalar mappings against multiple real portfolios without re-fetching the semantic rules from chat.

## Acceptance invariants

1. `stars=0` is distinguishable from unknown stars.
2. More observed stars produce a larger transformed recognition signal, with nonlinear compression.
3. More observed forks produce a larger reuse/derivative-interest signal, not a literal adopter count.
4. Missing dependents/downloads/citations remain unknown.
5. Fork upstream stars/forks appear only in `upstreamContext` and never in the local repository signals.
6. `owned-fork` attribution is local-fork-only; inherited upstream reputation is context.
7. `contributed` attribution requires a separate Personal Contribution gate.
8. No Impact evidence channel directly changes Quality.
9. No scalar Impact or portfolio-prominence weights are introduced by the extractor.
