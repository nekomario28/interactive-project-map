# Viewer controls HUI review

This note records the usability review behind the Project Map viewer-control changes. It intentionally focuses on decisions that affect implementation so the UI does not accumulate parallel control systems.

## Findings

### Repository status filtering had two different problems

The first implementation changed status state correctly but did not reliably prove that the rendered graph changed with it. The regression gate now checks `Original`, `Fork`, and `Archived` at the actual rendered/canvas interaction boundary rather than treating internal state changes as sufficient evidence.

The second problem was feedback. A generated graph may legitimately contain zero repositories of a status. For example, a workflow can exclude archived repositories during collection. An enabled-looking `Archived` toggle with no archived data cannot change the map and therefore looks broken even when the filter code is correct.

The viewer now reports the count for each status and disables zero-count statuses with an explanation. Collection policy remains separate from display filtering: the viewer does not perform new GitHub API requests merely to make a disabled filter active.

### Empty categories must disappear with their last visible repository

A repository-status projection is a graph projection, not only a repository paint filter. If filtering removes the final visible repository from a category, leaving the category node and its owner edge behind creates an empty parent with no user-visible meaning.

All preset families therefore apply the same structural rule:

1. select the visible repository set;
2. retain only categories that still own at least one visible repository;
3. remove ownership/membership/relation edges whose endpoint was removed;
4. derive layout and aggregate views from that projected graph.

Galaxy/Obsidian perform this before the shared interactive layout. Radial, Tree, Treemap, Timeline, Cluster, Sunburst, Matrix, and Sankey use one dedicated-view projection adapter before their existing layout/render path. Dedicated renderers do not carry eight separate copies of the filtering rule.

### The toolbar had a weak information hierarchy

`Original`, `Fork`, `Archived`, `Motion`, `Activity`, Focus controls, Fit/Reset, Search, Style, and Share were visually presented as peers. They are not one task.

The adopted grouping is:

```text
Search / Style     Fit / Reset

Repositories
[ Original n ] [ Fork n ] [ Archived n ]

View
[ Motion ] [ Activity ]

Focus (contextual)     Share     visible / scope total
```

`Repositories` and `View` use separate bounded common regions. Focus remains contextual because it is meaningful only after selecting a repository.

This follows established HUI/HCI guidance:

- related controls should be visually grouped by proximity/connectedness rather than presented as an undifferentiated row;
- important/frequently used controls should not be hidden merely to make an interface look simpler, because extra reveal steps add interaction and cognitive cost;
- user actions need visible feedback, so repository counts and `visible / scope total` are shown next to the filtering controls;
- toggle-button state is kept with `aria-pressed`, which is the WAI-ARIA state intended for pressed/unpressed toggle buttons.

References:

- Nielsen Norman Group, *Connectedness: Gestalt Principle for User Interface Design*: https://www.nngroup.com/videos/connectedness-gestalt/
- Nielsen Norman Group, *Why Zen Mode Isn’t the Answer to Everything*: https://www.nngroup.com/articles/zen-mode/
- Nielsen Norman Group, *Animation for Attention and Comprehension*: https://www.nngroup.com/articles/animation-usability/
- W3C WAI, ARIA5 / toggle-button state: https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA5
- WAI-ARIA 1.2, `aria-pressed`: https://www.w3.org/TR/wai-aria/#aria-pressed

## Adopted implementation constraints

### Keep `aria-pressed`; do not rewrite the controls as a second form system

These are immediate visibility toggles in a graph toolbar. The existing native `<button>` elements plus `aria-pressed` already expose their state. Replacing them with a separate checkbox form would add markup, CSS, event paths, and migration risk without changing the underlying selection semantics.

### Keep filters directly available

Do not move repository visibility into an overflow menu, drawer, modal, or settings dialog. Filtering is a primary exploration action and should remain one interaction away.

### Status filtering projects structure, not only paint

