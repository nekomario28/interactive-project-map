# Contributed viewer contract

Status: **production-proven; visual contract updated 2026-08-25 JST**

## Purpose

`Contributed` represents bounded, public contribution evidence in repositories owned by somebody else. It is **not ownership**, not a fork/archive status, and not another taxonomy/category layer.

The canonical identity is full `owner/repo`. A contributed repository may itself be a fork or archived; those remain source flags and never replace the top-level `Contributed` relation.

## Canonical graph contract

- Deterministic ranking/cap: `merged PRs > commits > PRs > owner/repo`, hard maximum 12.
- Explicit `relation: contributed`, full external identity, direct data-model `contribution` edge, and no ownership/membership path.
- The direct `contribution` edge is evidence in the graph model. It is **not** a requirement to draw an owner-to-repository line in the UI or SVG.
- Generation is opt-in and public-only over the bounded contribution window; the global default remains `false`.

## Interactive viewer contract

All interactive presets must:

1. fail closed on malformed external identity, URL, contribution counts, truncation flags, or graph diagnostics;
2. reconstruct only the explicit data-model `user -> repository` `contribution` relation and never fabricate ownership/membership;
3. expose `Contributed` as the repository's primary display status before fork/archive source flags;
4. compose with status filtering and URL state (`c` alias), Search, selection, Local Graph focus, Activity, reduced motion, and Category Navigator;
5. keep the full external `owner/repo` identity and show external owner / contribution evidence in details;
6. use the distinct Contributed palette plus explicit `Contributed` text/legend/filter semantics; do not rely on a permanently drawn direct contribution line or decorative halo to communicate the relation;
7. keep contributed repositories outside owned taxonomy membership. Layout-only placement is allowed but must not mutate `state.graph`.

## Galaxy presentation contract

Galaxy Classic / Systems / Hybrid may use presentation-only external placement because the normal Galaxy motion model is category-membership based and contributed repositories intentionally have no owned category membership.

External placement must remain visually disjoint from the swept region of owned category systems. In particular, a second or later Contributed lane must never be moved inward through owned category orbits merely to fit more external repositories.

For the static `Galaxy Systems` SVG, Contributed repositories use a dedicated edge rail rather than the owner-centered category motion field. The rail is presentation-only: it may use a background fade and subtle divider to preserve separation, but it must not introduce a synthetic category hub, `groupId`, ownership edge, or membership edge. Contributed nodes on the rail do not participate in the global category animation.

Other Galaxy presentations may still use owner-centered external orbits when their geometry guarantees a disjoint external region. Reduced-motion preferences must continue to pause any extra motion that remains.

## Dedicated preset contract

Radial, Tree, Treemap, Timeline, Cluster, Sunburst, Matrix and Sankey use the same Contributed-first status semantics. Category-dependent layouts may use an explicit presentation-only external/unassigned context when required, but that context must never be serialized back into the canonical graph or counted as an owned category.

Aggregate views must keep owned repository totals semantically separate from contributed totals and must not fold Contributed into Original/Fork/Archived composition.

## Static SVG parity boundary

Static SVG renderers consume the same canonical graph and should preserve the same user-visible relation semantics:

- Contributed must not disappear merely because it has no owned `groupId`.
- Contributed must not be recolored as Original/Fork/Archived because of source flags.
- The Contributed palette and explicit legend text should match the interactive presentation family.
- A static renderer may use presentation-only layout context where necessary, but it must keep Contributed spatially separate from owned taxonomy systems instead of making it look like another owned category.
- Direct contribution edges should remain data-model evidence, not always-on visual spokes.

The detailed static-renderer gap audit is recorded in `docs/static-svg-parity-audit-2026-08-24.md`.

## Release boundary

Stable `v1` is an immutable/reviewed release boundary, not an alias for current `main`. Visual or static-renderer fixes reach existing profile SVGs only after the reviewed release chain advances `v1` and the profile regenerates through that exact release.
