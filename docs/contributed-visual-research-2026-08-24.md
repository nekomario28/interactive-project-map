# Contributed visual emphasis research — 2026-08-24

Status: **ACCEPTED DESIGN BASIS — simplified after live review**

This note records the design basis for making accepted external contributions recognizable without changing ownership semantics or over-emphasizing the relation.

## Problem

The original Galaxy palette rendered `Contributed` in cyan (`#55c7d7`) beside a cyan owner (`#64d2ff`) and blue group (`#6aa7ff`). The status was semantically important but visually too close to existing structural colors.

Galaxy motion also assigns repositories through owned category membership / `groupId`. Accepted external contributions intentionally have neither, so they can fall outside the orbital runtime and appear static even though the viewer renders them.

An initial emphasis experiment combined orange, dashed node halos, dashed contribution lines and dedicated outer motion. Live review showed that this stacked too many cues. In particular, a permanent owner-to-contributed line visually implied a stronger structural/ownership relationship than the canonical semantics warrant.

## Research synthesis

- WCAG 2.2 SC 1.4.1 says color must not be the only means of conveying information.
- Okabe–Ito's color-universal qualitative palette uses orange `#E69F00` as a categorical color clearly separated from blue/green families.
- Paul Tol's qualitative schemes similarly use warm orange/gold against blue/green/purple categories.
- IBM Carbon visualization guidance recommends categorical palettes that maximize differentiation between unrelated categories.

Primary references retained from the original review:

- W3C WCAG 2.2, Understanding SC 1.4.1 — Use of Color
- Okabe–Ito color-universal qualitative palette (`#E69F00` orange)
- Paul Tol, qualitative colour schemes
- IBM Carbon Design System, data-visualization color palettes

## Final decision

Use a warm orange Contributed identity instead of cyan:

- dark surfaces: `#E69F00`
- light static surfaces: `#A85D00`

Do **not** add a permanent dashed halo merely to mark Contributed, and do **not** draw the direct data-model `contribution` edge as an always-on owner-to-repository spoke.

Color is still not the sole cue: the explicit `Contributed` filter/legend text, full external `owner/repo` label and contribution details identify the relation independently of hue. These textual/structural cues are authoritative.

Archived/fork remain source metadata. They must not replace the primary Contributed status or add stronger decorative treatment than the relation itself.

The change is presentation-only. It must not add `groupId`, membership, ownership, or owned category counts to external repositories.

## Galaxy motion contract

Accepted external contributions are direct contribution relations to the owner in the data model, not category members. Galaxy modes may animate them through a presentation-only owner-centered outer orbit so they remain part of the living Galaxy without fabricating category membership.

Expected behavior:

- Galaxy Classic: external contributions use a presentation-only outer owner-centered lane.
- Galaxy Systems: external contributions orbit the owner directly, independently of category hubs.
- Galaxy Hybrid: external contributions use a slow owner-centered outer orbit, independently of local category systems.
- Reduced-motion preference pauses these motions.
- No Galaxy mode should require a synthetic `External contributions` category hub or a visible direct contribution spoke.

## Static SVG parity

The same visual semantics should hold in generated SVGs. Static renderers may differ in geometry because they are non-interactive, but they must not silently drop Contributed, misclassify it as Original/Fork/Archived, or imply owned category membership just to obtain a layout position.

The detailed audit and migration boundary are tracked in `docs/static-svg-parity-audit-2026-08-24.md`.

## Future vision — true 3D

A future major-version vision remains a true 3D Project Galaxy: camera depth, orbital planes, layered category systems, contribution satellites, depth-aware labels, and accessible reduced-motion/fallback projections.

This is a vision note only, not an active implementation task. Any 3D work must first demonstrate better hierarchy/readability/profile identity than the current 2D viewers, retain keyboard/search/filter semantics, and preserve a non-WebGL fallback. Decorative bridges should not be introduced merely because a contribution edge exists in the data model.
