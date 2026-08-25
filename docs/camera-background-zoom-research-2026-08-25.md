# Camera/background zoom coherence research — 2026-08-25

Status: evidence-backed design input for the shared interactive `/u/` camera/background runtime.

## Problem observed

The foreground camera already performs pointer-anchored zoom: the world point under the wheel pointer is re-anchored to the same screen point after scale changes. The original cosmic background combined two different coordinate rules:

- star/haze scale was centered on the viewport center;
- raw screen-space `state.pan` was added before that scale, so the pan contribution was itself multiplied by the depth zoom scale;
- the galaxy envelope was world-anchored through `worldToScreen(0, 0)`.

That meant an off-center zoom could keep repository geometry stable under the pointer while the star/haze planes slid in a different coordinate frame. The effect was especially visible because zoom re-anchoring changes both `state.zoom` and `state.pan` at once.

A first repair replaced the independent pan/zoom coefficients with an absolute fractional camera transform. Browser evidence proved that repair for one off-center zoom from the identity camera. A stronger sequential test then exposed a second defect: after a zoom and an intervening pan, zooming again around the star's new location moved that star by `3.361777501284678 px`. The absolute fractionalization is therefore not compositional when the camera fixed point changes.

## Phase 1 — Zoomable-interface / HCI evidence

Pad++ treated zoom as a navigation primitive and explicitly centered zoom on the cursor so the user could dynamically control the point being approached. Its later multiscale work also emphasized smooth, continuous viewpoint changes because rough/jumpy zoom can be disorienting and weaken spatial orientation.

Sources:

- Ben Bederson et al., Pad++ zoomable-interface work: https://www.sciencedirect.com/science/article/pii/S1045926X96900026
- Pad++ interaction description / cursor-centered zoom: https://www.researchgate.net/publication/220578893_Pad_A_Zoomable_Graphical_Sketchpad_For_Exploring_Alternate_Interface_Physics
- HCIL Pad++ multiscale notes: https://www.cs.umd.edu/projects/hcil/pad%2B%2B/papers/chi-94-pad/index.html

Implication for IPM: the interaction focal point should remain one coherent spatial point across foreground and depth cues. A background layer may move less than the foreground, but it should not invent a second zoom center.

## Phase 2 — Information-visualization transform evidence

D3 zoom represents a view as one scale-plus-translation transform. Its `translateTo` and `scaleBy` APIs make the reference point explicit, and the Canvas guidance emphasizes that transform order matters.

Source:

- D3 zoom: https://d3js.org/d3-zoom

Implication for IPM: depth should be derived from camera transforms, not from unrelated pan and zoom effects composed in different orders.

## Phase 3 — Game-camera / parallax evidence

Godot documents parallax as camera-relative movement scaled by depth: a scroll scale below `1` makes a layer move more slowly than the camera and therefore read as farther away.

Source:

- Godot 2D Parallax: https://docs.godotengine.org/en/stable/tutorials/2d/2d_parallax.html

Implication for IPM: each cosmic layer should have one depth parameter that weakens the same camera movement. Independent coordinate systems create contradictory depth cues.

## Phase 4 — Motion/accessibility evidence

Large scaling and panning motions can be vestibular-motion triggers. `prefers-reduced-motion` provides an explicit user preference for reducing non-essential motion.

Source:

- MDN `prefers-reduced-motion`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion

Implication for IPM: reduced-motion keeps non-essential star/haze parallax frozen. The world-anchored galaxy envelope may still follow explicit camera geometry because detaching it would break spatial correctness.

## Phase 5 — Interruptible / changing-target navigation

Reach and North's work on smooth, efficient and interruptible zooming treats target changes during an interaction as a first-class problem. A camera path should remain smooth when the user's target changes rather than assuming one fixed center for the whole navigation sequence.

Source:

- Andrew Reach and Chris North, *Smooth, Efficient, and Interruptible Zooming and Panning*: https://arxiv.org/abs/1801.09358

