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
| `postprocess-public-pages.mjs` | shared viewer hardening, runtime emission, final Action pin, assorted compatibility rewrites | **P0 split/shrink** |
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
| `apply-threejs-galaxy-central-bulge.mjs` | adopted central morphology | **P1 canonicalize** |
| `apply-threejs-local-engine.mjs` | pinned/localized Three.js engine | P2 keep until localization owner is clearer |
| `apply-renderer-snapshot.mjs` | common renderer evidence snapshot contract | P2 |
| `apply-2d-runtime-bootstrap-gate.mjs` | final 2D bootstrap ordering gate | P2 |

## First migration cut

The safest high-value first cut is the shared-viewer hardening currently owned by `postprocess-public-pages.mjs`:

1. style normalization for `galaxy-classic`, `galaxy-systems`, `galaxy-hybrid`, and `obsidian`;
2. the adopted minimum zoom floor;
3. neutral initial Obsidian viewport while preserving explicit Fit and Galaxy auto-fit;
4. narrow-mobile toolbar/detail CSS — **canonical source moved to `scripts/public-viewer.css`; postprocess fallback is now expected to no-op**.

These are already production behavior. They should live directly in `scripts/public-viewer.js` / `scripts/public-viewer.css` rather than requiring generated-output string replacement. Once canonical sources emit the same result, delete only the corresponding postprocess code and retain existing behavior/evidence gates.

## Rules for future changes

- Do not add a new `apply-*` stage merely because string replacement is faster for one feature.
- Prefer modifying the canonical source that owns the behavior.
- If a temporary adapter is unavoidable, add an explicit retirement condition and affected test before admitting it to the budget.
- Removing a stage must not require changing the budget test; deletion is the expected direction.
- Do not combine cleanup with renderer-semantic redesign, release-pin movement, or dormant one-click reactivation.
