# Three.js style preset ownership

Status: current maintenance authority snapshot, 2026-09-10.

## Canonical owner

The adopted Three.js renderer-local style semantics live in:

`scripts/public-threejs-style-presets.mjs`

The canonical module owns both:

- `composeThreejsStyleRuntime(source)` — Cosmic/Galaxy/Aurora/Wireframe theme state, Galaxy layout selection, Galaxy camera/fit defaults, wireframe material policy, style-aware renderer evidence/title, and automatic render-density policy;
- `composeThreejsStylePage(html)` — removal of the obsolete user-facing render-density button.

Style constants, Galaxy layout helpers, and render-density policy belong in this canonical module.

## Current invocation order

The active build no longer invokes `scripts/apply-threejs-style-presets.mjs` as a standalone post-build stage. PR #421 retired that execution boundary.

The qualified active path is now owned by `scripts/apply-view-dimension-toggle.mjs`:

`patchThreeDViewDimension(threeHtml)`
→ `composeThreejsStyleRuntime(threeRuntime)`
→ `composeThreejsGalaxyMotionRuntime(styledRuntime)`
→ `composeThreejsGalaxyPatternCouplingRuntime(motionRuntime)`

`composeThreejsStylePage(dimensionHtml)` is applied to the already-established Three.js dimension page in the same stage. `tests/threejs-galaxy-stage-order.test.mjs` makes this order executable.

`scripts/apply-threejs-style-presets.mjs` remains only as an inactive, syntax-checked compatibility surface for focused tests. It is not part of `build:pages` and repository search currently shows no production caller of its exported apply/patch aliases.

## Standalone-stage retirement — complete

PR #421 completed the former build-stage retirement conditions:

1. style page/runtime composition moved to the existing adjacent dimension stage;
2. Galaxy motion still runs after style composition;
3. Galaxy pattern coupling still observes the final Galaxy motion contract;
4. the active stage-order tests prohibit the standalone style stage from returning;
5. the qualified browser and preset evidence for that migration was preserved at the time of retirement.

Removing the inactive compatibility source file itself is a separate dead-surface cleanup decision. It requires a fresh repository-wide reference check and retargeting any compatibility-only tests/check entries to the canonical composer before deletion.

This ownership boundary does not redesign the four styles, change the graph model, alter release authority, or move `v1`.
