# Three.js Galaxy motion ownership

Status: maintenance boundary, 2026-09-03.

## Canonical owner

The adopted Three.js Galaxy motion semantics now live in:

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

`scripts/apply-threejs-galaxy-motion.mjs` is intentionally only a filesystem adapter. It reads the emitted Three.js runtime, invokes the canonical composer, and writes only when bytes change. Motion constants and the motion kernel must not return to the adapter.

## Current invocation order

The generated runtime still requires this reviewed order:

`apply-threejs-style-presets.mjs`
→ `apply-threejs-galaxy-motion.mjs`
→ `apply-threejs-galaxy-central-bulge.mjs`

The style stage creates the `threeStyle === "galaxy"` and `layoutGalaxyGraph` surface consumed by the motion composer. The later central-bulge stage retains the arm-haze / pattern-phase coupling and therefore must observe the final motion pattern contract.

`tests/threejs-galaxy-stage-order.test.mjs` makes this dependency executable until invocation ownership is relocated.

## Retirement condition

Do not remove `apply-threejs-galaxy-motion.mjs` from `build:pages` merely because its semantics now have a canonical owner.

The adapter can be retired only after all of the following are true:

1. style-preset composition is available at the canonical builder/runtime-composition boundary before Galaxy motion;
2. the builder invokes `composeThreejsGalaxyMotionRuntime` in the same effective order;
3. the resulting pre/post migration `threejs-viewer.js` bytes or behavior contract are proven equivalent;
4. the later haze/pattern composer still observes the same `GALAXY_PATTERN_PERIOD` and motion evidence surface;
5. unit tests plus Chromium motion/local-lane evidence and iPhone WebKit remain GREEN.

This split changes ownership, not renderer semantics. It does not change the graph model, release authority, `v1`, or the accepted astronomy-inspired presentation contract.
