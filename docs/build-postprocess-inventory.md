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
| `postprocess-public-pages.mjs` | runtime emission/attachment, final Action pin, and compatibility rewrites; shared-viewer, Galaxy identity/tuning, Obsidian force-kernel, and interaction semantic rewrites retired | **P0 split/shrink** |
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
| `apply-threejs-galaxy-motion.mjs` | adopted Galaxy morphology/motion primitives and node motion behavior | **P1 canonicalize** |
| `apply-threejs-galaxy-central-bulge.mjs` | Galaxy haze/dust 2400 s pattern phase-lock plus haze motion-evidence augmentation; central bulge, nucleus dust fade, and haze object/scene attachment are canonical | **P1 shrink with motion canonicalization** |
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

## Third migration cut — complete

The third bounded cut moves Galaxy Classic's runtime identity into `scripts/public-galaxy-classic.js` without changing its motion or drawing semantics:

1. canonical `galaxy-classic` DOMContentLoaded isolation guard;
2. all Classic style checks now use the final runtime identity directly;
3. `galaxy-classic-runtime.js` is emitted by direct copy;
4. the generic `isolateRuntime()` string-replacement adapter is retired because it has no remaining consumer.

Galaxy Classic's existing Living Galaxy browser movement test remains the behavior authority. A focused source-ownership regression prevents legacy exact `"galaxy"` runtime identity or the postprocess adapter from returning.

## Fourth migration cut — complete

The fourth bounded cut moves the already-adopted Obsidian Spatial Core delegation into canonical `scripts/public-obsidian-runtime.js`:

1. force settings come directly from `window.ProjectMapSpatialCore.DEFAULT_FORCE_SETTINGS`;
2. linked-edge resolution delegates directly to `ProjectMapSpatialCore.linkForceEdges`;
3. each force step delegates directly to `ProjectMapSpatialCore.stepForceLayout`, preserving the existing Obsidian `physicsRadius` and dragging-id contract;
4. the duplicated pairwise force kernel is absent from canonical Obsidian source;
5. `obsidian-runtime.js` is emitted by direct copy and `tuneObsidianRuntime()` is retired.

The browser Spatial Core parity test remains the primitive-semantics authority, while the existing Obsidian browser tests remain the lifecycle/interaction authority.

## Fifth migration cut — complete

The fifth bounded cut moves the already-adopted semantic-edge normalization into canonical `scripts/public-interaction-polish.js`:

1. only raw `type === "semantic"` candidates are admitted;
2. source and target strings retain the existing 220-character input bound;
3. candidate processing remains bounded to 2400 input edges;
4. normalization delegates directly to `ProjectMapSpatialCore.normalizeWeightedEdges` with `maxInput: 2400`, `maxOutput: 1200`, `minScore: 0`, and `type: "semantic"`;
5. canonical source no longer contains its duplicated manual dedupe/sort kernel;
6. `interaction-polish.js` is emitted by direct copy and `tuneInteractionPolish()` is retired.

The Spatial Core primitive parity test remains the normalization-semantics authority, while existing shared/dedicated interaction and browser tests remain the rendering/search authority.

`postprocess-public-pages.mjs` remains in the build because it still owns Spatial Core runtime emission, script attachment, CSP compatibility rewriting, and the reviewed installer Action-ref promotion.

## Sixth migration cut — Three.js Galaxy presentation source

The sixth bounded migration reduces the historical `apply-threejs-galaxy-central-bulge.mjs` stage without changing the qualified Galaxy render:

1. PR #368 moved the sparse 96/48 central bulge and nucleus-only `r = 30..64` dust-colour fade into builder-owned `scripts/public-threejs-galaxy-central-morphology.mjs`;
2. `scripts/public-threejs-galaxy-disc-haze.mjs` now owns the existing 128×128 procedural arm-aware haze helper and its non-semantic/non-pickable scene attachment;
3. the haze still consumes the existing Galaxy arm count, 22° pitch, and scaled dust reference `42 × 1.08 = 45.36`; this cut introduces no second morphology or motion truth;
4. raw `threejs-cosmic` builder output remains inert because presentation activation is gated by the final `data-map-style="threejs-galaxy"` identity;
5. the remaining `apply-threejs-galaxy-central-bulge.mjs` responsibility is only the already-qualified 2400 s haze/dust phase lock and read-only motion evidence augmentation;
6. stale or partial generated intermediates continue to fail closed and require rebuilding from canonical source.

Rendered Chromium/WebKit Galaxy evidence remains the behavior authority. The reviewed mutator budget remains **18** because this cut shrinks a stage rather than deleting it.

## Next bounded migrations

The smallest remaining high-drift rewrite inside `postprocess-public-pages.mjs` is the setup Action-ref promotion: `scripts/build-public-pages.mjs` still emits the historical builder SHA and postprocess rewrites it to the reviewed immutable Action SHA. Fresh-main reimplement only the still-valid part of stale PR #350: make the builder use `src/action-ref.ts` directly, prove `app.js` is already final before postprocess, then remove `BUILDER_ACTION_REF` and the promotion block. Do not replay #350's already-superseded serializer changes.

For Three.js Galaxy, central morphology and haze presentation are no longer post-build-owned. The remaining high-value renderer-semantic debt is `apply-threejs-galaxy-motion.mjs` plus the small haze/dust pattern-coupling and evidence augmentation still carried by `apply-threejs-galaxy-central-bulge.mjs`. Canonicalize those only from a fresh main, preserving the existing 2/3/4-arm, 22° pitch, 2400 s pattern, 45.36 reference, Motion Off, no-persistent-lines, authority, and rendered-evidence contracts. Do not combine that maintenance with a renderer redesign.

## Rules for future changes

- Do not add a new `apply-*` stage merely because string replacement is faster for one feature.
- Prefer modifying the canonical source that owns the behavior.
- If a temporary adapter is unavoidable, add an explicit retirement condition and affected test before admitting it to the budget.
- Removing a stage must not require changing the budget test; deletion is the expected direction.
- Do not combine cleanup with renderer-semantic redesign, release-pin movement, or dormant one-click reactivation.
