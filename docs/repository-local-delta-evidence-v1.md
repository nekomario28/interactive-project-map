# Repository local-delta evidence v1

Status: **experimental bounded attribution evidence / no Personal Contribution score**

Fork lineage requires a clean separation between inherited project merit and the portfolio owner's local work. A branch comparison can provide useful person-side evidence, but its result must remain bounded to the refs that were actually compared.

## Three independent facts

Represent local-delta evidence with:

```text
observation state
  observed | unknown

delta presence
  present | absent | unknown

comparison scope
  exact compared refs or another bounded scope identifier
```

Optional result text may record the observed comparison facts.

Examples:

```text
parent/main...local/main
  state     = observed
  presence  = present
  evidence  = 2 commits ahead with scheduler/server/test changes
```

and:

```text
parent/main...local/main
  state     = observed
  presence  = absent
  evidence  = 0 commits ahead; 2 behind; no local-ahead changed files
```

are both valid observations.

An uninspected fork remains:

```text
state     = unknown
presence  = unknown
scope     = null or planned scope only
evidence  = null
```

## Claim boundary

`observed + absent` means no local delta was observed **within the recorded comparison scope**.

It does not establish:

- no material non-default branch;
- no change that was already upstreamed;
- no merged PR into the parent/source repository;
- no reviews/issues/releases or other person-side contribution;
- no earlier local work that was rebased/squashed away;
- zero Personal Contribution overall.

Similarly, `observed + present` establishes a local delta, not its merit magnitude. Commit count, file count, and LOC remain descriptive evidence until a separate contribution contract interprets scope/responsibility.

## Backward compatibility

Legacy `localDeltaEvidence: <text>` remains accepted and is projected as:

```text
state     = observed
presence  = present
scope     = unspecified
evidence  = <text>
```

New callers should prefer `localDeltaObservation` so a checked negative result can be distinguished from missing evidence.

Supplying both legacy and structured forms is rejected.

## Output

`buildPersonalContributionEvidence()` preserves:

```text
localDelta
  state
  presence
  scope
  evidence

attribution
  localDeltaState
  localDeltaPresence
```

Only `observed + present` emits the descriptive signal `local-delta-present`.

No local-delta state produces a Personal Contribution composite score by itself:

```text
compositePersonalContribution = null
portfolioProminenceEffect = null
```

## Acceptance boundaries

1. Missing local-delta evidence remains unknown.
2. An observed no-delta branch comparison is not collapsed to unknown.
3. An observed no-delta branch comparison is not generalized to universal non-contribution.
4. Observed delta presence is not a contribution magnitude score.
5. Comparison scope is required for structured observed results.
6. Upstream Quality/Impact/Scale remain project-side context.
7. Other person-side contribution channels remain independently assessable.
