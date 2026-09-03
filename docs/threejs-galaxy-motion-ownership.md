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

The already-qualified haze/dust phase lock and read-only motion-evidence augmentation live in:

`scripts/public-threejs-galaxy-pattern-coupling.mjs`

`scripts/apply-threejs-galaxy-central-bulge.mjs` likewise remains only as a syntax-checked compatibility adapter and is no longer an active `build:pages` stage.

## Current invocation order

The active generated-runtime order is now one combined post-build stage:

`apply-threejs-style-presets.mjs`
→ internally `composeThreejsStyleRuntime(source)`
→ internally `composeThreejsGalaxyMotionRuntime(styledRuntime)`
→ internally `composeThreejsGalaxyPatternCouplingRuntime(motionRuntime)`

The style composer creates the `threeStyle === "galaxy"` and `layoutGalaxyGraph` surface consumed by the motion composer. The canonical pattern-coupling composer then observes the final motion pattern contract and preserves the existing 2400 s dust/haze phase lock and read-only evidence augmentation.

`tests/threejs-galaxy-stage-order.test.mjs` makes this dependency executable and prevents either standalone Galaxy motion or standalone Galaxy pattern-coupling stages from returning.

## Stage retirement

The standalone `apply-threejs-galaxy-motion.mjs` invocation was removed safely because the previous style and motion stages were adjacent and the style adapter performs the same canonical compositions in the same order.

After pattern-coupling ownership became canonical, the immediately-following standalone `apply-threejs-galaxy-central-bulge.mjs` invocation can likewise be removed because the same style adapter now performs `style → motion → pattern coupling` before any unrelated post-build transform. Both compatibility adapters remain available for direct callers and `check:pages` syntax/API checks.

Together these two execution-boundary retirements reduce the active post-build mutation chain from 18 to 16 stages without changing the qualified Galaxy runtime order or renderer semantics.

The retirement remains valid only while:

1. `composeThreejsStyleRuntime(source)` runs before `composeThreejsGalaxyMotionRuntime(styledRuntime)`;
2. `composeThreejsGalaxyPatternCouplingRuntime(motionRuntime)` runs after the final Galaxy motion contract;
3. `GALAXY_PATTERN_PERIOD`, the motion evidence surface, and existing astronomy-inspired presentation parameters remain unchanged;
4. neither standalone Galaxy motion nor standalone Galaxy pattern-coupling stage reappears in `build:pages`;
5. unit tests plus Chromium motion/local-lane evidence and iPhone WebKit remain GREEN.

This changes invocation plumbing, not renderer semantics. It does not change the graph model, owner/contributed authority, release authority, `v1`, or the accepted astronomy-inspired presentation contract.
