# Research decision ledger

Status: **2026-08-31**

This ledger is the canonical decision layer above older research notes, experiment PRs and issue bodies. It does not delete historical evidence. It records what that evidence currently means so negative, superseded or completed research is not accidentally promoted back into active work.

Use together with `docs/current-roadmap.md`.

## Decision states

- **ADOPTED** — part of the current product/architecture baseline; preserve unless new evidence justifies changing it.
- **COMPLETED** — research or migration reached its intended conclusion; retained as evidence, not an active task.
- **REJECTED / NOT_PLANNED** — tested or considered and currently not worth product complexity; do not revive by default.
- **DORMANT** — viable concept with no current product trigger.
- **REOPEN CONDITION** — concrete evidence required before restarting the work.

## 1. Authority, release and setup

### Separate release/authority layers — ADOPTED

Keep these independent:

1. canonical/generated graph and static-output semantics;
2. immutable inner Action implementation pin;
3. outer reusable workflow;
4. stable reusable `v1`;
5. interactive Pages `main`.

Pages viewer work does not imply an Action or `v1` release. Release movement requires evidence for the layer being moved.

Stable reusable `v1` at this cut: `72ead19e8c49354af2bcbfa9144404c7a8d6ff9f`.

### Published GitHub-only setup — ADOPTED

`scripts/public-home.js` is the production setup implementation and emits the reusable workflow caller. Tests guard against resurrection of the old public direct composite-action caller.

### Cloudflare/GitHub App one-click installer — DORMANT

Retained implementation/security knowledge may remain, but it is not production-exposed and should not be advertised, credential-tested or expanded without explicit product evidence.

**Reopen condition:** measured onboarding failure/friction that the GitHub-only setup cannot reasonably solve, followed by explicit review of the additional credential/security surface.

## 2. Semantic architecture

### Spatial Core boundary — ADOPTED

`packages/spatial-core` remains domain-neutral. Project Map/GitHub-specific identity, Contributed semantics, taxonomy/search state, URL state and details presentation belong above it.

### Project Map view-model — ADOPTED

The #276 P0/P1/P2 migration established one renderer-neutral semantic boundary used by 2D and Three.js for the parts that should agree:

- browser-safe graph admission;
- status semantics and structural projection;
- strict Contributed admission/safe metadata;
- transferable URL state;
- Local Graph projection;
- Search Context;
- Category navigation semantics;
- bounded selected/direct-search labeling semantics;
- common renderer evidence snapshot.

Canvas/WebGL drawing, camera math, 2D hit testing, Three.js raycasting and renderer-specific visual encodings remain separate.

### Renderer-neutral convergence tracker #276 — COMPLETED

The historical issue checklist is not a live backlog. P0/P1/P2 materialized through #277/#278/#280/#281/#282/#283/#284; the common renderer snapshot followed through #297/#299.

**Reopen condition:** a concrete cross-renderer semantic parity regression that cannot be corrected through the existing view-model/adapters.

### 2D graph-bootstrap ordering — ADOPTED

A strengthened 2D/Three.js Search Context parity test first exposed an intermittent mismatch. The initial assumption that this was only a test-settling race was superseded when main failed again after the test had been strengthened.

The production cause was script ordering:

1. the base 2D viewer could start `graph.json` fetch immediately;
2. later ordered/deferred scripts installed the canonical view-model/search/sanitizer patches;
3. a sufficiently fast graph response could therefore be sanitized by the legacy base sanitizer before those patches existed;
4. taxonomy aliases/facets/semantic metadata were then permanently absent from `state.graph`, producing a correct query string with empty derived Search Context IDs/reasons.

PR #313 introduced `scripts/apply-2d-runtime-bootstrap-gate.mjs`. All nine 2D viewer runtimes now start graph loading from a one-shot `DOMContentLoaded` listener, after the ordered deferred patch set has run. The regression proof checks that canonical `ProjectMapViewModel.projectSearchContext` and `ProjectMapSearchContext` already exist when graph fetch begins, then validates alias and facet search.

The deployed Pages artifact at main `82ddd9466a390da3dc7dc016b7d472415ae26eb8` was inspected directly and contains exactly one bootstrap gate in each of `viewer.js`, `radial-viewer.js`, `tree-viewer.js`, `treemap-viewer.js`, `timeline-viewer.js`, `cluster-viewer.js`, `sunburst-viewer.js`, `matrix-viewer.js`, and `sankey-viewer.js`.

**Current rule:** do not start 2D graph fetch before the shared runtime patch layer has installed. Do not introduce a second early graph-fetch path. Search semantic readiness is the full renderer-neutral projection, not merely a normalized query string.

**Reopen condition:** a concrete startup/load regression showing that the `DOMContentLoaded` gate itself causes user-visible harm, together with an alternative ordering mechanism that still proves all required shared patches are installed before graph sanitization.

## 3. View and Style architecture

### Separate View axis — ADOPTED

