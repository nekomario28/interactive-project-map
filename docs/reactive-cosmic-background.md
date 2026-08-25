# Reactive cosmic background contract

Status: camera-coherent depth contract implemented for the shared interactive Pages viewer; original pan-reactive background shipped via PR #170 (2026-08-24).

## Intent

The shared Galaxy / Obsidian viewer should feel like one continuous spatial scene rather than a graph drawn over a screen-fixed star texture. Background motion is secondary interaction feedback: it must reinforce camera movement without competing with repositories, labels, or semantic edges.

This follows the earlier profile Project Map design principle that stellar decoration belongs to the same galaxy/world as the project map instead of behaving like unrelated screen-space noise.

## Camera coherence contract

- Scope remains the shared interactive `/u/` surface only. Static SVG generation and the eight dedicated viewers remain intentionally unchanged.
- Wheel input is normalized across pixel, line, and page delta modes, then capped before applying exponential zoom. This reduces device-specific jumps without adding inertial animation.
- Wheel zoom preserves the world point under the pointer unless the scene guard would otherwise allow the graph to become effectively lost off-screen.
- The interactive zoom-out floor is derived from the current scene's approximate fit zoom. The user can still explore outside the graph, but cannot shrink a normal scene into a tiny island surrounded by effectively unbounded empty space.
- The interactive pan guard is derived from the current scene bounds and viewport. Base viewer pan ownership remains unchanged; while dragging empty space beyond the guard the camera applies bounded elastic resistance, then settles to the hard guard when the pointer interaction ends.
- The pan guard keeps part of the graph scene inside a central viewport band instead of allowing an unbounded drift into empty background. It is a camera usability boundary only and does not alter node positions, graph semantics, Fit, Reset, or repository drag behavior.
- Wheel, keyboard zoom, and pinch post-bounding also settle pan inside the same scene guard so zooming a previously displaced view cannot strand the graph outside the usable viewport.
- The camera runtime is installed directly after `viewer.js`. It owns wheel and `+ / −` keyboard zoom through capture listeners and post-bounds the base viewer's pinch transform around the pinch midpoint, so all three zoom paths share the same scene-aware limits.
- Fit, Reset, node drag, and the primary ordinary-pan transform remain owned by the base viewer.

## Cosmic depth contract

- Background layers use deterministic username-seeded coordinates so redraws do not shimmer or regenerate stars.
- Stars remain wrapped across a common repeating tile. A star must not abruptly disappear simply because the camera crossed a screen boundary.
- Each star plane has one depth coefficient: far `0.08`, mid `0.18`, near `0.32`. The same depth weakens both pan and zoom instead of composing two unrelated camera responses.
- Cosmic planes keep one persistent affine transform per depth. The initial camera is fractionalized once; every later foreground camera delta is fractionalized and composed onto the existing layer transform. Layer scale still resolves to `zoom ^ depth`, while translation follows the actual gesture sequence rather than being reconstructed from one absolute pan/zoom pair.
- Pointer-anchored zoom therefore keeps the active focal point across repositories and cosmic depth layers even after previous pans or zooms changed the camera fixed point. A later zoom anchor must not inherit drift from an earlier anchor.
- Star radius grows only with the square root of each depth scale so zoom does not turn the background into visual noise.
- The subtle infinite haze uses the same sequential fractional-camera composition at depth `0.035`, remaining slower than the star planes.
- A low-contrast world-anchored galaxy envelope is centered at `worldToScreen(0, 0)`. Its world radius is captured once per graph/style scene so live force/orbit motion cannot make the background breathe or pulse.
- The galaxy body uses diffuse gradients plus a small deterministic field of low-opacity dust points. It intentionally avoids a literal elliptical ring/arc, which read as decorative geometry rather than spatial depth in rendered browser evidence.
- The envelope creates a visual transition from galaxy body to surrounding deep space without encoding repository/category semantics.
- Galaxy-specific nucleus / system decoration remains above the cosmic base background. Script order is `viewer.js` → `camera-coherence.js` → `cosmic-background.js` → style runtimes.
- Meteors remain screen-space ambience, not graph data. At most one may be active, normal idle delay is approximately 22–56 seconds, and it is drawn inside the background pass so graph content remains visually authoritative above it.
- Hidden tabs do not keep scheduling meteors.
- Native `prefers-reduced-motion: reduce` and the existing interactive Motion Off control freeze star pan/zoom parallax and suppress meteors. The galaxy envelope still follows explicit camera geometry because otherwise it would detach from the graph world.
- Narrow/mobile viewports reduce star density rather than increasing canvas work.
- No repository/category/contribution semantics, graph layout coordinates, or static Action output are derived from the cosmic runtime.

## Verification contract

The upgrade is gated at three levels:

- source tests assert wheel normalization, shared wheel/pinch/keyboard bounds, scene-aware zoom limits, scene-aware pan limits, elastic overscroll plus hard settle, the fractional camera-depth transform, stable world-anchored envelope behavior, diffuse dust rather than an explicit arc, script ordering, and reduced-motion support;
- browser tests prove pointer-anchored zoom, a visible depth star remaining fixed when used as an off-center zoom anchor, the same star remaining fixed under a second anchor after an intervening pan, elastic pan resistance and post-interaction containment, far < mid < near depth response, world-center envelope alignment, wrapped pan continuity, actual canvas brightness for the diffuse galaxy body, stable envelope radius under live node movement, meteor rendering, and reduced-motion freezing;
- the existing full Pages Verify, twelve-preset comparison, Chromium, and iPhone WebKit gates remain required before promotion.

The reusable static Action and stable `v1` do not need promotion for this feature because their output contract does not change.
