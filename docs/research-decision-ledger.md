# Research decision ledger

Status: **2026-09-02**

This ledger is the canonical decision layer above older research notes, experiment PRs and issue bodies. It preserves historical evidence while preventing completed, rejected or superseded experiments from silently becoming active TODOs.

Use together with `docs/current-roadmap.md`. For Three.js Galaxy morphology/motion, `docs/threejs-galaxy-astronomy.md` is the detailed scientific/semantic boundary and `docs/threejs-galaxy-corotation.md` records the adopted classical corotation visualization.

## Decision states

- **ADOPTED** — current product/architecture baseline.
- **COMPLETED** — intended research/migration conclusion reached; evidence remains, task is not active.
- **REJECTED / NOT_PLANNED** — do not revive without satisfying an explicit reopen condition.
- **DORMANT** — viable idea without a current product trigger.
- **REOPEN CONDITION** — concrete evidence required before restarting a lane.

## 1. Authority, release and setup

### Separate release/authority layers — ADOPTED

Keep canonical/generated graph semantics, immutable inner Action pin, outer reusable workflow, stable reusable `v1`, and interactive Pages `main` independent. Pages viewer work does not imply an Action or `v1` release.

Stable reusable `v1`: `72ead19e8c49354af2bcbfa9144404c7a8d6ff9f`.

### Published GitHub-only setup — ADOPTED

`scripts/public-home.js` remains the production setup implementation and emits the reusable workflow caller. The legacy public direct composite-action caller must not return.

### Cloudflare/GitHub App one-click installer — DORMANT

Do not production-expose, advertise or expand it without measured onboarding evidence and explicit review of the additional credential/security surface.

## 2. Semantic architecture

### Spatial Core boundary — ADOPTED

`packages/spatial-core` remains domain-neutral. GitHub/Project Map identity, taxonomy, Contributed semantics, URL state and details/presentation belong above it.

### Project Map view-model / renderer-neutral convergence — ADOPTED + COMPLETED

The #276 program and #297/#299 evidence contract established the shared semantic boundary used by 2D and Three.js for admission, status projection, Contributed safety, URL state, Local Graph, Search Context, category navigation, bounded labels and renderer evidence snapshots.

Canvas/WebGL drawing, camera math, 2D hit testing and Three.js raycasting remain renderer-specific.

**Reopen condition:** a demonstrated cross-renderer semantic parity regression that cannot be corrected through the existing adapters/view-model.

### 2D graph-bootstrap ordering — ADOPTED

PR #313 fixed a production initialization race. Shared/deferred 2D runtime patches must be installed before `graph.json` loading/sanitization starts. Do not create a second early fetch path. Full renderer-neutral derived state, not merely the query string, defines semantic readiness.

## 3. View and Style architecture

### Separate View axis — ADOPTED

`View: 2D | 3D Lab` remains separate from Style. 2D keeps twelve styles. Three.js remains renderer-local and is not a thirteenth 2D preset.

### Local Three.js engine — ADOPTED

Three.js 0.185.1 runtime assets remain local/same-origin and project-subpath-safe. Do not casually restore a runtime CDN dependency.

### 3D styles Cosmic / Galaxy / Aurora / Wireframe — ADOPTED

They share semantic/camera/state contracts while allowing renderer-local presentation and, where justified, renderer-local layout/motion.

## 4. Galaxy 3D astronomy / semantic visualization

### Native Galaxy style — ADOPTED

PR #316 established `style3d=galaxy` as a native 3D translation of the proven Galaxy information hierarchy rather than a flat 2D copy.

### Higher Galaxy viewing angle — ADOPTED

PR #319 raised the Galaxy initial/reset camera elevation so the flattened disc and spiral structure are readable instead of appearing edge-on. Other Three.js styles retain their prior camera default.

### Moving Galaxy semantic disc — ADOPTED

PR #320 replaced the first static-node Galaxy assumption with slow meaningful motion inspired by 2D Galaxy Hybrid and broad galactic kinematics:

