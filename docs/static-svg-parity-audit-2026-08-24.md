# IPM / static SVG Contributed parity audit — 2026-08-24

Status: **ACTIVE CORRECTNESS AUDIT**

## Scope

Compare the production-proven interactive Project Map Contributed contract with every generated static SVG family and with the stable `v1` artifact path used by profile repositories.

Canonical relation semantics:

- external repository keeps full `owner/repo` identity;
- `relation: contributed` is primary display status before fork/archive source flags;
- canonical graph may contain a direct `user -> repository` `contribution` edge as evidence;
- no owned `groupId`, ownership edge or membership edge may be fabricated;
- presentation should use the Contributed palette plus explicit text, not an always-on direct contribution spoke or decorative halo.

## Confirmed release drift

Current `main` and stable `v1` are not visually equivalent.

- `main` Galaxy-family palette: dark `#E69F00`, light `#A85D00`.
- stable `v1` Galaxy-family palette still uses cyan `#55c7d7` / `#238c98`.
- the canonical profile `nekomario28/nekomario28/project-map/galaxy.svg` was generated through stable `@v1`, so the currently published Contributed node is still cyan.

This is expected release-ref behavior, not evidence that `main` failed to change. Existing profile SVGs change only after a reviewed `v1` advancement and regeneration.

## Renderer audit

| Static renderer | Contributed node retained? | Primary status correct? | Layout/edge issue | Current action |
| --- | --- | --- | --- | --- |
| Galaxy Systems | Yes via a synthetic presentation group | Yes on `main` | Synthetic `External contributions` category hub differs from interactive owner-centered orbit | **Fix in progress on `fix/static-contributed-parity`** |
| Galaxy Hybrid | No in normal animated path when no owned `groupId` | N/A when omitted | `groupMembers()` only visits owned groups | **Needs parity fix** |
| Galaxy Classic / generic Galaxy | Can be omitted by group-based layouts | Generic `statusOf()` lacks Contributed | Generic renderer also lacks Contributed legend; non-systems edge path can render contribution as an ordinary line | **Needs shared-core fix** |
| Obsidian static | Node participates because force layout consumes all nodes | Generic `statusOf()` lacks Contributed | Direct contribution edge is treated like an ordinary non-relation edge | **Needs shared-core fix** |
| Radial | Yes through unassigned fallback | **No** — fork/archive/original wins | Direct `contribution` edge is drawn as a normal line; archived Contributed gets archived ring | **Needs status/edge fix** |
| Tree | Yes through `Other` fallback | **No** | Presentation-only `Other` structural branch can obscure external semantics; archived Contributed gets archived ring | **Needs external/status fix** |
| Treemap | Yes through `Other` bucket | **No** | Contributed can look like an owned miscellaneous group and inherits fork/archive styling | **Needs external/status fix** |
| Timeline | **No** | N/A when omitted | Only owned group members receive lanes | **Needs external lane + status fix** |
| Cluster | **No** | N/A when omitted | Only owned group members receive clusters | **Needs external cluster + status fix** |
| Sunburst | **No** | N/A when omitted | Only owned group bundles contribute to ring total | **Needs external sector + status fix** |
| Matrix | **No** | N/A when omitted | Rows are owned groups only; status composition has only three buckets | **Needs external row + fourth bucket** |
| Sankey | **No** | N/A when omitted | Bundles are owned groups only; status nodes have only three buckets | **Needs external flow + fourth bucket** |

## Highest-impact inconsistency

The currently published profile uses **Galaxy Systems**, so the first repair is to align that renderer with the interactive Galaxy contract:

- remove the synthetic `External contributions` group hub;
- keep Contributed directly on owner-centered presentation-only outer lanes;
- retain orange Contributed identity and explicit legend;
- render no direct contribution spoke;
- do not mutate canonical `groupId`/membership.

A focused regression test freezes this behavior before any release movement.

## Shared-core repair boundary

Do not patch the remaining static renderers with unrelated ad-hoc semantics. The next implementation phase should introduce or reuse one shared static Contributed presentation boundary for:

1. relation-first status (`contributed` before archived/fork);
2. shared dark/light Contributed colors;
3. shared legend composition;
4. presentation-only external/unassigned layout buckets;
5. suppression of direct `contribution` edges from ordinary structural-line rendering;
6. source-flag decoration rules so archived/fork metadata does not visually override Contributed;
7. aggregate fourth-bucket accounting for Matrix/Sankey and any other status-composition view.

Renderer geometry can remain style-specific. The semantic projection should not.

## Release gate

Do not fast-forward stable `v1` merely because `main` contains the visual fix.

Required before release movement:

1. exact-head unit/static SVG checks;
2. twelve-preset static comparison proving Contributed is not dropped or misclassified in the styles touched by the release;
3. Chromium/WebKit interactive gates remain green;
4. exact reusable-workflow proof on a real profile;
5. only then advance `v1` and verify the canonical profile regenerated SVG/graph pair.

Until this gate is complete, the published cyan profile SVG is classified as **known release drift**, not silently treated as current-main output.
