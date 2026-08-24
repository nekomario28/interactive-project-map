# Repository Quality aggregation experiment v1

Status: **experimental candidate comparison / no production composite score / no ranking**

The repository Quality evidence contract now has real calibration across application, library/fork, and dataset artifact routes. That is enough to test aggregation failure modes, but not enough to freeze arbitrary universal weights.

This experiment compares two candidate families without changing production Quality semantics.

## Non-goals

This experiment does not introduce:

- a production `Quality 0-100` score;
- ranking weights;
- tier thresholds;
- Portfolio Prominence;
- renderer or graph-schema output;
- a confidence threshold;
- Impact, Activity, Scale, Maturity, or Personal Contribution into intrinsic Quality.

`compositeQualityScore` remains `null`.

## Candidate A — component/Pareto view

Keep the finding for every applicable target dimension:

```text
supports
neutral
weakens
mixed
unknown
```

For a bounded pairwise comparison with the same target-dimension set, compare only dimensions where both repositories have a pure known finding:

```text
supports > neutral > weakens
```

Possible experimental relations are:

```text
left-dominates-on-common-known
right-dominates-on-common-known
equal-on-common-known
tradeoff-on-common-known
incomparable-no-common-known
incomparable-target-set
```

The phrase `on-common-known` is part of the claim boundary. Unknown or mixed dimensions are omitted from that bounded comparison, not converted to zero.

This candidate is useful for explaining clear local dominance while retaining the source vector. It is not yet a production ranking because omitted unknown dimensions may still change the conclusion.

Repositories with different artifact target sets are deliberately not flattened into a single Pareto order. An application and a dataset can have different relevant contracts.

## Candidate B — unweighted directional balance

For pure known target findings only:

```text
supports  = +1
neutral   =  0
weakens   = -1
```

Then compute:

```text
netDirection
  = sum(pure known direction values)

directionalBalance
  = netDirection / pureDirectionalDimensions
```

Unknown and mixed dimensions are excluded from this diagnostic number. Their absence is preserved separately through:

```text
pureDirectionalCoverageRatio
confidenceDirectionalCoverageRatio
mixedDimensionIds
unknownDimensionIds
```

### Why it is diagnostic only

A perfect directional balance can mean very different things:

```text
4 supports / 6 target dimensions  -> balance 1.0, coverage 4/6
3 supports / 6 target dimensions  -> balance 1.0, coverage 3/6
4 supports / 5 target dimensions  -> balance 1.0, coverage 4/5
1 support  / 6 target dimensions  -> balance 1.0, coverage 1/6
```

Therefore `1.0` is not a self-sufficient Quality rank. Using it alone would let very thin evidence look identical to broader evidence.

Coverage must remain separate rather than being multiplied into Quality, because multiplying it in would make missing evidence act like a Quality penalty and would conflate Confidence with merit.

## Mixed evidence is not neutral

A dimension can contain both supporting and weakening evidence. The Quality evidence vector reports that as:

```text
findingState = mixed
```

The balance candidate does not map `mixed` to zero. Zero means a pure `neutral` finding; contradictory or mixed evidence has a different epistemic meaning.

Mixed dimensions remain explicit and are excluded from the scalar diagnostic until a future conflict-resolution contract exists.

## Real-fixture behavior

### Application cases

The frozen application calibration makes the bounded Pareto behavior useful:

- `interactive-project-map` dominates `ProjExD_Group10` on their common known Quality dimensions because Stewardship is supporting in the former and weakening in the latter while their other common known findings are not worse.
- `ProjExD_Group10` dominates `c0c25034/ProjExD_4` on common known dimensions because the latter has direct weakening evidence for Understandability and Reproducibility as well as Stewardship.

These remain bounded comparisons, not total repository rankings.

### Library/fork cases

`gz-sim` and `turing-smart-screen-python-owl` have the same frozen project-side Quality findings in the library calibration and therefore compare equal on common known Quality dimensions.

Their Personal Contribution evidence differs (`observed + absent` vs `observed + present` local default-branch delta), but that is intentionally outside intrinsic project Quality aggregation.

### Dataset case

The external dataset donor has a different target set from application/library routes. The candidate comparator therefore returns `incomparable-target-set` rather than pretending one universal mechanism list applies to both.

## Why target-normalized missing-as-zero was rejected

A tempting formula is:

```text
(supports - weakens) / all target dimensions
```

When unknown dimensions are included in the denominator without a finding contribution, missing evidence behaves numerically like zero. That violates the established contract:

```text
UNKNOWN != failure
UNKNOWN != neutral
Confidence != Quality
```

This family is therefore not implemented as a candidate.

## Current decision

The only production-safe aggregation remains:

```text
component-vector
```

The two experimental candidates are useful diagnostics:

- bounded Pareto for explaining common-known dominance/tradeoff;
- directional balance for studying the effect of supports/weakens without weights.

Both explicitly return:

```text
productionRankingAllowed = false
```

and the experiment returns:

```text
compositeQualityScore = null
recommendedProductionAggregation = component-vector
```

## Next calibration gate

Before considering a scalar or tier:

1. add at least one real case with `mixed` evidence or a controlled conflict receipt;
2. test candidate behavior under applicability overrides and N/A dimensions;
3. decide whether cross-artifact ranking is actually a product requirement or whether Portfolio Prominence can work from multi-axis features without one universal Quality scalar;
4. test visual encodings that display Quality findings/tier evidence and Confidence coverage separately;
5. if a scalar is still desired, evaluate it against the frozen counterexamples and publish its failure modes before assigning weights.

If those experiments continue to show that scalarization mainly hides uncertainty or artifact-specific semantics, keep intrinsic Quality vector-valued and rank portfolio presentation through a separate calibrated Prominence model.