- categories co-rotate around the semantic nucleus;
- galactocentric visual period increases approximately with radius under a bounded flat-rotation-curve-inspired rule (`T ∝ r`), so outer angular speed is lower;
- repositories follow deliberately slow category-local orbits as an interaction metaphor on approximately the same several-minute scale as 2D Galaxy Hybrid, **not** a stellar/planetary gravity claim;
- Contributed repositories move on external lanes using the same visual radial-period policy while remaining outside owned membership;
- moving labels and selection/camera targets follow the meshes;
- Motion Off freezes semantic node motion and reduced-motion remains respected.

Alternative PR #321 used a more explicitly Kepler-like category-local interpretation and was closed unmerged. Do not revive it by default: category-local repo orbit is a semantic 2D-like metaphor, not an astrophysical sub-system claim.

### 2D Hybrid-aligned local repository ellipse motion — ADOPTED

PR #335 refines only the **repository-local** category orbit while preserving the adopted galactocentric astronomy-inspired motion:

- local repository paths use ellipse axis ratio **0.68**, matching the 2D Galaxy Hybrid motion grammar;
- local periods use **`480 + lane×240 s`** and the same deterministic per-category `:hybrid-direction` sign used by 2D Hybrid;
- Three.js deliberately keeps its existing compact local ring/packing as the renderer-local lane analogue instead of importing 2D's absolute `54 + lane×50` radii/capacity into the 3D scene;
- each current 3D repository offset is analytically mapped onto its ellipse at phase zero, preventing a style-start position jump or unrelated re-layout;
- small vertical breathing remains a 3D readability cue;
- `ProjectMapThreejsGalaxyMotion.snapshot()` exposes `localOrbitModel: "2d-galaxy-hybrid-ellipse"`, `localOrbitAxisRatio: 0.68`, and `localOrbitPeriodModel: "480+lane*240"`;
- Chromium motion evidence covers the ellipse contract while preserving category differential rotation, corotation, external Contributed motion, no-persistent-lines and Motion Off freeze.

This commonizes the **interaction/motion grammar**, not the absolute 2D geometry and not any physical gravity model.

### Differential rotation / trailing arms — ADOPTED

PR #324 records and tests the current handedness: semantic systems co-rotate, inner same-arm systems accumulate more angular motion than outer systems, and the arms trail the direction of rotation.

This is a generic morphology choice; rare leading-arm galaxies exist.

### Logarithmic spiral geometry, generic 22° pitch — ADOPTED

PR #327 replaces the earlier effectively Archimedean category/dust winding with a shared **logarithmic spiral** convention:

- Galaxy category-arm initialization uses `θ ∝ ln(r) / tan(p)`;
- Galaxy spiral dust uses the same pitch convention;
- adopted visual pitch is **22°**;
- Chromium evidence reconstructs roughly 20–24° from deterministic same-arm category positions before differential shear;
- the runtime snapshot reports `spiralModel: "logarithmic"` and `pitchAngleDeg: 22`.

22° is deliberately a readable **generic spiral** choice. It is not the claimed pitch of the Milky Way and not a universal value for spiral galaxies.

### Spiral pattern vs material motion — ADOPTED WITH SCIENTIFIC BOUNDARY

The visible spiral dust rotates as a separate presentation pattern while semantic category/repository systems undergo radius-dependent motion. This prevents semantic systems from being permanently glued to a material-looking arm and is consistent with the broad idea that spiral morphology need not be rigidly attached to the same material.

Do **not** elevate this to a claim that one long-lived constant-pattern-speed density-wave theory is uniquely correct. Spiral-arm formation/evolution remains an active area with transient/recurrent and more nearly co-rotating alternatives.

### Visual corotation — ADOPTED WITH SCIENTIFIC BOUNDARY

PR #329 makes the already-separate material/pattern motion internally coherent under one **classical density-wave-inspired visual approximation**:

- Galaxy spiral presentation-pattern period is **2400 s**, intentionally matching the established 2D Galaxy Hybrid global-turn period;
- the visual material rule is approximately `T = 16r` over the main disc;
- therefore the visual crossing occurs at **`r = 150` renderer units**;
- inside that radius semantic disc material has the shorter period and overtakes the arm pattern;
- outside it the rigid presentation pattern is faster than the slower material;
- `ProjectMapThreejsGalaxyMotion.snapshot()` exposes `patternModel: "rigid-density-wave-inspired"`, `patternPeriod: 2400`, and `corotationRadius: 150`.

