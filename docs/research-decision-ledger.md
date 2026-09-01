# Research decision ledger

Status: **2026-09-01**

This ledger is the canonical decision layer above older research notes, experiment PRs and issue bodies. It preserves historical evidence while preventing completed, rejected or superseded experiments from silently becoming active TODOs.

Use together with `docs/current-roadmap.md`. For Three.js Galaxy morphology/motion, use `docs/threejs-galaxy-astronomy.md` and `docs/threejs-galaxy-corotation.md` as the detailed scientific/semantic boundary.

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
- repositories follow deliberately slow category-local orbits as an interaction metaphor, **not** a stellar/planetary gravity claim;
- Contributed repositories move on external lanes using the same visual radial-period policy while remaining outside owned membership;
- moving labels, selection target and retained edge endpoints follow the meshes;
- Motion Off freezes semantic node motion and reduced-motion remains respected.

Alternative PR #321 used a more explicitly Kepler-like category-local interpretation and was closed unmerged. Do not revive it by default: category-local repo orbit is a semantic 2D-like metaphor, not an astrophysical sub-system claim.

### Differential rotation / trailing arms — ADOPTED

PR #324 records and tests the current handedness: semantic systems co-rotate, inner same-arm systems accumulate more angular motion than outer systems, and the arms trail the direction of rotation.

This is a generic morphology choice; rare leading-arm galaxies exist.

### Logarithmic spiral geometry, generic 22° pitch — ADOPTED

PR #327 replaced the earlier effectively Archimedean category/dust winding with a shared **logarithmic spiral** convention:

- Galaxy category-arm initialization uses `θ ∝ ln(r) / tan(p)`;
- Galaxy spiral dust uses the same pitch convention;
- adopted visual pitch is **22°**;
- Chromium evidence reconstructs roughly 20–24° from deterministic same-arm category positions before differential shear;
- the runtime snapshot reports `spiralModel: "logarithmic"` and `pitchAngleDeg: 22`.

22° is deliberately a readable **generic spiral** choice. It is not the claimed pitch of the Milky Way and not a universal value for spiral galaxies.

### Spiral pattern / visual corotation — ADOPTED WITH SCIENTIFIC BOUNDARY

PR #329 completes the current classical density-wave-inspired presentation model without changing semantic-node orbit policy:

- the visible logarithmic spiral/dust pattern uses one rigid visual period of **2400 s**, intentionally matching the established 2D Galaxy Hybrid global-turn period;
- the semantic galactocentric material rule remains the bounded flat-curve-inspired `T ≈ 16r` policy;
- these cross at a visual **corotation radius `r = 150` renderer units**;
- inside `r = 150`, semantic disc material has a shorter period and overtakes the arm pattern;
- outside `r = 150`, the rigid presentation pattern overtakes slower material;
- runtime evidence reports `patternModel: "rigid-density-wave-inspired"`, `patternPeriod: 2400`, and `corotationRadius: 150`;
- Chromium evidence checks both sides of this visual period boundary using an inner owned system and an outer external lane.

This is **not** a claim that one long-lived constant-pattern-speed density-wave theory is uniquely correct. Real spiral structure can be transient/recurrent, support multiple pattern speeds, or approximately co-rotate with material. The 2400 s and 150 values are renderer presentation units, not Myr/kpc and not a Milky Way measurement.

`docs/threejs-galaxy-corotation.md` is the explicit claim boundary for this extension.

### Inertial decorative star backdrop — ADOPTED

PR #323 stops Galaxy’s far/mid/near decorative star shells from autonomously counter-rotating. Camera parallax may still change their view, but the background no longer competes with the semantic disc’s rotation field. Cosmic / Aurora / Wireframe retain their existing ambient behavior.

### Flattened finite-thickness disc — ADOPTED

Galaxy-specific group/repository/external vertical scatter is smaller than generic 3D. It remains exaggerated enough for interaction/readability and is not a physical scale-height claim.

### Persistent Galaxy graph lines — MEMBERSHIP-ONLY ADOPTED

PR #322 first reduced Galaxy line prominence; PR #326 completed the policy:

- persistent lines are limited to faint category → repository `membership` edges;
- owner → category ownership spokes are omitted because single-owner identity is already known and the spokes cut across spiral morphology;
- persistent owner → Contributed contribution chords are omitted because external lane/status/details already carry the relation and a cross-disc line can look like a physical trajectory;
- other relation edges are not globally persistent by default;
- retained membership endpoints follow moving nodes.

Graph lines remain semantic navigation aids, never claimed astrophysical structures.

### Galaxy 3D scientific claim boundary — ADOPTED

`docs/threejs-galaxy-astronomy.md` plus `docs/threejs-galaxy-corotation.md` explicitly separate:

**astronomy-inspired:** flattened disc, central concentration, co-rotation, outer angular slowdown, trailing logarithmic arms, finite thickness, independent visual arm pattern, visual corotation and inertial backdrop;

**semantic metaphors:** owner=nucleus, category=local system, repos orbit categories, Contributed=external lanes, metadata controls size/color, graph membership lines.

Non-goals include N-body simulation, physical galactic timescale/distance, exact Milky Way bar/warp/rotation curve, literal stellar dynamics or astrophysical interpretation of repository metadata.

**Further-physics gate:** do not add bar/warp/epicycles/N-body or additional resonance machinery merely because it exists in astrophysics. A new physical mechanism must improve both scientific plausibility and Project Map comprehension without weakening the semantic authority boundary.

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

External Contributed lanes co-rotate slowly outside the owned semantic disc, remain status/filter-distinct and do not gain category membership. Persistent cross-galaxy contribution lines remain omitted. Their possible position outside visual corotation is a consequence of semantic placement and must not be read as a physical halo claim.

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

Activity/Freshness, repository Quality presentation and focused relation visuals remain DORMANT until a concrete comprehension/navigation use case exists. Magic/spell-array and other parked style concepts remain idea inventory, not backlog.

Galaxy is precedent for **purpose-driven** renderer-local style work, not permission for style-count growth.

## 11. Maintenance / negative-result hygiene

Historical docs, closed PRs and issue bodies remain evidence carriers, not active TODOs. Do not revive by default:

- Render Auto/High/Low or Canvas `render=` runtime;
- static Galaxy Systems external rail;
- persistent cross-disc Galaxy contribution/ownership spokes;
- Kepler-like category-local repo physics from closed PR #321;
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
