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

The retired `scripts/apply-threejs-galaxy-motion.mjs` compatibility filesystem adapter has been removed after its standalone build invocation was retired and repository-wide reference search found no production caller. Motion constants and the motion kernel must remain in the canonical composer.

The already-qualified haze/dust phase lock and read-only motion-evidence augmentation live in:

`scripts/public-threejs-galaxy-pattern-coupling.mjs`

The retired `scripts/apply-threejs-galaxy-central-bulge.mjs` compatibility adapter has likewise been removed after canonical pattern-coupling ownership and standalone-stage retirement. Pattern-coupling truth must remain in the canonical composer.

## Current invocation order

The active generated-runtime order is one combined post-build stage:

`apply-threejs-style-presets.mjs`
→ internally `composeThreejsStyleRuntime(source)`
→ internally `composeThreejsGalaxyMotionRuntime(styledRuntime)`
→ internally `composeThreejsGalaxyPatternCouplingRuntime(motionRuntime)`

The style composer creates the `threeStyle === "galaxy"` and `layoutGalaxyGraph` surface consumed by the motion composer. The canonical pattern-coupling composer then observes the final motion pattern contract and preserves the existing 2400 s dust/haze phase lock and read-only evidence augmentation.

`tests/threejs-galaxy-stage-order.test.mjs` makes this dependency executable and prevents either standalone Galaxy motion or standalone Galaxy pattern-coupling stages from returning. `tests/threejs-galaxy-motion.test.mjs` additionally prevents the retired compatibility adapter files from reappearing.

## Stage and adapter retirement

The standalone `apply-threejs-galaxy-motion.mjs` invocation was removed safely because the previous style and motion stages were adjacent and the style adapter performs the same canonical compositions in the same order.

After pattern-coupling ownership became canonical, the immediately-following standalone `apply-threejs-galaxy-central-bulge.mjs` invocation was likewise removed because the same style adapter performs `style → motion → pattern coupling` before any unrelated post-build transform.

Once both adapters were inactive, repository-wide reference search showed no production caller beyond their own adapter-only tests/docs/check list. Their source files and `check:pages` syntax-check entries were therefore retired as dead compatibility surface. Canonical composer tests, stale/partial fail-close checks, idempotence checks, stage-order checks, and browser evidence remain the behavior authority.

The two Galaxy execution-boundary retirements historically reduced the active post-build mutation chain from 18 to 16 stages. Independent repository-label maintenance subsequently reduced the repository-wide active chain to 15 stages; deleting the already-inactive Galaxy adapter source files did not change the generated runtime or active stage count.

The retirement remains valid only while:

1. `composeThreejsStyleRuntime(source)` runs before `composeThreejsGalaxyMotionRuntime(styledRuntime)`;
2. `composeThreejsGalaxyPatternCouplingRuntime(motionRuntime)` runs after the final Galaxy motion contract;
3. `GALAXY_PATTERN_PERIOD`, the motion evidence surface, and existing astronomy-inspired presentation parameters remain unchanged;
4. neither standalone Galaxy stage nor the obsolete compatibility adapter source files reappear;
5. unit tests plus Chromium motion/local-lane evidence and iPhone WebKit remain GREEN.

This changes maintenance plumbing only, not renderer semantics. It does not change the graph model, owner/contributed authority, release authority, `v1`, or the accepted astronomy-inspired presentation contract.
