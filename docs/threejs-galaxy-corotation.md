# Three.js Galaxy visual corotation

Status: 2026-09-02

This note extends `docs/threejs-galaxy-astronomy.md` without changing its semantic authority boundary.

## Why

The adopted Galaxy motion already uses two different ideas:

- semantic disc material follows a bounded flat-curve-inspired rule, approximately `T = 16r` in renderer units;
- the visible logarithmic spiral/dust arm is a separate presentation pattern rather than a rigid material arm.

A classical density-wave-style picture is more internally coherent when the material and pattern angular speeds cross somewhere in the visible disc. Real galaxies are more diverse than this model: spiral structure can be transient, can have multiple pattern speeds, or can approximately co-rotate with material. This is therefore a visual-model choice, not a universal astrophysical claim.

## Adopted visual rule

- Galaxy spiral-pattern period: `2400 s`.
- This intentionally matches the existing 2D Galaxy Hybrid global-turn period.
- With the existing `T = 16r` visual rotation rule, corotation is at `r = 150` renderer units.
- Inside `r = 150`, semantic disc material has a shorter period and overtakes the arm pattern.
- Outside `r = 150`, the rigid presentation pattern overtakes the slower material.
- The visible dust disc spans the corotation radius even when a small portfolio has all owned categories inside it.
- Contributed repositories may lie outside corotation, but their external lanes are semantic ownership/authority encoding, not a literal physical stellar halo.

## What does not change

- 22-degree logarithmic trailing-arm morphology.
- 2/3/4 arm count policy.
- Flat, finite-thickness semantic disc.
- Slow 2D-like repository-local orbits around category centers.
- External Contributed separation.
- Inertial decorative star shells.
- The qualified subtle central stellar concentration remains non-semantic and does not participate in the corotation model.
- **Galaxy has no persistent node-to-node graph lines.** PR #334 superseded the earlier membership-only presentation without changing graph semantics, node motion, arm pattern speed or the corotation crossing.
- Motion Off and reduced-motion behavior.

## Evidence contract

`window.ProjectMapThreejsGalaxyMotion.snapshot()` reports:

- `patternModel: "rigid-density-wave-inspired"`
- `patternPeriod: 2400`
- `corotationRadius: 150`
- `edgePolicy: "no-persistent-lines"`

Chromium evidence checks that an inner semantic system has a period shorter than the pattern while an external orbit is beyond the visual corotation radius with a longer period. The same runtime evidence requires `persistentEdgeObjects: 0`; that line-free presentation is intentionally orthogonal to the corotation calculation.

This is a visualization contract, not a conversion to kpc, Myr, stellar mass, or a literal Milky Way model.
