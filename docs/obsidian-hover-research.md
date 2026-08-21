# Obsidian hover-emphasis research

## Scope

This note records phase 2C of the Obsidian fidelity pass. PR #73 corrected the live force lifecycle, #74 moved repository size from GitHub stars to visible graph connectivity, and #75 replaced the hard label cutoff with zoom-only fading. This phase only addresses what becomes visually prominent while the pointer hovers a graph node.

## Evidence

Obsidian's Graph view documentation states that hovering a node highlights that note's connections. The existing Project Map selected-node contract already has the same useful focus semantics: incident edges stay prominent and nodes outside the selected node's immediate visible neighborhood are dimmed.

- https://obsidian.md/help/plugins/graph

The Project Map semantic-edge layer already uses `state.selected || state.hovered` as its focus source, so semantic relations are already hover-aware and should not be reimplemented.

## Reuse decision

Do not introduce a second set of hover opacity constants. For the Obsidian preset only, and only when there is no persistent selection, the hover adapter temporarily presents the hovered node to the existing selected-focus renderer while a synchronous node-opacity or edge-draw call runs. A `try/finally` restores the real selection immediately afterward.

Consequences:

- structural and explicit relation edges inherit the already-tested selected-focus emphasis;
- semantic edges continue through the existing semantic layer;
- direct neighbors inherit the selected-neighborhood node opacity policy;
- non-neighbors are dimmed by the existing policy rather than a duplicate formula;
- if a real selection exists, hover has no effect on focus priority;
- Galaxy presets delegate directly to the existing renderer;
- no graph geometry, simulation alpha, taxonomy, search matching, or persistent selection state changes.

## Why not duplicate the renderer

Copying the shared edge renderer into the Obsidian runtime would create a second source of truth for relation opacity, query dimming, selection dimming, dash patterns, and future fixes. Reusing the selected-focus contract keeps hover behavior aligned automatically with the existing interaction model and with the semantic-edge wrapper installed later by interaction polish.

## Validation

Browser evidence uses one hovered repository with three different visible neighbor types: category membership, an explicit relation, and a semantic relation. It checks that these neighbors stay prominent while an unrelated node dims, that non-incident structural edges visibly dim, and that the real `state.selected` value remains unchanged after drawing. A second check sets a real selection and proves that adding hover does not change the selected rendering result. Galaxy Classic remains unaffected by hover-only focus.
