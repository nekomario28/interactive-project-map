# Profile-local galaxy background contract

Status: **historical donor restored on active development branch (2026-08-25 JST)**.

## Donor

The visual source of truth is the final direct profile implementation immediately before Project Map moved to the reusable Action:

- repository: `nekomario28/nekomario28`
- donor commit: `ead72debca2a16608ebc5b799993c0234ea10cab`
- `scripts/render_project_map.py`
- `scripts/enhance_project_map_preview.py`

The migration commit `e05857408188fdf7ed9372a4f49e85a50201234b` removed those duplicated profile-local generator assets, so its parent is the correct historical donor boundary.

## Why this background is different

The donor did not treat the background as a wallpaper behind the graph. It generated ambient structure from the same common-center galaxy geometry as the projects and categories.

The restored Galaxy contract therefore keeps these donor characteristics:

- `Y_FLATTEN = 0.63`;
- 92 deterministic stars distributed along category spiral sectors;
- three faint elliptical rings at donor radii `132`, `194`, and `256`;
- spiral arms sampled from donor radius `92` through `294` with the original `((radius - 128) / 148) * 0.38` angular progression;
- a central nucleus glow;
- four diffuse association lobes around each category;
- seven fixed local stars per category association;
- category extent is communicated by diffuse association structure rather than by a large hard celestial-body boundary.

The browser port uses deterministic hashes instead of Python's local RNG, but preserves the donor geometry, constants, density, hierarchy, and world-space interpretation.

## World-space invariant

Galaxy ambience and Galaxy content must share one coordinate system. Camera pan/zoom transforms the galaxy background through `worldToScreen` in the same way as foreground nodes. The background is not a repeating screen-space star tile and does not use independent parallax layers.

A background feature may be aesthetically subtle, but it should have a structural reason for being where it is. Category-associated stars and haze follow category axes; the nucleus follows the owner center; spiral structure follows the category sectors.

## Removed experiment

The later reactive cosmic experiment used three wrapped screen-space parallax star layers, independent haze fields, and occasional meteors. Those features were technically smooth but made the backdrop read as a separate visual system. They are intentionally removed from Galaxy presentation rather than blended with the donor.

Obsidian retains its own background behavior; the profile-local Galaxy donor is not imposed on the Obsidian visual language.

## Static parity

Static Galaxy-family SVG backgrounds use the same donor constants and topology. Galaxy Systems additionally passes its real category count, center, and category radius into the background generator so stellar associations align with the rendered systems.

## Design rule

For a visualization with a strong world metaphor, **ambient layers should derive from foreground topology before decorative effects are added**. Screen-space polish is not a substitute for shared geometry.
