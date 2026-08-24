# Portfolio Prominence calibration v1

Status: **calibration-only / balanced-v1 is the current front-runner, not a production formula**

This phase evaluates how project merit becomes visual portfolio prominence after Quality, Impact, Scale, lifecycle, Personal Contribution, and repository-attribution boundaries have been separated.

Fixture components are synthetic normalized values, not claims about real repositories.

Relation semantics follow [`repository-relation-axes-v1.md`](repository-relation-axes-v1.md).

## Project versus personal prominence

```text
projectProminence = f(Quality, Impact, Scale, Maturity)
```

Project prominence describes the project itself.

Personal portfolio prominence is a second value. Relation axes are first reduced to an attribution profile:

```text
direct
  owned × solo × original

team
  owned × team × original

fork
  owned work with lineage = fork

contributed
  ownership = contributed

unresolved
  owned work whose collaboration/lineage is not sufficiently known
```

For `direct`, personal prominence equals project prominence.

For `team`, `fork`, and `contributed`:

```text
personalPortfolioProminence
  = projectProminence * attributionFactor(PersonalContribution)
```

For `unresolved`, personal prominence is `null` even if project prominence is available. The model does not turn repository ownership into assumed solo authorship.

## Candidate project formulas

| Candidate | Quality | Impact | Scale | Maturity |
| --- | ---: | ---: | ---: | ---: |
| `balanced-v1` | 0.35 | 0.35 | 0.15 | 0.15 |
| `quality-led-v1` | 0.45 | 0.25 | 0.15 | 0.15 |
| `impact-led-v1` | 0.30 | 0.45 | 0.10 | 0.15 |

Activity is not an input. Confidence is retained separately. Raw stars/forks/downloads/LOC do not enter directly; they must first pass through their owning evidence/normalization layers.

## Attribution calibration family

All three candidates currently use the same experimental attribution profiles:

```text
direct
  factor = 1.00

team
  factor = 0.40 + 0.60 * PersonalContribution

contributed
  factor = 0.08 + 0.92 * PersonalContribution

fork
  factor = 0.15 + 0.85 * PersonalContribution
```

These coefficients are not production truth. `unresolved` deliberately has no coefficient because scoring it would fabricate attribution.

## Synthetic calibration behavior

The existing synthetic cases continue to require:

- a popular solo project may outrank a higher-Quality zero-star project in portfolio prominence;
- the zero-star high-Quality project remains materially visible;
- a tiny contribution to a famous project retains high project prominence but low personal prominence;
- a core maintainer receives much higher personal prominence;
- a small local fork delta cannot inherit upstream reputation;
- meaningful team/research work remains eligible for strong prominence;
- missing Personal Contribution produces no personal score;
- owned work with unknown collaboration produces project prominence but no fabricated direct personal prominence.

`balanced-v1` remains the current synthetic front-runner because it gives Stars/Impact material influence without pushing zero-star high-Quality and team/research cases down as aggressively as the impact-led candidate.

That is a calibration result only.

## Evaluator invariants

1. project weights contain exactly Quality, Impact, Scale, and Maturity and sum to 1;
2. relation input is the orthogonal ownership/collaboration/lineage object;
3. only the `direct` attribution profile bypasses a Personal Contribution gate;
4. team/contributed/fork profiles remain gated;
5. unresolved relation produces no personal prominence;
6. project prominence is independent of Personal Contribution;
7. gated personal prominence is monotonic in Personal Contribution;
8. unknown Personal Contribution yields `personalPortfolioProminence = null`;
9. Confidence is retained but does not alter merit yet;
10. raw/context inputs such as Activity, stars, and LOC are rejected here;
11. no tier is assigned yet.

## Still unfrozen

Do not promote these to production contract yet:

```text
production formula
attribution coefficients
tier thresholds
confidence penalty / uncertainty display
distinctiveness/category-coverage boost
category champion policy
final node-size mapping
```

The next calibration gate is real evidence-derived component vectors from a bounded repository sample. Until those exist, using `balanced-v1` in production SVG geometry would create false precision.
