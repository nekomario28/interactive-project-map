# Camera/background zoom coherence research — 2026-08-25

Status: evidence-backed design input for the shared interactive `/u/` camera/background runtime.

## Problem observed

The foreground camera already performs pointer-anchored zoom: the world point under the wheel pointer is re-anchored to the same screen point after scale changes. The original cosmic background instead centered star/haze scaling on the viewport center while applying pan separately. That gave foreground geometry and background depth cues different zoom centers.

A first repair replaced the independent pan/zoom coefficients with one absolute fractional camera transform. It passed a one-shot off-center zoom browser proof, but a stronger sequential test exposed a remaining defect: after one zoom, an intervening pan, and a second zoom around the same visible near star, the star drifted `3.361777501284678 px` against a `<0.75 px` contract. Absolute fractionalization therefore does not compose when the camera fixed point changes between interactions.

## Phase 1 — Zoomable interfaces / HCI

Pad++ treats zoom as navigation and centers zoom on the cursor so the user controls the point being approached. Its multiscale work also emphasizes continuous viewpoint changes because jumpy or contradictory motion weakens spatial orientation.

Sources:

- Ben Bederson et al., Pad++ zoomable-interface work: https://www.sciencedirect.com/science/article/pii/S1045926X96900026
- Pad++ cursor-centered interaction description: https://www.researchgate.net/publication/220578893_Pad_A_Zoomable_Graphical_Sketchpad_For_Exploring_Alternate_Interface_Physics
- HCIL Pad++ multiscale notes: https://www.cs.umd.edu/projects/hcil/pad%2B%2B/papers/chi-94-pad/index.html

IPM implication: foreground and depth cues may move by different amounts, but they should share the interaction focal point.

## Phase 2 — Information visualization transforms

D3 zoom models a view as one scale-plus-translation transform. `translateTo`, `scaleBy`, and point-aware transforms make the reference point explicit, and transform order is material.

Source:

- D3 zoom: https://d3js.org/d3-zoom

IPM implication: parallax should be derived from camera transforms, not from separately invented pan and zoom effects.

## Phase 3 — Game-camera parallax

Godot documents parallax as camera-relative movement scaled by depth: a `scroll_scale` below `1` makes a layer move more slowly than the camera and read as farther away.

Source:

- Godot 2D Parallax: https://docs.godotengine.org/en/stable/tutorials/2d/2d_parallax.html

IPM implication: each decorative cosmic plane should have one depth coefficient that weakens the same camera movement.

## Phase 4 — Motion/accessibility

Large panning/scaling motion can be a vestibular trigger. `prefers-reduced-motion` provides an explicit user preference for reducing non-essential motion.

Source:

- MDN `prefers-reduced-motion`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion

IPM implication: reduced-motion freezes decorative star/haze parallax and suppresses meteors. The world-anchored galaxy envelope still follows explicit camera geometry because detaching it would break spatial correctness.

## Phase 5 — Interruptible / changing-target navigation

Reach and North treat target changes during smooth zoom/pan as a first-class navigation problem rather than assuming one fixed target throughout an interaction.

Source:

- Andrew Reach and Chris North, *Smooth, Efficient, and Interruptible Zooming and Panning*: https://arxiv.org/abs/1801.09358

IPM implication: wheel/pinch navigation is a sequence of transforms whose anchor can move between events. A background model that is correct only from the identity camera to one fixed point is insufficient.

## Phase 6 — Mapping / scene-rendering ownership

Mapbox exposes an `around` location that stays at the same screen position across camera changes. Cesium models a star field as a sky primitive around the scene instead of ordinary world geometry.

Sources:

- Mapbox GL JS `CameraOptions.around`: https://docs.mapbox.com/mapbox-gl-js/api/properties/
- Cesium `SkyBox`: https://cesium.com/learn/cesiumjs/ref-doc/SkyBox.html

IPM implication: coordinate ownership should be deliberate. Repository geometry and the diffuse galaxy envelope are world-relative; stars/haze are camera-relative depth cues; meteors are screen-space events.

## Synthesis — compose fractional camera deltas

The viewer renders world geometry around the viewport center:

```text
screen = viewportCenter + zoom * world + pan
```

For consecutive camera states `C0` and `C1`, work in center-relative screen coordinates:

```text
centered = screen - viewportCenter
ratio = zoom1 / zoom0
deltaPan = pan1 - ratio * pan0
Delta(centered) = ratio * centered + deltaPan
```

The implementation stores the equivalent values through `origin = viewportCenter + pan`, so the center-relative translation is computed as:

```text
deltaX = origin1.x - ratio * origin0.x + (ratio - 1) * viewportCenter.x
deltaY = origin1.y - ratio * origin0.y + (ratio - 1) * viewportCenter.y
```

For a background plane with `0 < depth < 1`, weaken **that camera delta**:

```text
depthScale = ratio ^ depth
translationFactor =
  depth                                      when ratio ~= 1
  (depthScale - 1) / (ratio - 1)            otherwise

depthDelta(centered) =
  depthScale * centered
  + deltaPan * translationFactor
```

Then compose each new `depthDelta` onto the plane's accumulated affine transform in interaction order.

This yields the required behavior:

1. pure pan becomes `panDelta * depth`;
2. a zoom delta preserves the same fixed screen point as the foreground delta while scaling less strongly;
3. a later zoom may use a different fixed point without discarding earlier pan/zoom history;
4. transform order matches the actual interaction sequence rather than reconstructing an incompatible absolute pose.

The depth pose is intentionally path-dependent: it represents the camera movements the user actually made. Viewport resize is a rebase rather than navigation, so star/haze depth transforms reset at the new viewport geometry.

## Coordinate ownership

- **Repository nodes / graph geometry:** full world camera transform.
- **Diffuse galaxy envelope:** full world camera transform through `worldToScreen(0, 0)`; it describes the graph's world-space body.
- **Stars / haze:** accumulated fractional camera deltas, one depth coefficient per plane.
- **Meteors:** screen-space events independent of graph camera motion.
- **Reduced motion:** decorative depth transforms reset/freeze while explicit world geometry stays coherent.

## Implementation boundary

- Shared interactive `/u/` only.
- Preserve deterministic wrapped stars, sparse haze, world-anchored galaxy envelope and meteor behavior.
- Far/mid/near star depth coefficients stay `0.08 / 0.18 / 0.32`; haze stays `0.035`.
- Do not alter graph semantics, dedicated viewers, static SVG output or stable `v1`.
- Do not add inertial zoom merely to hide transform errors; geometric coherence comes first.

## Verification contract

Browser evidence must cover more than one identity-origin zoom:

1. ordinary pan moves each depth plane by its expected weaker amount;
2. a first off-center zoom preserves the chosen foreground/depth fixed point;
3. after a zoom and intervening pan, a second zoom around the star's new location keeps the same star within sub-pixel tolerance;
4. far/mid/near layers preserve ordered depth response;
5. the galaxy envelope remains world-anchored;
6. reduced-motion freezes decorative star/haze depth motion and suppresses meteors;
7. Chromium and iPhone WebKit pass on the exact final head.

The sequential-anchor regression is the discriminator: before delta composition it failed deterministically at `3.361777501284678 px` horizontal drift against the `<0.75 px` contract.