`View: 2D | 3D Lab` is separate from Style. Three.js is not a thirteenth 2D preset.

2D retains its twelve styles. 3D keeps renderer-local style state and restores the prior 2D style on return.

### Local Three.js engine — ADOPTED

Runtime engine assets are local/same-origin and sourced from immutable Three.js 0.185.1 upstream content. Project Pages subpath behavior is regression-tested. Do not restore a runtime jsDelivr dependency casually.

### 3D styles Cosmic / Galaxy / Aurora / Wireframe — ADOPTED

They share graph/camera/semantic contracts while allowing renderer-local presentation and, where justified, renderer-local layout. `style3d=` remains separate from 2D `style=`.

### Galaxy 3D — ADOPTED

PR #316 introduced `style3d=galaxy` in response to a concrete product request to translate the established 2D Galaxy design into 3D while keeping the existing 3D style family.

The accepted interpretation is deliberately native to 3D:

- owner at the nucleus;
- owned categories distributed deterministically along one to three shallow spiral arms based on category count;
- repository systems clustered locally around categories with bounded vertical thickness;
- external Contributed repositories on outer rings, with no fake owned membership;
- existing Cosmic starfield, nebula and spiral-dust machinery reused with a Galaxy-specific theme;
- existing subtle environmental/ring/pulse motion retained;
- no large autonomous category/repository position motion in the first production form, so semantic positions and edge geometry remain stable.

PR #316 passed the full Verify gate, twelve-preset comparison, Chromium style switching/render evidence and iPhone WebKit smoke. Pages run #218 built/deployed the same main head. The uploaded Pages artifact was inspected and contains the Galaxy Style option, `THREE_D_STYLES` admission, `layoutGalaxyGraph`, Galaxy layout selection and Galaxy theme.

This is a precedent for **purpose-driven** new styles, not permission for style-count expansion. Galaxy qualified because it changes the spatial interpretation to preserve a proven information hierarchy in 3D.

### Additional visual presets — DORMANT

Magic/spell-array and other parked concepts remain idea inventory, not backlog.

**Reopen condition:** a candidate demonstrates a distinct readability, hierarchy, focus, dense-profile or profile-identity benefit rather than only visual novelty.

## 4. Contributed research line

The ranking/schema/generator/admission/viewer/dedicated-viewer/visual research is consolidated into the following product contract.

### Contributed identity and authority — ADOPTED

- primary relation is `contributed` external work;
- external work never acquires fake owned category membership;
- `fork` / `archived` are secondary source flags;
- contribution edges are semantic evidence, not ownership membership;
- browser admission fails closed on malformed external identity/diagnostics;
- generated graph, source ownership/taxonomy, browser projection/layout and presentation are separate authority layers.

### Contributed 2D visual identity — ADOPTED

Use the reviewed warm distinct identity without adding ownership-like presentation. Dedicated and shared viewers must preserve the same primary relation semantics.

### Contributed in Galaxy 3D — ADOPTED

Galaxy 3D keeps external repositories on outer rings beyond the owned galaxy systems. The 2D shared-Galaxy motion contract is not automatically copied to 3D: the first 3D Galaxy form prioritizes stable semantic positions while the existing scene/background motion supplies visual life.

### Galaxy Systems static external rail — REJECTED / SUPERSEDED

The static `external-rail` behavior caused a visible regression: Contributed appeared not to move while Classic/Hybrid did. PR #308 replaced it with a deliberately slower external orbit in Galaxy Systems and changed E2E so motion is required when enabled.

**Current 2D rule:** Contributed moves in all three shared Galaxy styles when motion is enabled; Motion Off / reduced-motion may stop it.

**Reopen condition:** a new visual design with rendered evidence that preserves the expectation of a living Galaxy and does not regress semantic separation.

## 5. Camera, background, labels and interaction research

### Camera coherence / pan containment — ADOPTED

Wheel normalization, pointer-anchored zoom, bounded scene-aware zoom and pan containment are baseline behavior. Fit/Reset remain explicit. Do not reopen raw camera constants without a visible regression.

### Cosmic / Three.js background depth — ADOPTED

Deterministic layered stars and the world/camera-coherent diffuse galaxy treatment are baseline. Three.js Cosmic and Galaxy reuse the far/mid/near star layers, nebula sprites and spiral dust. Reduced-motion remains respected.

### 2D back-port of Three.js star depth — DORMANT

The Three.js star layers may be a useful donor for improving the 2D Galaxy background, but this is not automatic parity work and was intentionally excluded from PR #316.

**Reopen condition:** a rendered 2D comparison demonstrates better depth/readability without obscuring labels, edges, category hierarchy or selected/search emphasis.

### Adaptive labels — ADOPTED

2D semantic label LOD and 3D bounded selected/direct-search labels are preferable to repository-wide always-on labels. Normal 3D repositories remain sphere-only until direct/selected/hovered context justifies labeling.

