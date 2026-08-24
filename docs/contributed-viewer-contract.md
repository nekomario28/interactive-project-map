# Contributed viewer contract

Status: **production semantics proven; Galaxy presentation revised toward one-world coherence on 2026-08-25 JST**

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
6. use the distinct Contributed palette plus explicit `Contributed` text/legend/filter semantics; do not rely on a permanently drawn direct contribution line or a synthetic owned category to communicate the relation;
7. keep contributed repositories outside owned taxonomy membership. Layout-only placement is allowed but must not mutate `state.graph`.

## Galaxy presentation contract

Galaxy Classic / Systems / Hybrid use presentation-only external placement because the normal category-system motion model requires owned membership and Contributed intentionally has none.

The visual metaphor is **one galaxy with an external halo**, not a graph plus a detached external-repository panel. Contributed is semantically external but visually inhabits the same world-space scene, background, center, and motion language as the owned project galaxy.

The innermost Contributed halo must remain visually disjoint from the **swept region** of owned category systems, not merely from owned nodes at one instant. For an owned repository orbiting a category hub, the safe envelope includes:

```text
owner -> category radius + category -> repository local radius
```

All three Galaxy variants therefore use owner-centered `external-halo-orbit` placement. The first halo begins beyond the owned swept envelope with an explicit clearance margin. The hard maximum of twelve Contributed repositories is partitioned into bounded lanes when needed, and every later lane expands **outward**. A later lane must never be moved inward merely to fit the viewport.

Galaxy Systems uses a deliberately slower halo period than its local repository motion, so Contributed reads as distant orbital context rather than as another owned subsystem. Classic and Hybrid keep the same semantic geometry with style-appropriate periods. Reduced-motion preferences pause the extra halo motion.

A detached right-edge rail, fade panel, divider, or `external repositories` shelf is not part of the active Galaxy presentation contract. Such UI separation can be semantically clear but breaks the common-world metaphor and should not be used as the default Galaxy solution.

The halo geometry is presentation-only. It must not introduce a synthetic category hub, `groupId`, ownership edge, or membership edge, and it must never be serialized back into the canonical graph.

## World-coherence rule

When the surrounding visualization has a strong spatial metaphor, semantic distinction should first be expressed **inside that metaphor**. External entities can occupy outer halo space, different motion periods, and a distinct status color without being moved into a separate UI coordinate system.

Correctness constraints such as collision clearance belong in the geometry solver; they should not automatically dictate a detached visual container.

## Dedicated preset contract

Radial, Tree, Treemap, Timeline, Cluster, Sunburst, Matrix and Sankey use the same Contributed-first status semantics. Category-dependent layouts may use an explicit presentation-only external/unassigned context when required, but that context must never be serialized back into the canonical graph or counted as an owned category.

Aggregate views must keep owned repository totals semantically separate from contributed totals and must not fold Contributed into Original/Fork/Archived composition.

## Static SVG parity boundary

Static SVG renderers consume the same canonical graph and should preserve the same user-visible relation semantics:

- Contributed must not disappear merely because it has no owned `groupId`.
- Contributed must not be recolored as Original/Fork/Archived because of source flags.
- The Contributed palette and explicit legend text should match the interactive presentation family.
- Galaxy Systems uses the same owner-centered external-halo concept rather than a detached rail; subsequent halo lanes expand outward only.
- A static renderer may use presentation-only layout context where necessary, but it must keep Contributed spatially separate from owned taxonomy systems without making it look like another owned category.
- Direct contribution edges remain data-model evidence, not always-on visual spokes.

The detailed static-renderer gap audit is recorded in `docs/static-svg-parity-audit-2026-08-24.md`.

## Release boundary

Stable `v1` is an immutable/reviewed release boundary, not an alias for current `main`. Visual or static-renderer fixes reach existing profile SVGs only after the reviewed release chain advances `v1` and the profile regenerates through that exact release.
