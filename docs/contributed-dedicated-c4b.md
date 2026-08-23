# Contributed dedicated-viewer C4b

Status: **active implementation boundary** (2026-08-23)

## Goal

Finish Contributed semantics in the eight dedicated viewers without weakening the C2 ownership/privacy contract or inventing another graph model.

Affected routes:

- Radial
- Tree
- Treemap
- Timeline
- Cluster
- Sunburst
- Matrix
- Sankey

## What C4a already proved

PR #129 made the shared Galaxy/Obsidian viewer understand the already-generated `relation: "contributed"` contract. The exact final head passed Verify, the twelve-preset comparison, Chromium and iPhone WebKit before merge.

C4b must reuse the same public graph contract. It must not add another fetch path, PAT, backend, browser GitHub API call, ownership edge, or category membership edge for external repositories.

## Audit finding: the existing dedicated projection adapter is necessary but not sufficient

`public-dedicated-view-state.js` currently owns cross-preset status filtering, count repair, category pruning and shareable `status=` state. This remains the right common boundary for filtering.

However, all dedicated viewers still sanitize repository identity under the older owned-only assumption. Their repository sanitizers require an owned repository-style label/URL and therefore reject a legitimate external `owner/repo` node before layout. Their status helpers also derive status only from source `fork` / `archived`, which would misclassify a surviving Contributed repository as Original, Fork or Archived.

Therefore C4b cannot be implemented by adding only a fourth filter chip. A count-only adapter change would create an invalid state where the control reports Contributed repositories while the renderer silently drops or mislabels them.

## Required invariant

For every dedicated viewer:

1. `relation: "contributed"` is checked before source `fork` / `archived` when deriving display status.
2. A Contributed repository keeps full visible `owner/repo` identity.
3. Its canonical URL remains the external `https://github.com/OWNER/REPO` URL.
4. Source `fork` / `archived` remain metadata only and never override the Contributed relation.
5. No synthetic `ownership` or `membership` edge is introduced to make a renderer accept the node.
6. Search/details must retain enough metadata to make the external relationship explicit.
7. The common dedicated projection adapter owns status filtering and URL state; renderers own only their existing layout/aggregation behavior.

## Aggregate-layout rule

Matrix, Sankey, Treemap and Timeline must not fold Contributed into owned Original/Fork/Archived totals. If a view exposes status composition, it needs a fourth Contributed bucket. If the layout groups by category and a Contributed repository has no owned category, it must be handled as external/unassigned context rather than being attached to an owned category.

A renderer may use a presentation-only fallback bucket for unassigned repositories if its existing layout already supports one, but that bucket must not be serialized back into graph semantics and must not create an ownership edge.

## Minimal implementation order

1. Extend the common dedicated projection adapter to `original,fork,archived,contributed` with alias `c`; derive Contributed before source flags and keep zero-count/default URL behavior unchanged.
2. Add the fourth generated status control in `apply-dedicated-view-state.mjs`.
3. Extend dedicated viewer sanitizers so C2-valid external `owner/repo` identity and canonical external URL survive browser validation.
4. Extend each viewer's display-status helper/palette/details only where the existing renderer directly consumes status.
5. For aggregate views, add a fourth composition bucket and explicitly test unassigned Contributed repositories.
6. Expand `tests/e2e/dedicated-status.spec.mjs` with one C2-shaped Contributed repository whose source flags intentionally include fork/archive variation, proving `relation` precedence.
7. Gate all eight routes on the same projected repository set, counts, URL state, no browser errors, visible external identity, and absence of ownership/category fabrication.
8. Run affected tests first; only after C4b is complete run full Verify + twelve-preset + Chromium + iPhone WebKit on the exact final head.

## Deliberately deferred

- public generator default-on behavior;
- stable `v1` movement;
- new visual styles;
- another taxonomy layer for external work;
- a second contribution source or browser-side acquisition.