The current shared path applies repository status before layout and then draws Activity after the runtime-specific renderer. The dedicated path projects the fetched static graph before its existing renderer consumes it. This is intentional: a hidden repository must not keep an empty category, ownership edge, aggregate Matrix cell, or Sankey flow alive.

The shared status change uses a bounded rebuild with `fit: false`, so filtering changes graph structure without forcing a camera reset. Focus / Local Graph remains a separate scope projection and can intentionally rebuild/fit when the user changes focus scope.

### Do not fetch missing statuses from the viewer

`graph.json` is the source of truth for the current map. A zero-count status is shown as unavailable instead of silently falling back to the hosted API. This preserves the static-first architecture and keeps recurring API use inside each user's scheduled workflow.

### Clear stale interaction state

If a status change hides the currently hovered or selected repository, that interaction state is cleared. An invisible repository must not continue to produce hover emphasis or details.

### Keep Activity scoped to node-based shared views

Activity/Freshness is currently a repository-node overlay for Galaxy Classic, Galaxy Systems, Galaxy Hybrid, and Obsidian. It uses the existing `updatedAt` / `generatedAt` timestamps and requires no additional GitHub API request.

Do **not** add an Activity control to Radial, Tree, Treemap, Timeline, Cluster, Sunburst, Matrix, or Sankey merely for toolbar symmetry. Several of those views aggregate repositories or encode a different hierarchy, so the same ring overlay has no clear equivalent meaning. The `activity` URL state may remain preserved while navigating styles so it resumes when returning to a supported shared view.

A dedicated-view Activity encoding should be added only if a preset-specific representation has a clear user task and measured value.

## Cross-style status consistency — resolved

Repository status filtering is now a Project Map feature across all twelve presets:

- shared `/u/`: Galaxy Classic, Galaxy Systems, Galaxy Hybrid, Obsidian;
- dedicated routes: Radial, Tree, Treemap, Timeline, Cluster, Sunburst, Matrix, Sankey.

One fixture is gated across all dedicated routes, and real-canvas gates cover the shared path. Zero-child categories are pruned rather than rendered as empty parents.

The shared and dedicated integrations remain separate because their integration boundaries differ: shared views compose an in-memory status projection with Focus before layout, while dedicated views project the static graph at the fetch boundary and reload from shareable URL state. Creating another browser runtime only to share a short filter function would add more wiring than it removes. Common semantics are enforced by the cross-preset gates instead.

## Feature-freeze guidance

The current v1 viewer-control set is sufficient for normal portfolio exploration. New hierarchy layers, renderer-wide controls, or graph frameworks should not be added by default.

The large-portfolio local-cluster experiment in issue #61 / PR #108 is a measured NO-GO: no tested global threshold from 0.72 through 0.90 made either deterministic candidate pass the 80/150/300 repository clear+blurred promotion gates. Existing standard taxonomy plus Local Graph focus remains the lower-complexity baseline.

For v1, prefer:

- real user-reported UX fixes;
- accessibility/readability fixes;
- correctness and regression gates;
- installer/release reliability;
- removal of duplicated implementation paths.

Do not add a feature merely because another visualization product has it. Promotion should require a concrete user task or measured improvement over the existing controls.

## Rejected alternatives

- **Eight separate status-filter implementations:** duplicates semantics and guarantees drift.
- **A new graph/UI framework:** the existing graph and renderer paths are sufficient.
- **A new common runtime solely to share the short status projection helper:** the shared and dedicated integration points differ; cross-preset semantic gates provide the useful common contract without another script/build layer.
- **Hide filters in a menu:** saves toolbar space at the cost of discoverability and an extra interaction.
- **Viewer-side GitHub fallback for a zero-count status:** breaks the static-first/API-budget architecture.
- **Color-only status feedback:** counts, labels, pressed state, and disabled state remain visible in addition to status colors.
- **Activity on every preset for symmetry:** aggregate/hierarchy views need a task-specific encoding rather than a copied repository-node ring.