This is **not** a physical scale conversion and is not authority to claim every observed galaxy has one rigid pattern speed or one corotation radius. Real spiral structure can be transient, recurrent, multi-pattern-speed or more nearly co-rotating. The purpose of #329 is internal visual consistency, not selection of a universal spiral-arm theory.

### Inertial decorative star backdrop — ADOPTED

PR #323 stops Galaxy’s far/mid/near decorative star shells from autonomously counter-rotating. Camera parallax may still change their view, but the background no longer competes with the semantic disc’s rotation field. Cosmic / Aurora / Wireframe retain their existing ambient behavior.

### Flattened finite-thickness disc — ADOPTED

Galaxy-specific group/repository/external vertical scatter is smaller than generic 3D. It remains exaggerated enough for interaction/readability and is not a physical scale-height claim.

### Subtle central stellar bulge — ADOPTED

PR #332 adds one Galaxy-only decorative central concentration after rendered astronomy/readability review:

- deterministic warm stellar points plus a low-opacity glow sit behind the owner;
- the structure is non-semantic and non-pickable;
- it does not change owner/category/repository positions, motion, arms, corotation or graph authority;
- Chromium evidence confirms that the owner remains readable and the central concentration strengthens the generic spiral-galaxy morphology without dominating the scene.

This is a presentation-level stellar concentration, not a mass model, black-hole claim, physical bulge scale or authority change.

### Persistent Galaxy graph lines — NO-PERSISTENT-LINES ADOPTED

PR #322 first reduced Galaxy line prominence and PR #326 reduced the persistent policy to membership-only. **PR #334 supersedes that final membership-only presentation** after direct rendered comparison showed that the remaining straight category → repository chords still add trajectory-like visual clutter without enough navigation value to justify always-on drawing.

Current contract:

- `style3d=galaxy` creates **no persistent node-to-node graph edge draw object**;
- membership, ownership, contribution and other relations remain intact in the canonical semantic graph; this is a renderer-specific presentation change, not schema deletion;
- category membership remains readable through spatial grouping, category labels/navigation, Search/Local Graph, focus, selection/details and filters/status presentation;
- Contributed remains authority-distinct on external lanes without cross-disc contribution chords;
- Cosmic / Aurora / Wireframe keep their existing edge policy;
- `ProjectMapThreejsGalaxyMotion.snapshot()` reports `edgePolicy: "no-persistent-lines"` and runtime evidence reports `persistentEdgeObjects: 0` with Motion On and Motion Off;
- the now-unused Galaxy-specific per-frame membership-edge endpoint synchronization was removed rather than kept as dead runtime work.

A relation may be reconsidered later as a **bounded selected/focused contextual visualization** only when a concrete navigation problem demonstrates value. This is not authority to restore persistent chords.

### Galaxy 3D scientific claim boundary — ADOPTED

`docs/threejs-galaxy-astronomy.md` and `docs/threejs-galaxy-corotation.md` explicitly separate:

**astronomy-inspired:** flattened disc, subtle central stellar concentration, co-rotation, bounded flat-curve-inspired outer slowdown, trailing logarithmic arms, finite thickness, independent arm-pattern presentation, inertial backdrop, and a classical visual corotation crossing;

**semantic metaphors:** owner=nucleus, category=local system, repos orbit categories on 2D-Hybrid-aligned local ellipses, Contributed=external lanes, metadata controls size/color, and graph relations retained in the semantic model even when Galaxy does not draw persistent straight lines.

Non-goals include N-body simulation, physical galactic timescale, exact Milky Way bar/warp/rotation curve, universal rigid density-wave claims, literal stellar dynamics or astrophysical interpretation of repository metadata.

## 5. Contributed research line

### Contributed identity and authority — ADOPTED

- primary relation is `contributed` external work;
- external work never gains fake owned category membership;
- `fork` / `archived` are secondary flags;
- contribution edges are evidence, not ownership membership;
- malformed external provenance fails closed;
- graph authority, ownership/taxonomy, projection/layout and visual presentation remain separate layers.

### 2D Contributed motion — ADOPTED

