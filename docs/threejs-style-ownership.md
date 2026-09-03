# Three.js style preset ownership

Status: maintenance boundary, 2026-09-03.

## Canonical owner

The adopted Three.js renderer-local style semantics live in:

`scripts/public-threejs-style-presets.mjs`

The canonical module owns both:

- `composeThreejsStyleRuntime(source)` — Cosmic/Galaxy/Aurora/Wireframe theme state, Galaxy layout selection, Galaxy camera/fit defaults, wireframe material policy, style-aware renderer evidence/title, and automatic render-density policy;
- `composeThreejsStylePage(html)` — removal of the obsolete user-facing render-density button.

`scripts/apply-threejs-style-presets.mjs` remains only a filesystem adapter while invocation is still post-build. Style constants, Galaxy layout helpers, and render-density policy must not return to that adapter.

## Dependency on Galaxy motion

The current qualified order remains:

`style composer`
→ `Galaxy motion composer`
→ `arm haze / pattern coupling`

Galaxy motion consumes the `threeStyle === "galaxy"` state and `layoutGalaxyGraph` surface created by the style composer. This ordering is executable in `tests/threejs-galaxy-stage-order.test.mjs` while the adapters remain explicit build stages.

## Retirement condition

The style adapter can be removed from `build:pages` only when:

1. the canonical Three.js builder invokes `composeThreejsStyleRuntime` and `composeThreejsStylePage` at the same effective point;
2. Galaxy motion is composed after the resulting style runtime;
3. generated `threejs-viewer.js` and `three/index.html` remain equivalent to the currently qualified outputs;
4. the later arm-haze/pattern stage still observes the same Galaxy motion contract;
5. full Verify, twelve-preset comparison, Chromium style/motion evidence, and iPhone WebKit remain GREEN.

This ownership move does not redesign the four styles, change the graph model, alter release authority, or move `v1`.
