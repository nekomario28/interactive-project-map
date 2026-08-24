# Repository Scale and lifecycle context v1

Status: **experimental evidence/context contract / no Scale, Maturity, or Activity composite scores yet**

This layer fills the remaining project-side context needed before Portfolio Prominence calibration.

## Scale is breadth and coordination, not repository mass

Candidate Scale evidence is grouped into:

```text
technical breadth
  subsystems
  supported platforms
  integrations
  operational surfaces

organizational breadth
  contributors
  maintainers

scope evidence
  bounded textual/direct evidence of meaningful scope
```

The extractor may log-transform observed counts for later calibration, but it does not currently produce a composite Scale score.

The following shortcuts are explicitly rejected:

```text
LOC => Scale
commit count => Scale
workflow count => Scale
one large generated/data file => Scale
project popularity => personal contribution
```

A 200-line multi-system integration can have more meaningful scope than a large vendored or generated repository. Raw repository size is therefore not a primary Scale primitive.

## Project-side only

Scale is project-side evidence. Person-side contribution fields must not be used to manufacture project Scale.

For shared work, later portfolio prominence must consume both:

```text
project Scale
personal Contribution
```

without substituting one for the other.

## Forks

For `owned-fork`, upstream Scale is retained as `upstreamContext` and marked:

```text
contextOnly = true
eligibleForLocalScale = false
```

This mirrors the Impact and Personal Contribution attribution boundaries. A large upstream project does not make a tiny local fork delta into a large authored project.

## Maturity and Activity remain distinct

Lifecycle context uses the existing states:

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

Activity observations can include:

```text
days since push
commits in a bounded recent window
releases in a bounded recent window
issue responses in a bounded recent window
```

These observations do not directly produce Quality, Maturity, or health verdicts.

Maturity evidence can include:

```text
release count
stable-version declaration
production acceptance
frozen identity
versioned artifact
experimental declaration
```

Again, these are evidence features rather than direct points. One hundred releases do not automatically mean greater Maturity than one deliberately frozen, well-versioned reference artifact.

## Lifecycle interpretation

For `frozen`, `snapshot`, and `archived` repositories, recent activity is not required by lifecycle. Low Activity must not become an automatic Quality or health penalty.

For `stable` and `maintenance`, Activity is context-dependent.

For `active` and `experimental`, Activity may be informative, but lack of recent commits still does not automatically prove poor Quality or project failure.

Current output therefore keeps:

```text
compositeScale = null
compositeMaturity = null
compositeActivity = null
healthInference = null
```

The next layer may calibrate presentation prominence using synthetic/normalized components, but production scoring must continue to preserve these evidence boundaries.
