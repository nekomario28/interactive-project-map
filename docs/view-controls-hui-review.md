# Viewer controls HUI review

This note records the usability review behind the Project Map viewer-control changes. It intentionally focuses on decisions that affect implementation so the UI does not accumulate parallel control systems.

## Findings

### Repository status filtering had two different problems

The shared Galaxy / Obsidian viewer already had a working status projection for `Original`, `Fork`, and `Archived`. Its earlier browser gate verified state changes and Focus-depth composition, but it did **not** prove that a hidden repository also disappeared from normal canvas hit-testing. The regression gate now checks all three statuses directly at the rendered-node interaction boundary.

The second problem was feedback. A generated graph may legitimately contain zero repositories of a status. For example, a workflow can exclude archived repositories during collection. An enabled-looking `Archived` toggle with no archived data cannot change the map and therefore looks broken even when the filter code is correct.

The viewer now reports the count for each status and disables zero-count statuses with an explanation. Collection policy remains separate from display filtering: the viewer does not perform new GitHub API requests merely to make a disabled filter active.

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

### Preserve the mental map for status changes

Status filtering does not rebuild the layout. Hidden repositories retain their positions so toggling a status back on does not rearrange the entire graph. Focus / Local Graph is different: it intentionally rebuilds the projected subgraph because the user explicitly changed exploration scope.

### Do not fetch missing statuses from the viewer

`graph.json` is the source of truth for the current map. A zero-count status is shown as unavailable instead of silently falling back to the hosted API. This preserves the static-first architecture and keeps recurring API use inside each user's scheduled workflow.

### Clear stale interaction state

If a status change hides the currently hovered or selected repository, that interaction state is cleared. An invisible repository must not continue to produce hover emphasis or details.

## Remaining consistency gap: dedicated presets

The shared `/u/` viewer hosts Galaxy Classic, Galaxy Systems, Galaxy Hybrid, and Obsidian and now applies the repository controls correctly.

The dedicated Radial, Tree, Treemap, Timeline, Cluster, Sunburst, Matrix, and Sankey routes currently preserve semantic URL parameters when navigating between styles, but they do not render/apply the repository-status controls themselves. That makes a cross-style feature appear to disappear when the user changes visualization.

This should be fixed, but **not** by copying status logic into eight viewer runtimes.

The preferred next implementation is one shared dedicated-view projection adapter that:

1. parses the same `status` URL contract;
2. projects a sanitized `graph.json` before each dedicated layout consumes it;
3. injects the same `Repositories` common-region control into dedicated toolbars;
4. recomputes the dedicated layout from the retained source graph when a status changes;
5. keeps aggregate views (Matrix/Sankey) derived from exactly the same filtered repository set;
6. is attached to all dedicated viewers in one build/postprocess step rather than eight hand-maintained implementations.

Before implementing that adapter, a Gate must prove one fixture produces the same filtered repository IDs in every preset. This is the smallest way to make repository visibility a true Project Map feature rather than a shared-view-only feature.

## Rejected alternatives

- **Eight separate status-filter implementations:** duplicates semantics and guarantees drift.
- **A new graph/UI framework:** the existing graph and renderer paths are sufficient.
- **Re-layout on every shared-view status toggle:** breaks spatial continuity for no benefit.
- **Hide filters in a menu:** saves toolbar space at the cost of discoverability and an extra interaction.
- **Viewer-side GitHub fallback for a zero-count status:** breaks the static-first/API-budget architecture.
- **Color-only status feedback:** counts, labels, pressed state, and disabled state remain visible in addition to status colors.
