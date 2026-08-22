# Contributed ranking C1

Status: **Accepted** (2026-08-22)

## Decision

Use a deterministic lexicographic rank with **no activity threshold**:

1. merged pull-request count descending;
2. commit count descending;
3. pull-request count descending;
4. `owner/repo` ascending as the stable tie-breaker.

Bound the visible/serialized candidate slice by portfolio size:

```text
cap = min(12, max(4, ceil(owned_repository_count / 2)))
```

The cap is the noise control. Do not add a weighted score and do not discard a repository merely because its only visible contribution is one still-open PR.

## Why

The real public diagnostic from PR #116 contained six external repositories. One had 1 commit + 1 PR + 1 merged PR; five had a single public PR that was not yet merged. A merged-only rule or `merged >= 1 OR commits >= 2 OR PRs >= 2` rule would admit only 1/6 and hide all current upstream work. An every-activity policy without a cap, on the other hand, can let one-off repositories dominate a large contributor's map.

The accepted policy separates those concerns: ranking favors stronger/repeated evidence, while the cap limits map size without pretending a single open PR is necessarily trivial.

## Fixture evaluation

- Real diagnostic, 13 owned repositories: cap 7; all 6 public external repositories retained; merged repository ranks first.
- Sparse synthetic portfolio, 0–3 owned repositories: cap 4, so an external-only or beginner portfolio can still show useful work without becoming unbounded.
- Moderate portfolio, 20 owned repositories: cap 10.
- Very active portfolio, 100+ owned repositories: hard cap 12.
- Noisy synthetic contributor with 30 one-PR repositories: 12 retained, 18 explicitly reported as omitted.

## Rejected policies

**Merged-only:** too much false-negative pressure for meaningful work under review.

**Repeated-work threshold:** still hides substantial single PRs and requires an arbitrary numeric boundary.

**Weighted score:** gives false precision and adds tuning constants without better evidence.

**Unbounded every-activity:** permits external work to overwhelm the owned portfolio.

## C2/C3 contract

C2 may rely on `owner/repo` identity and the deterministic ordering, but ranking does not create ownership semantics. C3 should call this selector only after the public external contribution fetch succeeds and only when the user explicitly enables Contributed collection. The graph must record the cap/omission diagnostics so a bounded result is never presented as exhaustive.
