# Static SVG Contributed parity — stage 2

Status: IMPLEMENTED / CI PENDING
Date: 2026-08-24

This stage closes the renderer-wide semantic drift identified after the Galaxy Systems repair.

## Shared contract

- `relation: "contributed"` is the primary repository presentation status, above fork/archive source flags.
- Contributed uses the shared warm identity (`#E69F00` dark, `#A85D00` light).
- The canonical `contribution` graph edge remains evidence/data only and must not become an ownership-like visible spoke or a layout spring.
- Contributed repositories remain outside canonical owned category membership. Category-oriented static renderers may create presentation-only external context, but must not mutate graph `groupId` or add membership edges.
- Archived decoration must not override the Contributed presentation.

## Renderer coverage

The shared static semantics now cover all twelve generated presets:

- Radial
- Galaxy Classic
- Galaxy Systems
- Galaxy Hybrid
- Obsidian
- Tree
- Treemap
- Timeline
- Cluster / Bubble
- Sunburst
- Matrix / Heatmap
- Sankey

Matrix and Sankey expose Contributed as a fourth status bucket. Tree/Treemap/Timeline/Cluster/Sunburst/Matrix/Sankey use presentation-only external context where a category/lane/aggregate container is structurally required.

## Regression gate

`tests/static-contributed-all-presets.test.mjs` uses a C2-shaped external repository that is simultaneously `fork: true` and `archived: true` and asserts:

- Contributed status wins;
- every static preset retains explicit Contributed semantics and the warm color;
- repository-oriented presets retain full `owner/repo` identity;
- the output is byte-identical with vs. without the canonical direct `contribution` edge;
- Matrix/Sankey expose the fourth bucket;
- Galaxy-family static presets keep Contributed outside owned category membership.

## Release boundary

Do not move stable `v1` from its currently proven release until this branch has exact-head Verify, browser gates, and a real contributed reusable-workflow/profile proof. After that proof, advance `v1` and regenerate the canonical profile SVG so the public artifact no longer reflects the stale cyan release.
