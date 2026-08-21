# Obsidian-like runtime research

## Scope

This note records the evidence used to refine the `obsidian` preset, with emphasis on initial spawn, force-simulation lifecycle, dragging, node sizing, and label visibility. The goal is not to copy undocumented Obsidian internals blindly; it is to keep the recognizable interaction model while avoiding known initialization defects that do not add user value.

## Primary evidence

### Obsidian Help

Obsidian documents four graph forces: center force, repel force, link force, and link distance. It also exposes a text-fade threshold, node-size multiplier, link-thickness control, arrows, filtering, and color groups. The official help states that nodes referenced by more nodes become bigger and that hovering a circle highlights that note's connections.

- https://obsidian.md/help/plugins/graph

Implication: the current Project Map separation between visual node type and one global force system is directionally correct, but Obsidian-specific text fading, connectivity-driven sizing, and incident-link hover emphasis deserve separate treatment from the Galaxy presets.

### Graph Spawn (`tjqscott/obsidian-graph-spawn`)

Graph Spawn is an MIT-licensed 2026 Obsidian plugin that inspects the current internal graph worker protocol. Its implementation documents that unseen Obsidian graph nodes are created at `(0, 0)` with zero velocity and that the worker accepts a complete map of supplied initial positions. It uses union-find over the links currently drawn, seeds disconnected components apart, and then lets Obsidian's own simulation continue with alpha `0.6`.

- Repository: https://github.com/tjqscott/obsidian-graph-spawn
- License: MIT
- Relevant file: `main.js`

Useful ideas:

- initialization is a first-class part of force-layout quality;
- live force settling should happen after spawn instead of hiding all settling behind a static pre-pass;
- deterministic seeding makes graph changes visually attributable instead of adding random reshuffles;
- component-aware seeding is useful when the rendered graph truly has disconnected components;
- the observed worker's origin spawn is an implementation detail that can be improved without replacing Obsidian's force law.

Not copied wholesale:

- Project Map's structural owner/category edges normally make the Obsidian preset one connected component, so a component ring often adds no value here;
- the plugin's large component-disc seed intentionally minimizes Obsidian's opening motion, whereas this preset should retain visible live settling;
- copying the raw `(0, 0)` spawn exactly caused a practical regression in Project Map: after only three warm-up ticks a four-node browser fixture still reached roughly 46 world-units/frame, making nodes escape click coordinates between pointer targeting and pointer-down and making initial fit bounds expand sharply after paint.

The final Project Map adaptation therefore uses a smaller deterministic phyllotaxis-like seed with area scaling approximately as `sqrt(nodeCount)`, then hands it to the same live force lifecycle at alpha `0.6`. This keeps the useful part of Graph Spawn's discovery—seed first, then let the native-style forces run—without importing its component layout or Obsidian's origin-collision defect.

### Persistent Graph (`Sanqui/obsidian-persistent-graph`)

Persistent Graph is MIT-licensed and uses Obsidian's internal renderer worker to save/restore node positions, pin nodes through `forceNode`, and explicitly run or stop the simulation using `run`, `alpha`, and `alphaTarget` messages.

- https://github.com/Sanqui/obsidian-persistent-graph
- Relevant file: `src/graphManager.ts`

This corroborates that Obsidian's graph should be treated as a live simulation lifecycle rather than a one-time static layout.

### D3 force simulation

Obsidian's graph worker is reported by Graph Spawn to use d3-force. D3's public contract is also a useful behavior reference:

- simulations start automatically;
- alpha cools toward zero and stops at a minimum;
- `restart()` / alpha changes are intended for interaction such as node dragging;
- default d3-force reaches its natural stop after roughly 300 ticks;
- fixed coordinates (`fx`, `fy`) and velocity reset are the normal drag/pin mechanisms;
- when positions are unspecified d3 itself uses deterministic phyllotaxis, although the observed Obsidian wrapper explicitly initializes unseen nodes at the origin.

- https://d3js.org/d3-force/simulation

## Adjacent / older graph-layout research

### Fruchterman-Reingold (1991)

The classic force-directed paper treats initial placement and cooling as explicit algorithm inputs and normally begins with a non-final configuration. It also calls out the coincident-node case and symmetry-breaking displacement.

