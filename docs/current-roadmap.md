# Current roadmap

Status snapshot: **2026-08-31**

This is the canonical list of work that is still worth doing. `docs/research-decision-ledger.md` records the current adopted / rejected / hold decisions so historical experiments are not accidentally revived as TODOs.

## Current production/release state

- Interactive Pages runtime baseline at this reconcile cut: **`7f5554b97a49a62a869f1706eaf8424179869127`** (PR #316, native Three.js Galaxy style).
- Stable reusable **`v1` remains `72ead19e8c49354af2bcbfa9144404c7a8d6ff9f`**. Do not move it for Pages-only viewer work.
- The reviewed immutable inner Action pin remains an independent release/authority layer. Moving Pages `main`, reusable `v1`, the outer reusable workflow, and the inner Action pin are separate decisions and require evidence appropriate to each layer.
- The published GitHub-only setup path has one production source of truth: `scripts/public-home.js` emits the reusable workflow caller. The legacy public direct composite-action caller must not return.
- The optional Cloudflare/GitHub App one-click installer remains **DORMANT / NOT_PRODUCTION_EXPOSED**. Do not advertise, credential-test, expand or reactivate it without concrete onboarding evidence or an explicit reviewed product decision.

There is currently **no pre-approved feature backlog** after the 2026-08-31 research reconcile. New work should start from a concrete product, correctness, accessibility, maintenance or release gap rather than from an old unchecked research item.

## Frozen product architecture

### 2D and 3D

- `View: 2D | 3D Lab` is a separate product axis from Style.
- 2D keeps the existing twelve production styles.
- 3D is real local Three.js/WebGL using the immutable Three.js 0.185.1 engine assets and project-subpath-safe loading.
- 3D renderer-local styles are **Cosmic / Galaxy / Aurora / Wireframe**. `style3d=` is separate from 2D `style=` and returning to 2D restores the prior 2D style.
- Shared Project Map semantics live above renderer-specific drawing/camera code. Canvas/WebGL rendering, hit testing/raycasting and camera math remain intentionally separate.

### Galaxy 3D — adopted native style

PR #316 promoted `style3d=galaxy` as a native Three.js interpretation of the existing 2D Galaxy Hybrid design language rather than a flat 2D copy.

- the owner remains the nucleus;
- owned categories are laid out deterministically along one to three shallow spiral arms according to category count;
- repositories form local systems around their category with bounded vertical thickness so the layout uses real 3D depth without becoming an unreadable sphere cloud;
- Contributed repositories remain semantically external and occupy outer rings rather than acquiring owned category membership;
- the style reuses the proven Three.js Cosmic far/mid/near star layers, nebula sprites and spiral dust, with a Galaxy-specific scene theme;
- existing subtle star/dust/nebula/ring motion remains available, but the Galaxy style does **not** add large autonomous repository/category motion in its first production form. Spatial positions remain stable for reading, selection and edges;
- Cosmic, Aurora and Wireframe retain their prior layout path and behavior.

The PR #316 gate passed full Verify, twelve-preset comparison, Chromium style switching/render evidence and iPhone WebKit smoke. Pages run #218 built and deployed the same main head. The deployed Pages artifact was inspected and contains the Galaxy option, `THREE_D_STYLES` admission, `layoutGalaxyGraph`, the Galaxy layout branch and Galaxy theme.

A possible back-port of Three.js star-depth ideas into the 2D Galaxy background is **not bundled into the Galaxy 3D adoption**. Evaluate that separately with rendered evidence; do not alter 2D readability merely for visual parity.

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
- In Galaxy 3D, Contributed remains on external outer rings. It does not inherit the 2D motion contract automatically; the first 3D production form favors stable semantic positions.
- Do not restore the old Galaxy Systems static `external-rail` behavior.

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
6. **New styles only with a distinct product purpose.** Galaxy 3D qualifies because it translates the proven Galaxy hierarchy/spatial model into a native 3D layout. Do not add further styles merely to increase the count; parked visual concepts remain ideas until they demonstrate readability, hierarchy, focus or identity benefit.
7. **2D star-depth back-port only as a separate visual experiment.** If the Three.js star layers suggest a clearer 2D Galaxy background, compare it against the current 2D Galaxy with screenshots/readability evidence before adoption.

## Explicitly not active

- Three.js InstancedMesh / halo optimization based only on software CI FPS.
- Auto / High / Low render-density UI or Canvas DPR experiments.
- Three.js promotion to a thirteenth 2D Style.
- large autonomous Galaxy 3D node motion without a comprehension/navigation reason.
- automatic 2D starfield back-port solely for visual parity with Three.js.
- one-click installer production exposure.
- repeated branch-cleanup workflow machinery; the 2026-08-31 cleanup pass is complete and temporary cleanup workflows were removed.
- arbitrary clustering restarts, global semantic-edge rendering, repository-wide 3D DOM labels, animation for its own sake, or style-count proliferation.

## Verification / promotion rule

For future changes:

`refresh latest main -> read this roadmap + research decision ledger -> identify one concrete gap -> reuse the existing semantic boundary -> preserve 2D bootstrap ordering -> smallest delta -> focused validation -> rendered Chromium/WebKit evidence where behavior changes -> Pages proof where deployment changes -> release proof only if release pins move`

Source/build success alone does not prove visible behavior. Synthetic performance evidence alone does not justify renderer complexity when real-device behavior is healthy. User-facing controls require a meaningful visible outcome and plausible use case; otherwise keep the policy internal or remove it.
