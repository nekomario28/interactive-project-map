# Camera/background zoom coherence research — 2026-08-25

Status: evidence-backed design input for the shared interactive `/u/` camera/background runtime.

## Problem observed

The foreground camera already performs pointer-anchored zoom: the world point under the wheel pointer is re-anchored to the same screen point after scale changes. The cosmic background, however, currently combines two different coordinate rules:

- star/haze scale is centered on the viewport center;
- raw screen-space `state.pan` is added before that scale, so the pan contribution is itself multiplied by the depth zoom scale;
- the galaxy envelope is world-anchored through `worldToScreen(0, 0)`.

That means an off-center zoom can keep repository geometry stable under the pointer while the star/haze planes slide in a different coordinate frame. The effect is especially visible because zoom re-anchoring changes both `state.zoom` and `state.pan` at once.

## Phase 1 — Zoomable-interface / HCI evidence

Pad++ treated zoom as a navigation primitive and explicitly centered zoom on the cursor so the user could dynamically control the point being approached. Its later multiscale work also emphasized smooth, continuous viewpoint changes because rough/jumpy zoom can be disorienting and weaken spatial orientation.

Sources:

- Ben Bederson et al., Pad++ zoomable-interface work: https://www.sciencedirect.com/science/article/pii/S1045926X96900026
- Pad++ interaction description / cursor-centered zoom: https://www.researchgate.net/publication/220578893_Pad_A_Zoomable_Graphical_Sketchpad_For_Exploring_Alternate_Interface_Physics
- HCIL Pad++ multiscale notes: https://www.cs.umd.edu/projects/hcil/pad%2B%2B/papers/chi-94-pad/index.html

Implication for IPM: the interaction focal point should remain one coherent spatial point across foreground and depth cues. A background layer may move less than the foreground, but it should not invent a second zoom center.

## Phase 2 — Information-visualization transform evidence

D3 zoom models zoom as one affine transform and lets callers supply the point around which visual movement is minimized. Its `translateTo`/`scaleBy` formulation makes the transform point explicit, and its Canvas example also highlights that transform order matters.

Source:

- D3 zoom: https://d3js.org/d3-zoom

Implication for IPM: depth should be derived from the camera transform rather than composing unrelated `pan` and `zoom` effects in different orders.

## Phase 3 — Game-camera / parallax evidence

Godot documents parallax as camera-relative movement scaled by depth: a scroll scale below `1` makes a layer move more slowly than the camera and therefore read as farther away.

Source:

- Godot 2D Parallax: https://docs.godotengine.org/en/stable/tutorials/2d/2d_parallax.html

Implication for IPM: each cosmic layer should have one depth parameter that weakens the same camera transform. Independent pan and zoom coordinate systems are harder to reason about and can produce contradictory depth cues.

## Phase 4 — Motion/accessibility evidence

MDN notes that large scaling and panning motions can be vestibular-motion triggers and recommends honoring `prefers-reduced-motion` by removing or reducing non-essential motion.

Source:

- MDN `prefers-reduced-motion`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion

Implication for IPM: reduced-motion keeps non-essential star/haze parallax frozen. The world-anchored galaxy envelope may still follow explicit camera geometry because detaching it would break spatial correctness.

## Synthesis — fractional camera transform

Use one `depth` value per background plane. The foreground camera transform around viewport center is:

```text
x' = center + pan + zoom * (x - center)
```

For a depth plane with `0 < depth < 1`, use a weaker transform with:

```text
layerScale = zoom ^ depth
translationFactor =
  depth                              when zoom ~= 1
  (layerScale - 1) / (zoom - 1)      otherwise

layerX = center
       + layerScale * (baseX - center)
       + panX * translationFactor
```

The same formula applies to Y.

This has two useful properties:

1. At `zoom = 1`, ordinary panning reduces exactly to `pan * depth`, preserving the familiar parallax interpretation.
2. For a camera transform that has a fixed screen point, every depth layer has the same fixed point while scaling by a weaker amount. Pointer zoom therefore produces depth without the background shearing away from the interaction focus.

The transform is deterministic from current camera state and does not require storing gesture history.

## Implementation boundary

- Shared interactive `/u/` only.
- Keep deterministic wrapped stars, sparse haze, world-anchored galaxy envelope and meteor behavior.
- Replace separate star `parallax` / `zoomParallax` coefficients with a single depth coefficient per layer: far `0.08`, mid `0.18`, near `0.32`.
- Apply the same fractional-camera formulation to haze at depth `0.035`.
- Keep reduced-motion star/haze transform at identity.
- Do not change graph semantics, dedicated viewers, static SVG output or stable `v1`.

## Verification target

In addition to existing pan/brightness/wrapping checks, browser evidence should perform an off-center zoom using a visible near-layer star itself as the zoom anchor. With the fractional camera transform, that star remains at the same screen point (modulo sub-pixel tolerance) while other layers scale by their weaker depth. This directly tests the failure mode that motivated the change rather than only asserting `far < mid < near` scale ratios.
