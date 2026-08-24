# Repository Quality Evidence v1

Status: **experimental evidence-vector contract / no composite Quality score yet**

This layer converts repository assessment context into an explainable Quality evidence vector. It does not select final Quality weights or tiers.

## Four orthogonal state axes

A requirement, observation, or quality dimension must not overload one enum with several meanings.

### Applicability

```text
required
recommended
optional
not-applicable
unknown
```

This answers: **does this outcome matter for this repository's declared purpose and lifecycle?**

### Assessment authority

```text
repository-native
project-owned
external
mixed
unknown
```

This answers: **who or what produced the evidence?**

`external` is not an applicability state. For example:

```text
security-safety
  applicability = required
  authority     = external
  evidence      = observed
  finding       = supports
```

is valid when an external conformance or security evaluator is authoritative for that claim and its result actually supports the outcome.

### Evidence state

```text
observed
absent
not-collected
stale
conflicting
unknown
```

This answers: **what is currently known about the evidence itself?**

### Finding direction

```text
supports
weakens
neutral
unknown
```

This answers: **what does the evidence say about the applicable Quality outcome?**

Evidence state and finding direction are deliberately separate. In particular:

```text
exact-head tests passed
  evidence = observed
  finding  = supports

required compatibility check failed
  evidence = observed
  finding  = weakens

CI config absent but irrelevant to the claim
  evidence = absent
  finding  = neutral

run not fetched
  evidence = not-collected
  finding  = unknown
```

`observed` never implies `supports`. Likewise, `not-collected` and `unknown` evidence cannot carry a directional finding because there is no inspected result to interpret.

These axes are deliberately orthogonal. `not-applicable`, `unknown`, `external`, and `weakens` must never collapse into the same numeric zero.

## Outcome before mechanism

Quality dimensions remain outcome-oriented:

```text
understandability
verification
reproducibility
maintainability
integrity
interoperability
security-safety
stewardship
```

CI, tests, releases, scorecards, benchmark harnesses, checksums, schemas, validators, review records, model cards, and similar mechanisms are evidence sources. They are not universal Quality rows.

A frozen dataset can therefore have:

```text
verification
  applicability = recommended
  authority     = external
  evidence      = observed
  finding       = supports
```

without having CI or unit tests at all.

## Artifact routing

The existing Standard Taxonomy artifact facets select default emphasis. Emphasized dimensions default to `recommended`; other dimensions default to `optional` until domain/project context overrides them.

Examples:

- dataset emphasizes reproducibility, integrity, interoperability, stewardship;
- model emphasizes verification, reproducibility, integrity, stewardship;
- application emphasizes verification, maintainability, security/safety when relevant;
- documentation emphasizes understandability, integrity, stewardship;
- research + dataset + model composes all three modules rather than selecting one exclusive archetype.

These are routing defaults, not score weights.

## Evidence records

Each evidence record preserves:

```text
authority
evidence state
finding direction
evidence class
source identity
claim text when useful
```

Evidence classes continue to use the repository assessment policy's A/B/C/D/U trust classes. The evidence class is a Confidence input, not a direct Quality score.

Finding direction is also not a score. It says whether that specific inspected evidence supports, weakens, or is neutral toward the relevant outcome. Multiple sources can therefore disagree without being silently averaged away.

Multiple evidence sources can yield `authority = mixed`. A dimension summarizes finding directions as:

```text
supports
weakens
neutral
mixed
unknown
```

while retaining exact per-direction counts and all source records. `mixed` is a dimension summary state, not an allowed per-evidence finding value.

Conflicting evidence remains `conflicting` in evidence state rather than being silently converted to a net positive or negative.

## Impact isolation

The Quality evidence builder rejects Impact counters such as:

```text
stars
forks
downloads
dependents
citations
projectStars
upstreamStars
```

Stars remain important and materially influence Impact and later portfolio prominence. They do not become intrinsic Quality evidence merely because they are easy to retrieve.

## Output contract

`buildQualityEvidenceVector()` returns one record per common Quality dimension containing:

```text
applicability
authority
evidenceState
findingState
findingCounts
disposition
evidenceCount
evidence[]
```

`findingCounts` preserves:

```text
supports
weakens
neutral
unknown
```

Dispositions remain evidence-routing states such as:

```text
evidenced
unevidenced
excluded
unresolved-applicability
stale
conflicting
```

`disposition = evidenced` means usable evidence was observed. It does **not** mean the observed result was favorable; `findingState` carries that interpretation separately.

The result also carries artifact claim boundaries and currently sets:

```text
compositeQualityScore = null
```

No downstream renderer should infer a numeric Quality value from evidence count, `observed` state, CI presence, process-file count, or finding counts before an explicitly calibrated scoring contract exists.

## Current acceptance boundaries

The v1 Quality evidence layer must preserve all of the following:

1. `external` authority is independent of applicability.
2. `not-applicable` dimensions are excluded rather than failed.
3. unknown evidence remains unknown.
4. repository-native and external evidence can coexist as `mixed` authority.
5. evidence state is independent from finding direction.
6. `observed` does not imply `supports`.
7. `not-collected` or `unknown` evidence cannot fabricate a directional finding.
8. supporting and weakening evidence can coexist and remain inspectably `mixed`.
9. Impact counters are rejected from Quality evidence input.
10. artifact modules compose without creating a second archetype taxonomy.
11. absence of CI is not itself a Quality defect.
12. no composite Quality formula is frozen yet.

The next scoring phase must consume this vector rather than bypassing it.
