# Repository Quality assessment-artifact calibration — 2026-08-25

Status: **bounded real-case sidecar-envelope calibration / no production assessment generation / no renderer integration**

This calibration exercises the Quality overlay projection through validated repository assessment artifact envelopes rather than calling the overlay directly from Quality fixtures.

It verifies two different artifacts because external rubric donors must not be represented as personal portfolio contributions.

## Personal calibration artifact

Owner:

```text
nekomario28
```

Bounded repository set:

```text
interactive-project-map
  application
  Quality partial

ProjExD_Group10
  application
  owned × team × original
  Quality partial

gz-sim
  library
  owned × unknown × fork
  Quality partial

turing-smart-screen-python-owl
  library
  owned × unknown × fork
  Quality partial

FTBPublicClaims
  game-mod
  Quality not-collected
```

The fifth repository is deliberately left unassessed so the projection must preserve:

```text
qualitySectionState = not-collected
overlayState        = unavailable
overlay             = null
```

rather than synthesizing an all-unknown Quality ring.

## External dataset calibration artifact

Owner:

```text
fivethirtyeight
```

Repository:

```text
data
  category  data-analytics
  artifact  dataset
  lifecycle snapshot
  relation  owned × unknown × original
```

The donor uses the frozen `state-of-the-polls-2024` Quality evidence calibration, but the assessment artifact is owned by `fivethirtyeight` rather than inserted into the `nekomario28` portfolio artifact.

This preserves the distinction:

```text
external calibration donor
!=
portfolio contributed repository
```

## Expected personal projection

```text
repositories         5
overlay available    4
overlay unavailable  1
```

Expected bounded findings include:

```text
interactive-project-map
  4/6 interpreted
  supports = 4

ProjExD_Group10
  weakening finding remains visible

library forks
  target dimensions = 6
  supports = 3
  unknown  = 3
```

Fork local-delta / Personal Contribution remains a separate person-side assessment concern and is not copied into project Quality overlay geometry.

## Expected donor projection

```text
repository           fivethirtyeight/data
target dimensions    5
interpreted           4
supports              4
unknown               1
```

The dataset donor still does not establish intrinsic data validity.

## Source separation

The test requires:

```text
personal projection source.owner = nekomario28
donor projection source.owner    = fivethirtyeight
```

and the personal artifact must not contain:

```text
fivethirtyeight/data
```

This is an attribution invariant, not merely a rendering preference.

## What this proves

The calibration can prove that:

- validated assessment artifact envelopes can carry real frozen Quality vectors;
- the assessment-to-overlay projection preserves available vs unavailable Quality;
- application and library cases survive the sidecar envelope unchanged;
- the dataset donor can exercise the same projection under its own truthful owner context;
- external calibration evidence need not contaminate portfolio identity.

## What remains unproven

This is still a bounded calibration subset. It does not prove:

- complete current-profile graph join coverage;
- generation of all 15 current repository assessment entries from the live graph;
- production `project-map/assessment.json` publication;
- L1/L2 acquisition automation;
- dark/light visual accessibility;
- final Quality tiers or Portfolio Prominence.

## Next gate

The next useful integration step is to enrich a full L0 assessment artifact generated from the current personal `graph.json` without changing graph semantics:

```text
current graph.json
  ↓ existing L0 adapter
full personal assessment skeleton
  ↓ bounded Quality enrichment by canonical repositoryKey
assessment.json candidate
  ↓ validated projection
Quality overlays for assessed entries
unavailable state for unassessed entries
```

Quality enrichment must only update repositories already present in the personal assessment artifact. An external calibration donor must never be added by that enrichment step.
