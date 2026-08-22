# Contributed viewer contract

Status: C4 rollout in progress (2026-08-23 JST).

## Purpose

`Contributed` represents bounded, public contribution evidence in repositories owned by somebody else. It is **not ownership**, not a fork/archive status, and not another taxonomy/category layer.

The canonical identity is full `owner/repo`. A contributed repository may itself be a fork or archived; those remain source flags and never replace the top-level `Contributed` relation.

## Completed foundation

- C1 ranking/cap: deterministic `merged PRs > commits > PRs > owner/repo`, no invented weighted score, hard maximum 12.
- C2 graph/schema: explicit `relation: contributed`, full external identity, direct `contribution` edge, no ownership/membership path, strict static sanitizer.
- C3 generation: opt-in Action input `contributed`, public-only 365-day evidence path, existing classification reuse, default remains `false`.

## C4a — shared Galaxy / Obsidian

The shared exploratory viewer must:

1. fail closed on malformed external identity, URL, contribution counts, truncation flags, or graph diagnostics;
2. reconstruct only an explicit direct `user -> repository` `contribution` edge;
3. expose `Contributed` as a fourth repository status before fork/archive source flags;
4. compose with status filtering and URL state (`c` alias), Search, selection, Local Graph focus, Activity, reduced motion, and Category Navigator without placing external repositories into a taxonomy category;
5. show external owner and contribution evidence in details;
6. use a visually distinct node/edge treatment so the direct edge is not mistaken for ordinary ownership;
7. preserve the existing static-first/no-browser-GitHub-API architecture.

## C4b — dedicated presets

Still required before public promotion:

- Radial, Tree, Treemap, Timeline, Cluster, Sunburst, Matrix, and Sankey need explicit external-contribution layout semantics.
- Do not synthesize a fake `Other` category or category membership for contributed repositories.
- Aggregate views must keep owned repository totals semantically separate from contributed totals.
- All eight routes must share the same Contributed filter/search/detail contract.

## Promotion boundary

Do **not** expose Contributed in the public setup generator or promote it into stable v1 until C4b is complete and the real-profile privacy/UX proof passes Chromium and iPhone WebKit on the exact final head.

New visual styles remain deferred and are unrelated to this work.