All three shared 2D Galaxy styles move Contributed when motion is enabled. The old Galaxy Systems static `external-rail` is REJECTED / SUPERSEDED by PR #308.

### Galaxy 3D Contributed motion — ADOPTED

External Contributed lanes co-rotate slowly outside the owned semantic disc, remain status/filter-distinct and do not gain category membership. Persistent cross-galaxy contribution lines remain omitted as part of the broader no-persistent-lines Galaxy policy.

## 6. Camera, background, labels and interaction

### Camera coherence / pan containment — ADOPTED

Pointer-anchored zoom, bounded scene-aware movement and explicit Fit/Reset remain baseline. Do not change camera constants without rendered evidence.

### 2D cosmic/star depth — ALREADY ADOPTED, NO BACK-PORT TODO

2D already contains deterministic far/mid/near star layers, camera-depth parallax, haze, galaxy envelope/dust and reduced-motion handling. Earlier wording that suggested a future direct “Three.js star-depth back-port” is superseded: a second parallel starfield runtime would duplicate existing work.

**Reopen condition:** a rendered comparison identifies a concrete deficiency in the existing 2D cosmic background and demonstrates a minimal improvement.

### Adaptive labels — ADOPTED

2D semantic label LOD and bounded 3D selected/direct-search labels remain preferred over repository-wide always-on labels.

## 7. Render density / quality-control research

### Canvas bounded DPR experiment — COMPLETED research, REJECTED product feature

Research evidence remains, but Auto/High/Low did not establish useful product value and added control/state complexity.

### Product decision — ADOPTED

- no Auto / High / Low render-density selector;
- no `render=` product contract;
- 2D native DPR;
- 3D one internal bounded backing-store policy;
- repository Quality evidence is separate and unchanged.

## 8. Common renderer evidence

### `window.ProjectMapRenderer.snapshot()` — ADOPTED

Shared read-only evidence/capability shape across 2D/3D remains test infrastructure, not a reason to force renderer implementation symmetry.

## 9. Three.js performance research

### Synthetic large-portfolio profiler — COMPLETED

The software-rendered CI harness isolated visible scene/render work as the dominant synthetic scale cost, with Motion On/Off essentially neutral in the paired near-cap test. These are CI-harness findings, not hardware FPS claims.

### Performance optimization mandate — REJECTED

Real-environment use has no observed Three.js heaviness. Halo suppression and InstancedMesh batching remain NOT_PLANNED without reproducible real-device/user evidence.

**Reopen condition:** meaningful real-device startup/interaction/memory/thermal/power/scale failure.

## 10. Optional semantic overlays / further styles

Activity/Freshness, repository Quality presentation and focused relation visuals remain DORMANT until a concrete comprehension/navigation use case exists. Focused relation visuals, if ever justified, must remain contextual and must not silently reintroduce persistent Galaxy chords. Magic/spell-array and other parked style concepts remain idea inventory, not backlog.

Galaxy is precedent for **purpose-driven** renderer-local style work, not permission for style-count growth.

## 11. Maintenance / negative-result hygiene

Historical docs, closed PRs and issue bodies remain evidence carriers, not active TODOs. Do not revive by default:

- Render Auto/High/Low or Canvas `render=` runtime;
- static Galaxy Systems external rail;
- persistent Galaxy node-to-node graph lines, including the superseded membership-only policy;
- Kepler-like category-local repo physics from closed PR #321;
- treating one rigid Galaxy pattern/corotation model as a universal physical truth;
- halo suppression / InstancedMesh batching;
- duplicate 2D star-depth back-port runtime;
- one-click installer production exposure;
- Three.js-as-13th-2D-style;
- arbitrary clustering/style expansion.

Fresh main, cleaner code or CI GREEN is not itself authority to reopen a documented rejected/not-planned lane.

## 12. Current work queue

No implementation is pre-approved simply because it can be made more physically detailed. New work should come from, in order:

1. production correctness/visible regression;
2. release/setup integrity failure;
3. accessibility or UX evidence;
4. demonstrated semantic drift/maintenance cost;
5. a new feature with clear comprehension/navigation benefit;
6. real-device performance evidence;
7. for Galaxy physics, a change that improves both scientific plausibility **and** semantic readability without pretending the map is a literal galactic simulation.
