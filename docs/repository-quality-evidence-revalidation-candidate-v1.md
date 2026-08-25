# Repository Quality evidence revalidation candidate v1

Status: **experimental / explicit / bounded / non-publishing / non-default**

This candidate answers the next uncertainty after live publication, discoverability, and frozen-evidence freshness: how one selected Quality source can be explicitly re-observed without turning the portfolio into an automatic crawler or creating a second Quality authority.

## Boundary

The existing bounded source manifest remains the source-selection authority. Existing calibration fixtures remain the Quality interpretation authority. The existing live sidecar builder remains the assessment/presentation generator.

Revalidation adds only an explicit observation request for one already-selected source:

```text
bounded source manifest
+ one explicit maintainer-owned revalidation request
+ already-calibrated exact revision
  -> revalidation disposition
  -> source-scoped effective freshness metadata
  -> existing assessment/presentation generator
```

It does **not**:

- discover repositories;
- crawl the portfolio automatically;
- change Quality findings, applicability, Confidence, ranking, tiers, node size, or placement;
- add a browser-side acquisition path;
- publish anything;
- expose a new production CLI option;
- treat workflow time or graph regeneration time as evidence freshness.

The normal CLI path remains non-revalidating.

## Refresh decision owner

The candidate requires:

```text
decisionOwner = maintainer-explicit
one repositoryKey
one exact caseId
one explicit reason
one explicit observation
```

There is no global age threshold in v1. A universal `N days = stale` rule would be arbitrary across applications, game mods, fork-local evidence, datasets, and other artifact types. Revalidation is triggered by an explicit review decision such as a source-revision check, known invalidation, or calibration-contract change.

This keeps the decision bounded while leaving room for later artifact-specific staleness policy if evidence supports one.

## Exact-revision rule

Freshness may advance only when all of the following hold:

```text
source is already selected
case identity matches exactly
calibration records an exact 40-hex Git revision
source was explicitly observed as available
observed revision == calibrated revision
observed snapshot date is valid
observed snapshot date is not in the future
observed snapshot date does not move backwards
```

Then the disposition is:

```text
revalidated-unchanged-exact-revision
```

The Quality vector itself remains unchanged. Only the selected source's effective evidence freshness may advance.

This is intentionally stronger than inferring a revision from arbitrary evidence strings. If the calibration does not record an explicit revision, the disposition is:

```text
requires-calibration-revision
```

and freshness does not advance.

## Changed source

If the source is available but its observed revision differs from the calibrated revision:

```text
requires-recalibration
```

The candidate does not reinterpret the changed repository and does not advance the old evidence date. A changed source must return to the existing calibration/admission path before new Quality claims can be used.

This preserves one semantic authority:

```text
revalidation decides whether frozen evidence still identifies the observed source
calibration decides what the evidence means
```

## Unavailable source

If the explicitly selected source cannot be re-observed:

```text
source-unavailable-retain-frozen
```

The last valid frozen evidence remains readable with its old date. No newer freshness is invented. This is fail-open for the existing non-default viewer while remaining fail-closed about freshness.

## Source-scoped freshness

Current calibration files may contain multiple cases under one fixture-level `snapshotDate`. Mutating that fixture-level date would incorrectly refresh peer cases that were not re-observed.

The candidate therefore keeps:

```text
fixtureSnapshotDate   -> original frozen provenance
effectiveSnapshotDate -> source-scoped revalidation result
```

Only the explicitly revalidated source receives a different effective date. Peer sources remain unchanged even when they originated from the same fixture/date.

Assessment freshness is recomputed from all bounded sources. Portfolio-presentation freshness is recomputed only from presentation-eligible sources. Revalidating a presentation-ineligible source can therefore update assessment provenance without changing person-side portfolio freshness.

## Real observation used by this probe

On 2026-08-25, `nekomario28/antifullbright` default branch `main` was explicitly re-observed at:

```text
154bd1a1085412ca7a5abe797abf253a43dd29a8
```

The frozen `antifullbright-game-mod-1.1.0` calibration records that exact revision. The observation is retained in:

```text
fixtures/repository-quality-evidence-revalidation-antifullbright-2026-08-25.v1.json
```

Because the original frozen snapshot date is already `2026-08-25`, this real observation does not numerically change aggregate freshness. It does prove the exact-revision positive path without changing the Quality vector.

Controlled tests separately use an older baseline date to prove that one eligible source can advance independently, and that an ineligible source cannot leak its newer date into portfolio-presentation freshness.

## Expected dispositions

| Condition | Disposition | Freshness advance |
| --- | --- | --- |
| exact selected case, exact calibrated revision, source available | `revalidated-unchanged-exact-revision` | target source only |
| observed revision changed | `requires-recalibration` | no |
| calibration has no exact revision | `requires-calibration-revision` | no |
| source unavailable | `source-unavailable-retain-frozen` | no |

## Acceptance gate

A candidate is acceptable only if tests prove all of these simultaneously:

```text
one source per request
unchanged peers retain old provenance
presentation-ineligible refresh cannot alter portfolio freshness
changed revision cannot launder old Quality into a new date
missing calibrated revision fails closed
unavailable source retains the last valid frozen date
normal CLI performs no revalidation
assessment/presentation Quality semantics remain unchanged
15-repository membership remains unchanged on the current live fixture
Quality remains experimental-non-default
```

A full PR Verify/browser run is still required before accepting the implementation head. No profile pin or production publication should move as part of this candidate gate.
