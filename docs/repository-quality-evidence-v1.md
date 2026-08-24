# Repository Quality Evidence v1

Status: **experimental evidence-vector contract / no composite Quality score yet**

This layer converts repository assessment context into an explainable Quality evidence vector. It does not select final Quality weights or tiers.

## Three orthogonal state axes

A requirement or quality dimension must not overload one enum with several meanings.

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
```

is valid when an external conformance or security evaluator is authoritative for that claim.

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

These axes are deliberately orthogonal. `not-applicable`, `unknown`, and `external` must never collapse into the same numeric zero.

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
evidence class
source identity
claim text when useful
```

Evidence classes continue to use the repository assessment policy's A/B/C/D/U trust classes. The evidence class is a Confidence input, not a direct Quality score.

Multiple evidence sources can yield `authority = mixed`. Conflicting evidence remains `conflicting` rather than being silently averaged away.

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
disposition
evidenceCount
evidence[]
```

Dispositions are explanatory routing states such as:

```text
evidenced
unevidenced
excluded
unresolved-applicability
stale
conflicting
```

The result also carries artifact claim boundaries and currently sets:

```text
compositeQualityScore = null
```

No downstream renderer should infer a numeric Quality value from evidence count, CI presence, or process-file count.

## Current acceptance boundaries

The v1 Quality evidence layer must preserve all of the following:

1. `external` authority is independent of applicability.
2. `not-applicable` dimensions are excluded rather than failed.
3. unknown evidence remains unknown.
4. repository-native and external evidence can coexist as `mixed` authority.
5. Impact counters are rejected from Quality evidence input.
6. artifact modules compose without creating a second archetype taxonomy.
7. absence of CI is not itself a Quality defect.
8. no composite Quality formula is frozen yet.

The next scoring phase must consume this vector rather than bypassing it.
