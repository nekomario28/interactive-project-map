# Reactive cosmic background contract

Status: camera-coherent depth upgrade in progress on interactive Pages; original pan-reactive background shipped via PR #170 (2026-08-24).

## Intent

The shared Galaxy / Obsidian viewer should feel like one continuous spatial scene rather than a graph drawn over a screen-fixed star texture. Background motion is secondary interaction feedback: it must reinforce camera movement without competing with repositories, labels, or semantic edges.

This follows the earlier profile Project Map design principle that stellar decoration belongs to the same galaxy/world as the project map instead of behaving like unrelated screen-space noise.

## Camera coherence contract

- Scope remains the shared interactive `/u/` surface only. Static SVG generation and the eight dedicated viewers remain intentionally unchanged.
- Wheel input is normalized across pixel, line, and page delta modes, then capped before applying exponential zoom. This reduces device-specific jumps without adding inertial animation.
- Wheel zoom preserves the world point under the pointer.
- The interactive zoom-out floor is derived from the current scene's approximate fit zoom. The user can still explore outside the graph, but cannot shrink a normal scene into a tiny island surrounded by effectively unbounded empty space.
- The camera runtime is installed directly after `viewer.js` and owns wheel zoom through a capture listener. Existing pinch, keyboard, Fit, Reset, and node-drag behavior remain separate.

## Cosmic depth contract

- Background layers use deterministic username-seeded coordinates so redraws do not shimmer or regenerate stars.
- Stars remain wrapped across a common repeating tile. A star must not abruptly disappear simply because the camera crossed a screen boundary.
- Camera pan drives three depth layers at `0.08`, `0.18`, and `0.32` of `state.pan`.
- Camera zoom drives those same layers more weakly than graph geometry using zoom exponents `0.05`, `0.12`, and `0.22`. Near stars therefore react more strongly than mid stars, and mid more strongly than far stars, while repositories remain the dominant foreground geometry.
- Star radius grows only with the square root of each depth scale so zoom does not turn the background into visual noise.
- The subtle infinite haze remains slower than the star planes.
- A low-contrast world-anchored galaxy envelope is centered at `worldToScreen(0, 0)` and sized from the current scene radius. It creates a visual transition from galaxy body to surrounding deep space without encoding repository/category semantics.
- Galaxy-specific nucleus / system decoration remains above the cosmic base background. Script order is `viewer.js` → `camera-coherence.js` → `cosmic-background.js` → style runtimes.
- Meteors remain screen-space ambience, not graph data. At most one may be active, normal idle delay is approximately 22–56 seconds, and it is drawn inside the background pass so graph content remains visually authoritative above it.
- Hidden tabs do not keep scheduling meteors.
- Native `prefers-reduced-motion: reduce` and the existing interactive Motion Off control freeze star pan/zoom parallax and suppress meteors. The galaxy envelope still follows explicit camera geometry because otherwise it would detach from the graph world.
- Narrow/mobile viewports reduce star density rather than increasing canvas work.
- No repository/category/contribution semantics, graph layout coordinates, or static Action output are derived from the cosmic runtime.

## Verification target

The upgrade is gated at three levels:

- source tests assert wheel normalization, scene-aware zoom bounds, depth exponents, world-anchored envelope behavior, script ordering, and reduced-motion support;
- browser tests prove pointer-anchored zoom, far < mid < near depth response, world-center envelope alignment, wrapped pan continuity, meteor rendering, and reduced-motion freezing;
- the existing full Pages Verify / Chromium / WebKit gates remain required before promotion.

The reusable static Action and stable `v1` do not need promotion for this feature because their output contract does not change.
