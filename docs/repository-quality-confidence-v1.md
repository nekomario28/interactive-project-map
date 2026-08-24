# Repository Quality Confidence v1

Status: **experimental coverage vector / no composite Confidence score**

Quality findings must not be treated as equally certain when one repository has broad inspected evidence and another has only one observed claim. This layer therefore summarizes evidence coverage without inventing confidence weights or thresholds.

## Inputs

`buildQualityConfidenceVector()` consumes:

1. the repository assessment policy; and
2. a `buildQualityEvidenceVector()` result.

It does not inspect GitHub directly and does not bypass the Quality evidence contract.

## Target dimensions

Confidence coverage is measured against Quality outcomes whose applicability is currently:

```text
required
recommended
```

Optional evidence remains visible in the per-dimension record but does not inflate core coverage.

For the current `application` module this yields six target outcomes:

```text
understandability
verification
reproducibility
maintainability
security-safety
stewardship
```

## Two separate coverage ratios

### Inspected coverage

A target dimension is `inspected` when it contains evidence whose state is one of:

```text
observed
absent
stale
conflicting
```

This means the evaluator actually has a result or inspected absence to reason about. It does not mean that the result is favorable.

### Directional coverage

A target dimension is `directional` when its finding summary is not `unknown`.

Therefore:

```text
observed + finding unknown
  inspected   = true
  directional = false
```

This prevents mere evidence collection from masquerading as interpreted Quality knowledge.

The vector reports:

```text
inspectedCoverageRatio
  = inspected target dimensions / target dimensions

directionalCoverageRatio
  = directionally interpreted target dimensions / target dimensions
```

No tier labels such as high/medium/low are assigned yet.

## Evidence provenance remains visible

The vector also preserves counts for evidence classes:

```text
A  independently reproducible / machine-verified external
B  canonical project-owned validation / benchmark / acceptance
C  direct repository structure / content / metadata
D  declaration / unverified self-description
U  unknown
```

and assessment authority counts such as:

```text
repository-native
project-owned
external
mixed
unknown
```

These distributions are not silently converted into weights.

## Real calibration snapshot

For the frozen three-application calibration:

```text
interactive-project-map
  target dimensions       6
  inspected               4
  directional             4
  coverage                4/6
  evidence classes        B:1 C:3

ProjExD_Group10
  target dimensions       6
  inspected               3
  directional             3
  coverage                3/6

c0c25034/ProjExD_4
  target dimensions       6
  inspected               3
  directional             3
  coverage                3/6
```

This does **not** mean the latter two repositories have equal Quality. Confidence coverage measures how much relevant evidence has been inspected/interpreted, while finding direction records what that evidence says.

## Output contract

The output contains:

```text
schemaVersion
targetApplicability
coverage
  targetDimensions
  inspectedDimensions
  directionalDimensions
  unresolvedInspectionDimensions
  unresolvedDirectionDimensions
  conflictingDimensions
  staleDimensions
  inspectedCoverageRatio
  directionalCoverageRatio
targetDimensionIds
dimensionCoverage
evidenceClassCounts
authorityCounts
compositeConfidenceScore = null
```

## Acceptance boundaries

1. Confidence coverage is not Quality.
2. Supporting evidence and weakening evidence both count as inspected/directional when they are actually known.
3. Optional evidence does not inflate required/recommended coverage.
4. Evidence class and authority remain explicit distributions, not hidden weights.
5. `observed` evidence with an unknown finding increases inspected coverage but not directional coverage.
6. No confidence threshold or composite score is frozen before broader artifact/fork calibration.
7. A future ranking or SVG tier must be able to expose low evidence coverage instead of presenting a precise score with unjustified certainty.
