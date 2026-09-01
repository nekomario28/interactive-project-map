# Current roadmap

Status snapshot: **2026-09-01**

This is the canonical list of work that is still worth doing. `docs/research-decision-ledger.md` records the current adopted / rejected / hold decisions so historical experiments are not accidentally revived as TODOs.

## Current production/release state

- Interactive Pages runtime baseline at this reconcile cut: **`c7accdb077acd0c8732ddb4126d2d93e10cdfd38`** (PR #323, astronomy-aligned inertial Galaxy star backdrop on top of the adopted Galaxy motion/edge model from #320/#322). Evidence-only PR #324 later proved trailing-arm differential rotation without changing runtime behavior.
- Stable reusable **`v1` remains `72ead19e8c49354af2bcbfa9144404c7a8d6ff9f`**. Do not move it for Pages-only viewer work.
- The reviewed immutable inner Action pin remains an independent release/authority layer. Moving Pages `main`, reusable `v1`, the outer reusable workflow, and the inner Action pin are separate decisions and require evidence appropriate to each layer.
- The published GitHub-only setup path has one production source of truth: `scripts/public-home.js` emits the reusable workflow caller. The legacy public direct composite-action caller must not return.
- The optional Cloudflare/GitHub App one-click installer remains **DORMANT / NOT_PRODUCTION_EXPOSED**. Do not advertise, credential-test, expand or reactivate it without concrete onboarding evidence or an explicit reviewed product decision.

There is currently **no pre-approved feature backlog** after the 2026-09-01 Galaxy reconcile. New work should start from a concrete product, correctness, accessibility, maintenance or release gap rather than from an old unchecked research item.

## Frozen product architecture

### 2D and 3D

- `View: 2D | 3D Lab` is a separate product axis from Style.
- 2D keeps the existing twelve production styles.
- 3D is real local Three.js/WebGL using the immutable Three.js 0.185.1 engine assets and project-subpath-safe loading.
- 3D renderer-local styles are **Cosmic / Galaxy / Aurora / Wireframe**. `style3d=` is separate from 2D `style=` and returning to 2D restores the prior 2D style.
- Shared Project Map semantics live above renderer-specific drawing/camera code. Canvas/WebGL rendering, hit testing/raycasting and camera math remain intentionally separate.

### Galaxy 3D — adopted native moving style

PR #316 introduced `style3d=galaxy` as a native Three.js interpretation of the established 2D Galaxy Hybrid design language rather than a flat 2D copy. PRs #319–#324 then promoted its camera, motion, edge and astronomy contracts.

Current contract:

- the owner remains the nucleus;
- owned categories use a flattened **2–4 arm** semantic spiral grammar according to category count;
- repositories form local systems around their category with bounded vertical thickness;
- when Motion is enabled, category systems **co-rotate** around the nucleus and their bounded visual period grows with galactocentric radius (`T ∝ R` over the semantic disc), so inner systems have higher angular speed than outer systems;
- repositories keep category membership while following deliberately slow local category orbits on the same several-minute scale as the 2D Galaxy Hybrid metaphor. These local orbits are semantic animation, not Keplerian gravity;
- Contributed repositories remain semantically external on outer lanes and co-rotate under the same bounded radial visual-period rule; the external lane is not a literal stellar halo or an extrapolated physical Milky-Way rotation curve;
- the spiral dust is a separate, slower presentation pattern rather than a rigid material arm, so systems can move through the arm pattern;
- the adopted arm chirality is **trailing** relative to the co-rotation direction. PR #324 proves in Chromium that a same-arm inner category rotates farther than its outer counterpart while the trailing offset remains positive;
- far/mid/near decorative star shells remain in an inertial world frame in Galaxy, avoiding a contradictory autonomous counter-rotation field; Cosmic/Aurora/Wireframe retain their own ambient star motion;
- persistent ownership/membership edges remain very faint structural scaffolding and follow moving nodes; long persistent `contribution` lines are suppressed in Galaxy so they are not mistaken for physical trajectories;
- Motion Off freezes Galaxy semantic node orbits; the reduced-motion-derived default remains respected;
- the motion is intentionally slow and does **not** introduce autonomous camera movement.

Astronomy boundary: `docs/threejs-galaxy-astronomy.md` is authoritative for what is physically inspired versus intentionally semantic. The style is a generic spiral-galaxy metaphor, not a literal Milky Way or N-body simulation.

The rich Chromium evidence shows a nucleus, flattened semantic disc, multiple category systems and external Contributed nodes against the layered starfield. PR #323 main passed Verify / Chromium / iPhone WebKit and Pages #223 deployed successfully. PR #324 is evidence-only and does not move the runtime baseline.

### 2D cosmic / Galaxy background — already has depth

Do **not** create a duplicate “back-port Three.js stars to 2D” runtime merely for parity. The current 2D cosmic background already provides deterministic far/mid/near star layers, camera-depth parallax, haze and a graph-aware galaxy envelope/dust treatment.

A future visual tweak may borrow a *specific* Three.js presentation idea only if a rendered comparison shows a concrete readability/depth improvement. Existing 2D background depth is the baseline, not a missing feature.

### Renderer-neutral semantics — completed baseline

The #276 convergence program is **completed**, not an active tracker. Current baseline includes:

- Project Map-specific browser-safe view-model boundary above domain-neutral Spatial Core;
- strict Contributed admission and safe metadata;
- shared Original/Fork/Archived/Contributed status semantics and structural projection;
- transferable URL state between 2D and 3D;
- renderer-neutral Local Graph focus/depth;
- renderer-neutral Search Context with NFKC/facet/category semantics and keyboard navigation;
- Three.js Category Navigator with External contributions kept distinct from owned categories;
- bounded selected/direct-search repository labels rather than repository-wide DOM labels;
- common read-only `window.ProjectMapRenderer.snapshot()` evidence/capability contract across 2D and 3D.

Do not reopen these as architecture TODOs unless a concrete parity regression is demonstrated.

### 2D runtime bootstrap ordering — adopted invariant

PR #313 closed a real production initialization race discovered by the strengthened 2D/3D Search Context parity gate.

- All nine 2D viewer runtimes must install their ordered shared/deferred patches **before** starting the asynchronous `graph.json` fetch.
- `scripts/apply-2d-runtime-bootstrap-gate.mjs` gates the graph-load bootstrap until `DOMContentLoaded`, after the ordered deferred scripts have executed.
- At graph-fetch start, the canonical Project Map view-model and Search Context runtime must already be available.
- Do not move graph loading back into immediate base-viewer execution or create a second early fetch path.
- A correct query string alone is not semantic readiness; alias/facet/category-derived IDs and reasons must match the renderer-neutral pure model.

The deployed Pages artifact for `82ddd9466a390da3dc7dc016b7d472415ae26eb8` was inspected directly: `viewer.js` plus radial/tree/treemap/timeline/cluster/sunburst/matrix/sankey viewer runtimes each contain exactly one bootstrap gate and one `DOMContentLoaded` listener.

### Contributed — frozen semantics and motion

- Contributed means explicit external work, never owned category membership.
- `fork` / `archived` remain secondary source flags and never override primary `relation: "contributed"` presentation.
- Canonical `contribution` edges are evidence, not ownership-like layout membership.
- Browser admission remains fail-closed for malformed external identity/diagnostics.
- In the three shared Galaxy 2D styles, Contributed repositories remain outside the owned swept space and **move when motion is enabled**. Galaxy Systems uses a deliberately slower external orbit; Motion Off / reduced-motion may stop motion.
- In Galaxy 3D, Contributed remains on external outer lanes and **co-rotates when Motion is enabled**. Its persistent cross-galaxy contribution line is intentionally hidden; status/filter/details preserve the relation.
- Do not restore the old Galaxy Systems static `external-rail` behavior or reinterpret a Galaxy 3D external lane as owned membership.

### Render density / quality controls — rejected product experiment

- Do **not** expose Auto / High / Low render-density controls.
- Legacy `render=` is not a product API.
- 2D Canvas uses native DPR.
- 3D keeps one renderer-internal bounded backing-store policy.
- Historical Canvas DPR/readability evidence remains research evidence only; the experimental runtime/postprocessor/shim was removed.
- Reintroduce a user-facing render-density control only if a concrete user need is demonstrated.

## Performance research conclusion

Synthetic software-rendered CI profiling remains useful research/regression evidence, but it is **not a real-device performance acceptance gate**.

The completed #298/#300/#301/#303 sequence showed that, in the CI harness, visible per-node scene/render work scales more strongly than animation: the paired 480-repository Motion On/Off discriminator was essentially neutral. That result identified a synthetic hotspot but did not establish a product problem.

Current real-environment use has no observed Three.js heaviness. Therefore:

- **no InstancedMesh repository batching now**;
- **no repository halo suppression/batching now**;
- **no renderer simplification or visual reduction merely to improve synthetic CI FPS**;
- preserve the existing straightforward per-node renderer while it is usable in real environments;
- reopen optimization only from reproducible real-device/user evidence such as interaction latency, startup delay, thermal/power cost, memory failure or scale failure.

#302 and #306 are closed `not_planned`; prototype PRs #307 and #310 are closed unmerged. #298 is closed `completed` as research.

## Work that is still worth doing

There is no pre-approved feature backlog. Priorities are evidence-driven:

1. **Production regressions first.** Fix visible/correctness regressions such as broken Contributed motion, View/Style controls, project-subpath asset loading, bootstrap ordering, setup generation, accessibility or state transfer before research work.
2. **Release/setup integrity.** Keep the GitHub-only setup source of truth, immutable pins and stable-v1 separation mechanically tested. Advance release pins only with exact caller/output evidence.
3. **Small UX/accessibility improvements with rendered evidence.** Mobile layout, camera/selection/search feedback, label readability or keyboard/accessibility work is valid when a real problem is demonstrated.
4. **Renderer-neutral maintenance only when it removes real duplication/drift.** Do not commonize Canvas and WebGL internals for symmetry.
5. **Optional 3D semantic presentation only from concrete user value.** Activity/Freshness, repository Quality presentation or focused semantic-relation visuals remain dormant ideas, not queued work. Add them only if they improve comprehension without turning 3D into control/overlay clutter.
6. **New styles only with a distinct product purpose.** Galaxy 3D qualifies because it translates the proven Galaxy hierarchy/spatial model into a native 3D layout. Do not add further styles merely to increase the count.
7. **Galaxy astronomy refinements only from a visible contradiction or stronger evidence.** Keep the physical inspiration disciplined, but do not sacrifice semantic readability to simulate astrophysics for its own sake.

## Explicitly not active

- Three.js InstancedMesh / halo optimization based only on software CI FPS.
- Auto / High / Low render-density UI or Canvas DPR experiments.
- Three.js promotion to a thirteenth 2D Style.
- fast/mechanical Galaxy node motion or autonomous camera motion; the adopted slow semantic Galaxy motion is intentional and must not be removed as if it were an animation bug.
- duplicate 2D star-depth machinery solely for visual parity with Three.js.
- one-click installer production exposure.
- repeated branch-cleanup workflow machinery; the 2026-08-31 cleanup pass is complete and temporary cleanup workflows were removed.
- arbitrary clustering restarts, global semantic-edge rendering, repository-wide 3D DOM labels, animation for its own sake, or style-count proliferation.

## Verification / promotion rule

For future changes:

`refresh latest main -> read this roadmap + research decision ledger + Galaxy astronomy boundary when touching style3d=galaxy -> identify one concrete gap -> reuse the existing semantic boundary -> preserve 2D bootstrap ordering -> smallest delta -> focused validation -> rendered Chromium/WebKit evidence where behavior changes -> Pages proof where deployment changes -> release proof only if release pins move`

Source/build success alone does not prove visible behavior. Synthetic performance evidence alone does not justify renderer complexity when real-device behavior is healthy. User-facing controls require a meaningful visible outcome and plausible use case; otherwise keep the policy internal or remove it.
