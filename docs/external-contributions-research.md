# External contribution research

Status: **Foundation accepted; rendering semantics intentionally deferred** (2026-08-22)

## Goal

Represent meaningful work in public repositories owned by other people or organizations without pretending those repositories are owned by the Project Map user, without asking for a PAT, and without exposing private/internal contribution details.

## Evidence first

A diagnostic-only workflow was run in PR #116 using only the same class of repository-local GitHub Actions token available to Project Map (`contents: read`, `metadata: read`). It queried GitHub GraphQL `ContributionsCollection` and excluded private repositories plus repositories owned by the target user before output.

Evidence:

- diagnostic PR: #116, closed unmerged;
- run: `32562359682`;
- job: `97005808560`;
- result: 6 public external repositories were visible for `nekomario28`;
- `c0c25034/ProjExD_4` reported 1 commit, 1 PR and 1 merged PR;
- public PR contribution records were also visible for repositories under `gazebosim`, `talhanation`, and another public owner;
- no PAT, GitHub App credential, extra permission, or Cloudflare dependency was required.

This establishes feasibility with the existing Actions trust boundary before production code is connected to the graph.

## Sources considered

### GitHub GraphQL `ContributionsCollection` — adopt

GitHub exposes repository-grouped commit and pull-request contributions through `commitContributionsByRepository` and `pullRequestContributionsByRepository`. This matches GitHub's own contribution model and can be queried with the existing authenticated Actions token for public data.

Initial foundation contract:

- public repositories only;
- repositories owned by the target user are excluded because the existing owned-repository fetch already covers them;
- restricted contribution nodes are excluded;
- explicit rolling 365-day window;
- at most 100 repositories;
- at most 100 contribution records per repository/type in the first query;
- truncation is surfaced as metadata instead of silently claiming exact totals;
- one GraphQL request, no new dependency.

References:

- https://docs.github.com/en/graphql/reference/objects#contributionscollection
- https://docs.github.com/en/graphql/reference/objects#createdcommitcontribution
- https://docs.github.com/en/graphql/reference/objects#createdpullrequestcontribution
- https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference

### Search API — reject as canonical source

Searching authored PRs can recover pull requests but does not provide one coherent GitHub contribution model for commits plus PRs. Search also has separate rate/query-result constraints and would require stitching multiple APIs together.

### Events API — reject

Public events are useful for activity feeds, not a stable portfolio source. Their bounded historical window makes them inappropriate for repository-level contribution summaries.

### Scraping profile contribution UI — reject

The data already exists through an official authenticated API. Scraping would be more brittle and harder to validate.

### GitHub Archive / third-party contribution datasets — reject

These are useful for large-scale research but add external infrastructure and are unnecessary for per-user Project Map generation.

## Why the first production slice does not render anything

The existing Project Map has explicit ownership semantics:

- Original / Fork / Archived status;
- owner -> category -> repository hierarchy;
- static-graph validation that currently requires repository URLs to belong to the requested user.

Dropping an external repository into that model as `fork=false` would incorrectly classify it as **Original**, implying ownership. Therefore data acquisition and graph semantics are separated.

The foundation only returns bounded, sanitized external contribution records. It does **not** modify `graph.json`, SVGs, status filters, or any viewer.

## Required semantics before rendering

If promoted into the map, external repositories must be represented explicitly as **Contributed**, never Original. The next design/implementation slice should preserve these invariants:

1. Repository identity uses full `owner/repo`, not only repo name.
2. The external owner remains visible in metadata.
3. Contribution metadata records commits, PRs, merged PRs, window, and truncation state.
4. Private repositories and restricted contributions are never serialized into the public profile graph.
5. External repositories must not create an ownership edge from the Project Map user.
6. Status/filter behavior must not silently treat Contributed as Original/Fork/Archived.
7. A small cap/ranking policy is required so one-off external activity cannot swamp an owned portfolio.

## Open ranking question

No arbitrary threshold is adopted yet. Candidate policies to evaluate against real portfolios include:

- top-N public external repositories ranked by merged PRs, then commits, then PRs;
- a simple meaningful-work gate such as merged PR >= 1, commits >= N, or repeated PRs;
- user-selectable inclusion with a conservative default.

The diagnostic user currently demonstrates why this needs deliberate evaluation: one external repository has a merged PR while several substantial but still-open upstream PRs exist. A merged-only rule would hide useful ongoing upstream work; an every-PR rule could overfill maps for highly active contributors.

## Implementation boundary

`src/external-contributions.ts` and `scripts/external-contributions.mjs` are deliberately standalone. They are source/static parity implementations and are not called by generation yet. This makes the next decision reversible and independently testable.
