# Repository evidence carrier authority gate v1

Status: **experimental fail-closed live-admission contract**

Repository evidence can be valid for assessment while still being unsafe to publish against the repository identity shown by the live portfolio.

The current portfolio consumer presents a repository-level identity whose implementation authority is implicitly the repository default branch. It does not expose a separate branch, pull request, release candidate, or other evidence-carrier identity. Therefore evidence from a non-default carrier must not silently become the live repository Quality overlay.

## Core distinction

Keep these two questions separate:

1. **Is the evidence valid for the carrier it was observed on?**
2. **Does that carrier match the repository authority the consumer is presenting?**

A strong answer to the first question does not imply a strong answer to the second.

For example, an open development PR can have excellent exact-head build, runtime, persistence, compatibility, and UI evidence. That evidence is valid project-side assessment evidence for the PR carrier. If the live portfolio card still means “the repository/default branch”, publishing the PR evidence on that card would collapse two different authorities.

## Current live rule

`loadBoundedQualityEnrichments()` now calls the carrier-authority gate before converting a frozen calibration case into a live Quality enrichment.

Existing bounded fixtures that do not declare carrier metadata retain their prior behavior. This preserves the already-reviewed five live sources.

Once a calibration case declares `carrier`, admission becomes fail-closed. The current consumer rejects the source when any of these conditions hold:

- `authorityMatch === false`;
- `productionAdmissionEligible === false`;
- declared `branch` differs from declared `defaultBranch`;
- `authorityScope` is not `repository-default-branch`;
- carrier metadata is declared but does not establish enough authority identity to resolve compatibility.

A fixture cannot override a branch mismatch merely by setting `productionAdmissionEligible: true`.

## Why this is separate from Quality

Carrier mismatch is an **authority/provenance boundary**, not a negative Quality finding.

Do not translate an unmerged branch, draft PR, release candidate, or other carrier state into a Quality penalty. A project can have directly observed strong Quality on that carrier while remaining ineligible for a live overlay whose visible identity means something else.

Likewise, merging a carrier does not automatically improve Quality; it may only remove the authority mismatch.

## FTBPublicClaims example

`nekomario28/FTBPublicClaims` has strong exact-head evidence on the active `neoforge-1.21.1-port` PR carrier at revision `12c57797637d1903ad7f76174e6d676364a3c339`.

That calibration remains useful and passes the full IPM Verify workflow, but it is intentionally non-admitted because:

- evidence carrier: `neoforge-1.21.1-port`;
- repository default branch: `public-claim-context`;
- the live portfolio does not display a PR/branch carrier scope;
- the frozen fixture explicitly records `authorityMatch: false` and `productionAdmissionEligible: false`.

Therefore FTBPublicClaims can be assessed on the active carrier without being counted among the current live Quality overlays.

## Future authority alignment

A non-default carrier may become eligible only after the product has a truthful authority binding. Examples include:

- the verified carrier is integrated into the repository default branch and a new frozen default-branch evidence snapshot is produced; or
- the presentation/assessment contract is explicitly extended to display and preserve carrier scope, so users can see that a Quality result belongs to a specific branch/PR/release carrier rather than the default repository identity.

The current v1 live consumer implements neither implicit branch substitution nor silent carrier following.

## Invariants

- Evidence validity and consumer authority compatibility are separate.
- Carrier mismatch is provenance, not Quality merit.
- Live admission fails closed once carrier metadata is declared.
- Existing reviewed fixtures without carrier metadata do not change behavior.
- Fork attribution rules remain independent; carrier authority does not replace local-delta provenance.
- Frozen evidence does not automatically refresh when a branch or PR moves.
- No composite Quality score, Confidence score, ranking, or Structure geometry authority is introduced by this gate.
