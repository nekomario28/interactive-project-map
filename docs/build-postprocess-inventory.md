# Pages post-build mutation inventory

Status: maintenance boundary, 2026-09-03.

The public Pages build currently starts from `scripts/build-public-pages.mjs` and then runs a reviewed set of post-build mutation stages. These stages are historical implementation debt, not an extension point. New `apply-*` stages should not be added by default.

`tests/build-postprocess-budget.test.mjs` makes that rule executable: the current set is an upper bound, removals are allowed, and any previously unreviewed mutator fails CI until it receives explicit maintenance review.

## Current budget

- Canonical builder: `scripts/build-public-pages.mjs`
- Reviewed post-build mutators: **18**
- Direction: **monotonic decrease**
- Preferred destination: canonical `public-*` runtime/template sources or shared package mechanisms
- Migration rule: one bounded mechanism at a time, with rendered/evidence gates preserved

| Stage | Current responsibility | Migration priority |
|---|---|---|
| `postprocess-public-pages.mjs` | runtime emission, final Action pin, assorted compatibility rewrites; shared-viewer and Galaxy Systems tuning retired | **P0 split/shrink** |
| `apply-contributed-render-sync.mjs` | shared/Obsidian/Galaxy Contributed render parity | P1 |
| `apply-dedicated-view-state.mjs` | dedicated viewer shared state layer | P1 |
| `apply-dedicated-contributed-render-sync.mjs` | dedicated Contributed primary-status parity | P1 |
| `apply-category-navigator.mjs` | category navigator and Contributed emphasis attachment | P1 |
| `apply-reactive-cosmic-background.mjs` | camera/cosmic presentation attachment | P1 |
| `apply-quality-view.mjs` | Quality presentation bootstrap and shared model wiring | P1 |
| `apply-threejs-local-graph.mjs` | Three.js Local Graph adapter | P2 |
| `apply-threejs-search-context.mjs` | Three.js shared search adapter | P2 |
| `apply-threejs-category-navigator.mjs` | Three.js category navigator adapter | P2 |
| `apply-threejs-repository-labels.mjs` | bounded Three.js repository-label adapter | P2 |
| `apply-view-dimension-toggle.mjs` | 2D/3D navigation controls and assets | P1 |
| `apply-threejs-style-presets.mjs` | Three.js renderer-local style controls | P2 |
| `apply-threejs-galaxy-motion.mjs` | adopted Galaxy motion behavior | **P1 canonicalize** |
| `apply-threejs-galaxy-central-bulge.mjs` | adopted central morphology and arm-haze pattern coupling | **P1 canonicalize after active Galaxy changes stabilize** |
| `apply-threejs-local-engine.mjs` | pinned/localized Three.js engine | P2 keep until localization owner is clearer |
| `apply-renderer-snapshot.mjs` | common renderer evidence snapshot contract | P2 |
| `apply-2d-runtime-bootstrap-gate.mjs` | final 2D bootstrap ordering gate | P2 |

## First migration cut — complete

The first bounded cut removed shared-viewer output mutation from `postprocess-public-pages.mjs` after moving the already-adopted behavior into canonical sources:

1. style normalization for `galaxy-classic`, `galaxy-systems`, `galaxy-hybrid`, and `obsidian` — canonical in `scripts/public-viewer.js`;
2. the adopted minimum zoom floor — canonical in `scripts/public-viewer.js`;
3. neutral initial Obsidian viewport while preserving explicit Fit and Galaxy auto-fit — canonical in `scripts/public-viewer.js`;
4. narrow-mobile toolbar/detail CSS — canonical in `scripts/public-viewer.css`.

The generated-output fallback for those four behaviors is retired.

## Second migration cut — complete

The second bounded cut moves the already-adopted 2D Galaxy Systems runtime from generated-output tuning into `scripts/public-galaxy-systems.js` itself:

1. canonical `galaxy-systems` runtime identity and DOMContentLoaded isolation guard;
2. deterministic category-local orbit direction from the existing group hash;
3. repository local-orbit period `360 + lane * 180`;
4. slow category co-rotation at `1800 * 1000` ms;
5. the adopted `Galaxy Systems · slow category orbit · repositories orbit locally` subtitle.

`postprocess-public-pages.mjs` now emits `galaxy-systems-runtime.js` by direct copy rather than applying `tuneSystemsRuntime()` string replacements. Existing runtime tests and browser movement bounds remain the behavior authority.

`postprocess-public-pages.mjs` remains in the build because it still owns unrelated runtime emission, compatibility rewrites, classic-runtime isolation, bounded Obsidian/interaction transformations, and the reviewed final installer Action pin.

## Next bounded migrations

The smallest remaining postprocess-local string adapter is Galaxy Classic runtime identity/isolation. Prefer canonicalizing that separately before taking on larger Obsidian or interaction-runtime transformations.

Three.js Galaxy motion and central morphology remain high-value post-build debt, but they are renderer-semantic and currently active development surfaces. Migrate them one mechanism at a time only from a fresh main after checking for concurrent Galaxy work. Do not combine motion and central morphology in one cleanup cut.

## Rules for future changes

- Do not add a new `apply-*` stage merely because string replacement is faster for one feature.
- Prefer modifying the canonical source that owns the behavior.
- If a temporary adapter is unavoidable, add an explicit retirement condition and affected test before admitting it to the budget.
- Removing a stage must not require changing the budget test; deletion is the expected direction.
- Do not combine cleanup with renderer-semantic redesign, release-pin movement, or dormant one-click reactivation.
