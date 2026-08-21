# Obsidian initial-viewport research

## Scope

This note closes the remaining camera/fit item from the Obsidian fidelity survey. PRs #73, #74, #75, and #77 already handled live force spawn, connectivity-derived node size, zoom-dependent text fade, and hover connection emphasis. This phase asks only whether the `obsidian` preset should automatically fit the graph bounds when it opens or resets.

## Primary product evidence

Obsidian's Graph view help documents manual graph navigation: wheel or `+`/`-` for zoom and dragging or arrow keys for pan. It documents no graph-view `Zoom to fit` command.

- https://obsidian.md/help/plugins/graph
- source mirror: https://github.com/obsidianmd/obsidian-help/blob/master/en/Plugins/Graph%20view.md

Long-running feature requests explicitly ask Obsidian to add a reset/`Zoom to fit` action. This is useful negative evidence: automatic bounds fitting is not the native baseline being requested by those users.

- https://forum.obsidian.md/t/zoom-reset-or-zoom-to-fit-in-graph-view/52593
- https://forum.obsidian.md/t/graph-view-needs-usability-improvements/68187

## Reverse-engineered implementation evidence

The 2026 `xnohat/webobsidian` project documents a reverse engineering pass over Obsidian Desktop 1.12.7 and implements the graph camera with a centered initial spawn, fixed initial device scale, and no automatic fit-to-bounds. Its `GraphView.tsx` resets the camera to the viewport center and device scale `1`, while leaving later pan/zoom under user control.

- https://github.com/xnohat/webobsidian/blob/c41967a93317b2a0f08511c349ef3dbaf78fc882/web/src/components/GraphView.tsx
- https://github.com/xnohat/webobsidian/blob/c41967a93317b2a0f08511c349ef3dbaf78fc882/IMPLEMENTATION_PLAN.md

This is corroborating reverse-engineering evidence, not an official Obsidian API contract.

## Project Map mismatch

The emitted shared Project Map viewer currently calls `rebuildLayout({ fit: true })` when graph data first loads, when the style changes, and when Reset is pressed. `rebuildLayout()` then unconditionally calls `fitView()`. For the Obsidian preset this means the deterministic compact seed and live bloom introduced in #73 are immediately reframed to the current graph bounds.

That behavior is convenient, but it hides part of the native-style opening lifecycle and couples the initial camera to graph size.

## Adopted mapping

Do **not** copy Obsidian's device-pixel scale number literally. Project Map uses a different canvas/world-unit mapping and its node renderer does not share Obsidian's exact Pixi scale law. Copying `1 / devicePixelRatio` would therefore be false precision and would make high-DPI/mobile behavior needlessly device-dependent.

Instead adopt the behavior-level contract:

- when `rebuildLayout({ fit: true })` runs for `state.style === "obsidian"`, start from Project Map's neutral camera: `zoom = 1`, `pan = {x: 0, y: 0}`;
- mark the initial camera as established so a later resize event does not silently auto-fit it;
- keep the explicit **Fit** button and `0` keyboard command wired to `fitView()`;
- Reset restores the Obsidian neutral camera rather than fitting current bounds;
- Galaxy presets keep their existing automatic fit behavior;
- do not change force geometry, node positions, search state, or gesture zoom limits.

The value `zoom = 1` is Project Map's neutral CSS-space scale, not a claim that it equals Obsidian's private device-scale constant.

## Performance decision

The original survey also listed a worker or Barnes-Hut approximation as a possible later step. That remains **not adopted**. There is no current measured 300–520-node frame-time failure justifying a force-engine rewrite. Performance architecture should change only after a reproducible frame-time/interaction Gate shows the current O(n²) runtime is the limiting factor.

## Validation

Browser evidence should require:

1. Obsidian opens at zoom `1`, zero pan, and stays there after the first resize opportunity;
2. explicit Fit still changes the camera when bounds need fitting;
3. Reset restores the neutral Obsidian camera;
4. Galaxy Classic continues to auto-fit;
5. graph node geometry is untouched by the camera policy;
6. Chromium and iPhone WebKit remain green.
