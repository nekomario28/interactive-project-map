# Three.js Galaxy motion ownership

Status: maintenance boundary, 2026-09-03.

## Canonical owner

The adopted Three.js Galaxy motion semantics live in:

`scripts/public-threejs-galaxy-motion.mjs`

`composeThreejsGalaxyMotionRuntime(source)` owns the existing qualified behavior:

- 22° logarithmic spiral pitch;
- 2–4 arm count policy;
- thin Galaxy disc geometry;
- 2400 s rigid-pattern presentation period and derived corotation radius;
- 2D-Hybrid-like local repository ellipses with axis ratio `0.68` and period model `480 + lane * 240`;
- co-rotating category/material motion;
- inertial Galaxy starfield;
- no persistent Galaxy graph-line objects;
- `ProjectMapThreejsGalaxyMotion.snapshot()` evidence surface.

`scripts/apply-threejs-galaxy-motion.mjs` remains as a compatibility filesystem adapter and is still syntax-checked, but it is no longer an active `build:pages` stage. Motion constants and the motion kernel must not return to that adapter.

## Current invocation order

The active generated-runtime order is:

`apply-threejs-style-presets.mjs`
→ internally `composeThreejsStyleRuntime(source)`
→ internally `composeThreejsGalaxyMotionRuntime(styledRuntime)`
→ `apply-threejs-galaxy-central-bulge.mjs`

The style composer creates the `threeStyle === "galaxy"` and `layoutGalaxyGraph` surface consumed by the motion composer. The later haze/pattern stage still observes the final motion pattern contract.

`tests/threejs-galaxy-stage-order.test.mjs` makes this dependency executable and prevents the standalone motion stage from returning.

## Stage retirement

The standalone `apply-threejs-galaxy-motion.mjs` invocation can be removed safely because the previous style and motion stages were adjacent and the existing style adapter now performs the same two canonical compositions in the same order before haze/pattern coupling.

The compatibility adapter remains available for direct callers and `check:pages`, but `build:pages` no longer executes it separately. This reduces the active post-build mutation chain from 18 to 17 stages without changing the qualified runtime order.

The retirement remains valid only while:

1. `composeThreejsStyleRuntime(source)` runs before `composeThreejsGalaxyMotionRuntime(styledRuntime)`;
2. the haze/pattern stage runs after that combined composition;
3. `GALAXY_PATTERN_PERIOD`, the motion evidence surface, and existing astronomy-inspired presentation parameters remain unchanged;
4. the standalone motion stage does not reappear in `build:pages`;
5. unit tests plus Chromium motion/local-lane evidence and iPhone WebKit remain GREEN.

This changes invocation plumbing, not renderer semantics. It does not change the graph model, release authority, `v1`, or the accepted astronomy-inspired presentation contract.
