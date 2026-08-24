# Repository Scale and lifecycle context v1

Status: **experimental evidence/context contract / no Scale, Maturity, or Activity composite scores yet**

This layer provides project-side scope and lifecycle context for later Portfolio Prominence calibration. Repository relation follows [`repository-relation-axes-v1.md`](repository-relation-axes-v1.md).

## Scale is breadth and coordination, not repository mass

Candidate Scale evidence:

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
  bounded direct evidence of meaningful project scope
```

Observed count-like features may be log-transformed for later calibration, but there is no composite Scale score yet.

Rejected shortcuts:

```text
LOC => Scale
commit count => Scale
workflow count => Scale
one large generated/data file => Scale
project popularity => personal contribution
```

A small multi-system integration can carry more meaningful scope than a large generated repository.

## Project-side only

Scale is project-side evidence. Person-side contribution fields are rejected by the extractor.

For shared work, later portfolio presentation combines rather than conflates:

```text
project Scale
personal Contribution
```

Unknown collaboration does not prevent project-side Scale evidence from being collected; it only prevents unsafe personal attribution.

## Fork lineage

Fork semantics use:

```text
relation.lineage = fork
```

When upstream Scale is available it is retained as:

```text
upstreamContext
  contextOnly = true
  eligibleForLocalScale = false
```

The extractor rejects upstream `parent` Scale context for `lineage = original`, preventing two competing lineage authorities.

A large upstream project therefore cannot inflate the local fork's authored Scale.

## Ownership and collaboration do not define Scale automatically

```text
ownership = contributed
```

may describe a huge external project or a small one. Likewise `collaboration = team` does not itself imply a high Scale score. These axes control attribution/context; actual project Scale still depends on direct breadth/coordination evidence.

## Maturity and Activity remain distinct

Lifecycle states:

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

Activity observations may include:

```text
days since push
commits in a bounded recent window
releases in a bounded recent window
issue responses in a bounded recent window
```

These do not directly produce Quality, Maturity, or health verdicts.

Maturity evidence can include:

```text
release count
stable-version declaration
production acceptance
frozen identity
versioned artifact
experimental declaration
```

One hundred releases do not automatically mean greater Maturity than a deliberately frozen, well-versioned reference artifact.

## Lifecycle interpretation

For `frozen`, `snapshot`, and `archived`, recent activity is not required by lifecycle. Low Activity is not an automatic Quality or health penalty.

For `stable` and `maintenance`, Activity is context-dependent.

For `active` and `experimental`, Activity may be informative, but inactivity alone still does not prove poor Quality.

At L0, a non-archived repository remains `lifecycle = unknown`; the graph adapter does not infer `active` merely from repository presence or timestamps.

Current outputs therefore retain:

```text
compositeScale = null
compositeMaturity = null
compositeActivity = null
healthInference = null
```

Production scoring must preserve these evidence boundaries even after calibration introduces presentation values.
