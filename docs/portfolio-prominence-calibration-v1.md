# Portfolio Prominence calibration v1

Status: **calibration-only / balanced-v1 is the current front-runner, not a production formula**

This phase evaluates how repository/project merit should become visual portfolio prominence after the Quality, Impact, Scale, lifecycle, and Personal Contribution evidence boundaries have been separated.

The fixture values in this phase are **synthetic normalized components**, not claims about real repositories.

## Two different prominence values

One score is not sufficient for collaborative portfolios.

### Project prominence

```text
projectProminence = f(Quality, Impact, Scale, Maturity)
```

This answers how strong/important the project itself appears within the portfolio context.

### Personal portfolio prominence

For solo-owned work, personal prominence currently equals project prominence.

For team, contributed, and forked work, project prominence is retained but personal display prominence is contribution-gated:

```text
personalPortfolioProminence = projectProminence * attributionFactor(PersonalContribution)
```

This allows a famous external project to remain visibly important while preventing one tiny contribution from inheriting the project's full personal credit.

When Personal Contribution is unknown for a gated relation, project prominence may still be shown but personal prominence remains `null`; it is not guessed.

## Candidate formulas

Three project-side candidates are currently compared:

| Candidate | Quality | Impact | Scale | Maturity |
| --- | ---: | ---: | ---: | ---: |
| `balanced-v1` | 0.35 | 0.35 | 0.15 | 0.15 |
| `quality-led-v1` | 0.45 | 0.25 | 0.15 | 0.15 |
| `impact-led-v1` | 0.30 | 0.45 | 0.10 | 0.15 |

Activity is not an input. Confidence is preserved separately and currently does not alter merit. Raw stars/forks/downloads/LOC/etc. do not enter this formula directly; they must first pass through their owning evidence/normalization layer.

## Contribution attribution candidates

The current calibration uses one shared attribution family across all three project formulas:

```text
owned-solo
  direct = 1.00

owned-team
  factor = 0.40 + 0.60 * PersonalContribution

contributed
  factor = 0.08 + 0.92 * PersonalContribution

owned-fork
  factor = 0.15 + 0.85 * PersonalContribution
```

These coefficients are also calibration parameters, not production truth. They exist to test whether the two-level project/person model behaves sensibly.

## Synthetic calibration results

The table below shows `project / personal` prominence. `—` means personal prominence is intentionally not fabricated because contribution is unknown.

| Synthetic case | balanced-v1 | quality-led-v1 | impact-led-v1 |
| --- | ---: | ---: | ---: |
| high-quality zero-star solo | 0.538 / 0.538 | 0.628 / 0.628 | 0.478 / 0.478 |
| popular solo, somewhat lower Quality | 0.823 / 0.823 | 0.808 / 0.808 | 0.850 / 0.850 |
| famous project, tiny contribution | 0.975 / 0.123 | 0.970 / 0.122 | 0.978 / 0.123 |
| large project, core maintainer | 0.932 / 0.846 | 0.929 / 0.844 | 0.934 / 0.848 |
| fork, small local delta | 0.322 / 0.076 | 0.380 / 0.089 | 0.287 / 0.067 |
| meaningful team project | 0.553 / 0.487 | 0.611 / 0.538 | 0.502 / 0.441 |
| research + dataset + model team | 0.638 / 0.542 | 0.698 / 0.593 | 0.595 / 0.506 |
| shared project, contribution unknown | 0.900 / — | 0.900 / — | 0.900 / — |

All three candidates satisfy the central counterexamples in this synthetic set:

- a highly popular solo project can outrank a zero-star project in portfolio prominence even when its intrinsic Quality component is lower;
- the zero-star high-Quality project remains meaningful rather than disappearing;
- a tiny contribution to a famous project retains high project prominence but low personal prominence;
- a demonstrated core maintainer receives much higher personal prominence;
- unknown contribution never becomes a fabricated personal score.

## Why balanced-v1 is the current front-runner

`quality-led-v1` preserves zero-star high-Quality work strongly, but reduces the separation created by a very strong external-impact signal. In the synthetic pair above the popular project's lead over the higher-Quality zero-star project is about `0.18`.

`impact-led-v1` makes popularity extremely visible, but pushes the zero-star high-Quality project and meaningful team/research projects down more aggressively. The same solo-project lead grows to about `0.373`.

`balanced-v1` sits between them at about `0.285` while still preserving substantial prominence for the high-Quality zero-star repository. It therefore best matches the current design requirement that **Stars/Impact matter materially without becoming Quality or overwhelming all other project merit**.

This is only enough to name a **calibration front-runner**. It is not enough to freeze production weights.

## Invariants enforced by the evaluator

The calibration evaluator requires:

1. project weights contain exactly Quality, Impact, Scale, and Maturity and sum to 1;
2. solo-owned work remains direct in this calibration;
3. team/contributed/fork work remains contribution-gated;
4. project prominence does not change when only Personal Contribution changes;
5. personal prominence is monotonic with Personal Contribution for gated relations;
6. unknown Personal Contribution yields `personalPortfolioProminence = null`;
7. Confidence is preserved but not weighted into merit yet;
8. raw/context inputs such as Activity, stars, or LOC are rejected at this layer;
9. no tier is assigned yet.

## What remains unfrozen

Do not yet promote any of these into production contract:

```text
production formula
relation attribution coefficients
tier thresholds
confidence penalty / uncertainty display
distinctiveness/category-coverage boost
category champion policy
final node-size mapping
```

The next useful step is to define the generated `assessment.json` boundary and run the candidate formulas against **real evidence-derived component vectors** for a bounded set of structurally different repositories. Until those vectors exist, using the synthetic front-runner in production SVG geometry would create false precision.
