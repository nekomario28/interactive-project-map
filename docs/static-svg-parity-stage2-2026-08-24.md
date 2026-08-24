# Static SVG Contributed parity — stage 2

Status: COMPLETE / RELEASED
Date: 2026-08-24

This stage closed the renderer-wide semantic drift identified after the Galaxy Systems repair and was promoted through the stable reusable release chain.

## Shared contract

- `relation: "contributed"` is the primary repository presentation status, above fork/archive source flags.
- Contributed uses the shared warm identity (`#E69F00` dark, `#A85D00` light).
- The canonical `contribution` graph edge remains evidence/data only and must not become an ownership-like visible spoke or a layout spring.
- Contributed repositories remain outside canonical owned category membership. Category-oriented static renderers may create presentation-only external context, but must not mutate graph `groupId` or add membership edges.
- Archived decoration must not override the Contributed presentation.

## Renderer coverage

The shared static semantics cover all twelve generated presets:

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

## Acceptance and release receipt

- Renderer-wide implementation merged in **#158** as **F `a5519222947325ff71a20309c483feba1085c718`**.
- Exact-head **Verify #741** passed 265 tests, the all-twelve-preset Contributed gate, 300-repository stress, twelve-preset comparison, Chromium and iPhone WebKit.
- Release-chain pin promotion merged in **#159** as **R `2a172c3c62e8be8138e38822f05dd48671072209`**.
- Exact-head **Verify #744** passed the full release-chain suite, twelve-preset comparison, Chromium and iPhone WebKit.
- Evidence-only **#160** remained unmerged; dedicated run **`32695676884`** proved exact reusable R resolves inner F and generated a real-profile simplified Contributed artifact with ownership/privacy invariants intact.
- Stable **`v1`** was fast-forwarded without history rewrite to R.
- `nekomario28/nekomario28` production validator was aligned to the simplified contract in **`b1e0c5fc29cc99f551caf079691e39949a6d3ae0`**.
- Production regeneration through `@v1` published **`2e9972832674cef02e30d8999e4159157edf4830`**. The graph contains 14 owned + 1 accepted Contributed repository and one canonical `contribution` evidence edge; the SVG renders that external repository with the warm orange identity and external orbit while omitting the obsolete synthetic `External contributions` hub and decorative Contributed halo.

## Closed boundary

Static Contributed parity and stable release drift are no longer active blockers. Future changes to lower-layer adapters or the dedicated Contributed animation scheduler are architecture maintenance only and must preserve this released contract plus the existing all-preset, dense-profile and browser gates.
