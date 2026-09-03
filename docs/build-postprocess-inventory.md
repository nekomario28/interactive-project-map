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
| `postprocess-public-pages.mjs` | Spatial Core runtime emission, script attachment, and CSP compatibility rewriting; shared-viewer, Galaxy, Obsidian, interaction semantic, and Action-ref rewrites retired | **P0 split/shrink** |
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

## Sixth migration cut — complete

The sixth bounded cut removes the setup Action-ref build-then-rewrite path without moving release authority:

1. `scripts/build-public-pages.mjs` imports the reviewed inner Action ref from `src/action-ref.ts` and emits it directly into `app.js`;
2. `PUBLIC_ACTION_REF` remains a compatibility export backed by the same canonical authority;
3. the historical builder SHA is no longer emitted;
4. `BUILDER_ACTION_REF` and the final `app.js` string-promotion block are retired from `postprocess-public-pages.mjs`;
5. the setup source-of-truth test proves the built `app.js` already contains `PROJECT_MAP_ACTION_REF` and remains byte-identical through postprocess;
6. the release-chain test continues to prove the outer reusable `@v1` channel and immutable inner Action SHA are separate release targets.

This is the still-valid maintenance residue from stale PR #350. Its already-superseded serializer changes are intentionally not replayed.

`postprocess-public-pages.mjs` remains in the build because it still owns Spatial Core runtime emission, shared/dedicated script attachment, and CSP compatibility rewriting.

## Next bounded migrations

Re-inventory the residual `postprocess-public-pages.mjs` responsibilities after this cut. Treat CSP compatibility rewriting and runtime-script attachment as separate mechanisms: canonicalize one only if its owner is clear and the generated output can be proven equivalent. Do not collapse them merely to reduce line count.

Three.js Galaxy motion and central morphology remain high-value post-build debt, but they are renderer-semantic and currently active development surfaces. Migrate them one mechanism at a time only from a fresh main after checking for concurrent Galaxy work. Do not combine motion and central morphology in one cleanup cut.

## Rules for future changes

- Do not add a new `apply-*` stage merely because string replacement is faster for one feature.
- Prefer modifying the canonical source that owns the behavior.
- If a temporary adapter is unavoidable, add an explicit retirement condition and affected test before admitting it to the budget.
- Removing a stage must not require changing the budget test; deletion is the expected direction.
- Do not combine cleanup with renderer-semantic redesign, release-pin movement, or dormant one-click reactivation.
