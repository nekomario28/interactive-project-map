# Contributed visual emphasis research — 2026-08-24

Status: ACCEPTED DESIGN BASIS

This note records the design basis for making accepted external contributions easier to recognize without changing ownership semantics.

## Problem

The current Galaxy palette renders `Contributed` in cyan (`#55c7d7`) beside a cyan owner (`#64d2ff`) and blue group (`#6aa7ff`). The status is semantically important but visually close to existing structural colors.

Galaxy motion also assigns repositories through owned category membership / `groupId`. Accepted external contributions intentionally have neither, so they can fall outside the orbital runtime and appear static even though the viewer renders them.

## Research synthesis

- WCAG 2.2 SC 1.4.1 requires that color not be the only visual means of conveying information. Contributed therefore needs a non-color cue as well as a stronger hue.
- Okabe–Ito's color-universal qualitative palette uses orange `#E69F00` as one of its principal categorical colors and separates it from blue/green categories.
- Paul Tol's color-blind-safe qualitative schemes likewise use warm orange/gold against blue/green/purple categories and recommend maximizing neighboring categorical contrast.
- IBM Carbon's visualization guidance treats categorical colors as deliberately ordered to maximize differentiation rather than assigning nearby hues to unrelated categories.

Primary references:

- W3C WCAG 2.2, Understanding SC 1.4.1 — Use of Color
- Okabe–Ito color-universal qualitative palette (`#E69F00` orange)
- Paul Tol, qualitative colour schemes
- IBM Carbon Design System, data-visualization color palettes

## Decision

Use a warm orange Contributed identity instead of cyan:

- dark surfaces: `#E69F00` (Okabe–Ito orange)
- light static surface: `#A85D00` (darkened orange chosen to retain at least 3:1 graphical contrast against the current `#fbfcff` light background while preserving the warm hue family)

Color is not the sole cue. Contributed repository nodes also receive a distinct dashed outer halo/ring where the renderer supports node glyphs. Existing explicit `Contributed` filter/legend text remains authoritative.

The change is presentation-only. It must not add `groupId`, membership, ownership, or category counts to external repositories.

## Galaxy motion contract

Accepted external contributions are direct contribution relations to the owner, not category members. Galaxy modes must animate them through a presentation-only external orbit/halo around the owner.

The motion projection may keep runtime-only assignments, but it must not mutate `state.graph`, add synthetic ownership/membership edges, or make external repositories children of an owned category.

Expected behavior:

- Galaxy Classic: external contributions join a dedicated outer contribution arm/halo around the owner.
- Galaxy Systems: external contributions orbit the owner directly on presentation-only outer lanes, independently of category hubs.
- Galaxy Hybrid: external contributions use a slow owner-centered halo orbit, independently of local category systems.
- Reduced-motion preference continues to pause these motions.

## Future vision — true 3D

A future major-version vision is a true 3D Project Galaxy: camera depth, orbital planes, layered category systems, contribution satellites/bridges, depth-aware labels, and accessible reduced-motion/fallback projections.

This is a vision note only, not an active implementation task. Any 3D work must first demonstrate better hierarchy/readability/profile identity than the current 2D viewers, retain keyboard/search/filter semantics, and preserve a non-WebGL fallback.