- https://reingold.co/force-directed.pdf

### ForceAtlas2 (2014)

ForceAtlas2 is designed as a continuous interactive layout and combines gravity, repulsion, attraction, adaptive speed, and optional Barnes-Hut approximation. The paper is useful for performance and convergence decisions, but adopting ForceAtlas2 would change the visual semantics away from Obsidian's d3-force model.

- https://doi.org/10.1371/journal.pone.0098679

Decision: do not replace the Obsidian force law with ForceAtlas2. Revisit Barnes-Hut or a worker only if measured frame cost near the repository limit demands it.

### Yifan Hu multilevel layouts

Multilevel graph drawing uses coarse layouts as initial conditions for progressively finer graphs. This is valuable for much larger graphs but unnecessary for the current Project Map scale and would make an Obsidian-like preset less faithful.

## Additional Obsidian ecosystem evidence

The MIT `CalfMoon/node-factor` plugin and older Obsidian implementation observations both treat graph-node weight as link-derived and allow forward/backward link weights to influence size. This reinforces that GitHub star count should not remain the Obsidian preset's visual importance signal.

- https://github.com/CalfMoon/node-factor
- https://forum.obsidian.md/t/graph-view-allow-to-configure-how-the-node-size-is-calculated/4247

Obsidian's text-fade threshold really does remove labels progressively when zooming out. Community discussion repeatedly describes the resulting map-like behavior: overview labels disappear, then return as the view approaches nodes. This is useful evidence for a later Obsidian-only label policy, but it must not reuse the removed Project Map motion-fade behavior; visibility should depend on scale/importance, not on whether the camera moved by one pixel.

- https://obsidian.md/help/plugins/graph
- https://forum.obsidian.md/t/graph-view-show-note-titles-even-when-zoomed-out/22510
- https://forum.obsidian.md/t/graph-text-fade-threshold-consider-node-size/6737

## Current Project Map gaps

Before this research pass, `public-obsidian-runtime.js` did the following on every rebuild:

1. deterministic wide scatter;
2. run 120 force steps synchronously before first paint;
3. zero every velocity;
4. present the graph as already settled with runtime alpha `0`.

Consequences:

- the characteristic Obsidian-style live spawn is completely hidden;
- opening cost is front-loaded into a synchronous O(n²) pre-settle;
- the subtitle says `settled at rest` even though real Obsidian treats graph layout as a live simulation;
- drag behavior is live and reheats correctly, but initial-load behavior follows a different lifecycle.

A second mismatch is intentionally deferred: Obsidian node size is connectivity-weighted, while the current Project Map Obsidian repository radius still depends on GitHub stars. Obsidian also exposes a text-fade threshold and highlights incident connections on hover, while the shared Project Map renderer currently follows its own rules.

## Adopted phase 1: live spawn lifecycle

Implement the smallest behavior correction first:

1. replace the wide pre-settled layout with a compact deterministic seed;
2. scale seed area with node count so future repository growth does not immediately collapse initial density;
3. start the live runtime at alpha `0.6` with no synchronous force warm-up or hidden convergence pass;
4. continue cooling on screen until naturally settled;
5. keep drag-to-reheat and release-to-settle behavior;
6. expose a read-only runtime snapshot for browser regression gates;
7. preserve graph data, node/edge styling, search behavior, and non-Obsidian presets;
8. require generic click/selection contracts to remain usable during the live spawn rather than weakening those tests or forcing users to wait for settlement.

This intentionally reproduces the Obsidian-style live simulation lifecycle, not the worker's pathological all-at-origin initial condition.

## Deferred phase 2

After phase 1 is browser-green and visually inspected, evaluate separately:

- connectivity/degree-based Obsidian node sizing instead of stars;
- Obsidian-style zoom text-fade threshold, with selected/hovered/search labels exempt;
- hover emphasis of incident links and neighboring nodes;
- default initial zoom / fit behavior against real Obsidian screenshots;
- a worker or Barnes-Hut approximation only if measured 300–520 node frame time requires it.

Keeping these in separate changes makes regressions attributable and avoids turning one fidelity pass into a renderer rewrite.