**Reopen condition:** concrete readability/accessibility evidence showing the current budget hides necessary information.

## 6. Render density / quality-control research

### Canvas bounded DPR experiment — COMPLETED research, REJECTED product feature

The experiment demonstrated that a bounded opt-in Canvas backing store could substantially reduce DPR3 pixel area while preserving high screenshot similarity in tested fixtures. That evidence remains valid as research.

It did **not** establish a useful user-facing control. Auto/High/Low appeared ineffective/unclear in normal use and added toolbar/state complexity.

### Product decision — ADOPTED

- no Auto / High / Low render-density selector;
- no `render=` product contract;
- 2D uses native DPR;
- 3D uses one internal bounded backing-store policy;
- do not conflate render density with repository Quality evidence.

The Canvas experimental runtime/postprocessor/shim and experiment-specific tests were removed.

**Reopen condition:** a concrete device/readability/performance problem where backing-store density is demonstrated to be the relevant cause and an automatic internal fix is insufficient.

## 7. Common renderer evidence

### `window.ProjectMapRenderer.snapshot()` — ADOPTED

The #297/#299 work provides a shared read-only evidence/capability shape for 2D and Three.js: renderer/style identity, visible semantic counts, selected identity, capability flags and viewport/backing-store evidence.

This is test/evidence plumbing, not a reason to force renderer implementation symmetry.

## 8. Three.js performance research

### Synthetic large-portfolio profiler — COMPLETED

The #275/#298/#300/#301/#303 research established useful CI-harness facts:

- moderate/large deterministic scenes can be compared through the common renderer snapshot;
- short-window heap did not show the dominant scaling signal;
- backing-store density was controlled in the paired evidence;
- hiding visible semantic scene nodes recovered much more throughput than Motion Off;
- the paired 480-repository Motion On/Off discriminator was essentially neutral;
- therefore the synthetic software-rendered hotspot class is visible per-node scene/render work rather than animation.

These are **software-rendered CI findings**, not hardware FPS claims.

### Performance optimization mandate — REJECTED

Current real-environment use has no observed Three.js heaviness. There is therefore no demonstrated product reason to complicate the renderer just to improve synthetic FPS.

### Repository halo suppression #302 / prototype #305 — REJECTED / NOT_PLANNED

Do not remove or suppress normal visual treatment based only on synthetic CI cost.

### InstancedMesh batching #306 / prototypes #307 and #310 — REJECTED / NOT_PLANNED

The prototypes are preserved in GitHub history but remain unmerged. PR #310 demonstrated why a fresh-main rebuild or green synthetic gate is not, by itself, authority to reopen a NOT_PLANNED lane. Do not create a second large-scene rendering path while real use is healthy.

**Reopen condition for any Three.js optimization:** reproducible real-device/user evidence such as noticeable interaction latency, startup delay, memory failure, thermal/power cost, or realistic portfolio scale failure. When reopened, use the existing synthetic harness as a discriminator, not as the sole acceptance authority.

## 9. Optional 3D semantic overlays

### Activity/Freshness, repository Quality presentation, focused semantic relation visuals — DORMANT

Renderer-neutral data can support these, but they are not automatically required for parity and should not be added simply because 2D has related presentation.

**Reopen condition:** a concrete comprehension/navigation use case and a renderer-specific visual design that avoids clutter and preserves authority boundaries.

Global semantic-edge rendering and repository-wide labels remain out of scope by default.

## 10. Maintenance and branch/research hygiene

### Branch cleanup — COMPLETED

A 2026-08-31 cleanup pass pruned merged/contained/redundant branches and removed the temporary cleanup workflows afterward. Do not install permanent cleanup machinery merely because a one-shot cleanup was useful.

### Negative/superseded experiment handling — ADOPTED

Historical docs, closed PRs and old issue bodies remain evidence carriers. They are not active TODOs. In particular, do not revive:

- Render Auto/High/Low;
- Canvas `render=` experiment runtime;
- static Galaxy Systems Contributed rail;
- halo suppression;
- InstancedMesh batching;
- one-click installer production exposure;
- arbitrary clustering restarts;
- Three.js-as-13th-2D-style;
- style-count expansion without a product purpose.

Fresh main, a cleaner implementation, CI GREEN, or stronger synthetic evidence does not override a documented NOT_PLANNED/REJECTED reopen condition.

## 11. Current work queue

At this reconcile cut there is **no pre-approved implementation backlog**. This is intentional, not an absence of direction.

New work should be created only from one of these evidence classes, in order:

1. production correctness/visible regression;
2. release/setup integrity failure;
3. accessibility or UX problem demonstrated in rendered/browser use;
4. semantic drift/duplication with a concrete maintenance cost;
5. new feature with a clear user comprehension/navigation benefit;
6. real-device performance problem.

Every new task should state its evidence, authority boundary, smallest acceptance test and explicit non-goals before implementation.