Implication for IPM: a depth model that is correct only for a single fixed point is insufficient. Wheel/pinch navigation is a sequence of transforms whose anchor can move between events. The background should weaken and compose each camera delta rather than recomputing one absolute fractional transform from the current camera state.

## Phase 6 — Mapping / scene-rendering ownership

Mapbox camera options expose an `around` location that remains at the same screen position across zoom, pitch or bearing changes. Cesium models the star field as a SkyBox around the scene rather than as ordinary world geometry.

Sources:

- Mapbox GL JS `CameraOptions.around`: https://docs.mapbox.com/mapbox-gl-js/api/properties/
- Cesium `SkyBox`: https://cesium.com/learn/cesiumjs/ref-doc/SkyBox.html

Implication for IPM: not every background element should own the same coordinate system. Repository geometry and the diffuse galaxy envelope are world-relative; decorative star/haze planes are camera-relative depth cues; meteors are screen-space events. The layers should be deliberately separated rather than accidentally sharing or contradicting transforms.

## Synthesis — fractional camera-delta composition

Represent the foreground camera in screen space as an affine transform:

```text
screen = zoom * world + origin
origin = viewportCenter + pan
```

For consecutive camera states `C0` and `C1`, first derive the exact screen-space delta that maps the old screen position to the new one:

```text
ratio = zoom1 / zoom0
deltaTranslation = origin1 - ratio * origin0
Delta(screen) = ratio * screen + deltaTranslation
```

For a background plane with `0 < depth < 1`, weaken **that delta** rather than the absolute camera state:

```text
depthScale = ratio ^ depth
translationFactor =
  depth                                      when ratio ~= 1
  (depthScale - 1) / (ratio - 1)            otherwise

depthDelta(screen) =
  depthScale * screen
  + deltaTranslation * translationFactor
```

Then compose each new `depthDelta` onto that plane's accumulated affine transform in interaction order.

This has three useful properties:

1. Pure pan becomes exactly `panDelta * depth`.
2. A zoom delta preserves the same fixed screen point as the foreground delta while scaling less strongly.
3. A later zoom can use a different fixed point without discarding earlier pan/zoom history; the transforms compose in the same order as the actual camera interaction.

This is intentionally path-dependent: the current background pose represents the camera movements the user actually made. That is preferable to deriving an incompatible absolute transform that silently assumes all prior movement shared one fixed point.

Viewport resize is treated as a rebase, not as navigation. Star/haze depth transforms reset to identity at the new viewport geometry so layout changes do not masquerade as camera motion.

## Coordinate ownership

- **Repository nodes / graph geometry:** full world camera transform.
- **Diffuse galaxy envelope:** full world camera transform; it describes the graph's world-space body.
- **Stars / haze:** accumulated fractional camera deltas using one depth coefficient per plane.
- **Meteors:** screen-space events independent of graph camera motion.
- **Reduced motion:** stars/haze reset/freeze at identity while the explicit world geometry remains coherent.

## Implementation boundary

- Shared interactive `/u/` only.
- Keep deterministic wrapped stars, sparse haze, world-anchored galaxy envelope and meteor behavior.
- Far/mid/near star depth coefficients remain `0.08 / 0.18 / 0.32`; haze remains `0.035`.
- Do not change graph semantics, dedicated viewers, static SVG output or stable `v1`.
- Do not add inertial zoom merely to mask transform errors; geometric coherence is solved first.

## Verification target

Browser evidence must cover more than one identity-origin zoom:

1. ordinary pan still moves each depth plane by its expected weaker amount;
2. a first off-center zoom preserves the chosen foreground/depth fixed point;
3. after a zoom and an intervening pan, a second zoom around the star's new location keeps that same star within sub-pixel tolerance;
4. far/mid/near layers preserve ordered depth response;
5. the galaxy envelope remains world-anchored;
6. reduced-motion freezes decorative star/haze depth motion and suppresses meteors;
7. Chromium and iPhone WebKit both pass on the exact final head.

The sequential-anchor regression is the discriminator: before composed camera deltas it failed deterministically with `3.361777501284678 px` horizontal drift against a `<0.75 px` contract.
