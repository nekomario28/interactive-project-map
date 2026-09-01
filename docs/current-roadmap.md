# Current roadmap

Status snapshot: **2026-09-01**

This is the canonical list of work that is still worth doing. `docs/research-decision-ledger.md` records adopted / completed / rejected / dormant decisions; `docs/threejs-galaxy-astronomy.md` is the detailed physical/semantic boundary for the native Three.js Galaxy style, with `docs/threejs-galaxy-corotation.md` documenting the adopted visual corotation approximation.

## Current production/release state

- Interactive Pages runtime baseline at this reconcile cut: **`9d529d1d1524bfc52f4da76f3c4514d77f08cff3`** (PR #329, visual Galaxy corotation on top of the adopted logarithmic/moving Galaxy model).
- Stable reusable **`v1` remains `72ead19e8c49354af2bcbfa9144404c7a8d6ff9f`**. Do not move it for Pages-only viewer work.
- Pages `main`, reusable `v1`, the outer reusable workflow and the reviewed immutable inner Action pin are independent authority/release layers.
- The published GitHub-only setup path remains the production source of truth. The Cloudflare/GitHub App one-click installer remains dormant / not production exposed.

There is no pre-approved feature backlog merely because an old research item exists. New work starts from a concrete product, correctness, accessibility, maintenance, release or real-device problem.

## Frozen product architecture

### 2D and 3D

- `View: 2D | 3D Lab` remains a separate product axis from Style.
- 2D keeps the existing twelve production styles.
- 3D is real local Three.js/WebGL using immutable Three.js 0.185.1 engine assets and project-subpath-safe loading.
- 3D renderer-local styles are **Cosmic / Galaxy / Aurora / Wireframe**. `style3d=` remains separate from 2D `style=` and returning to 2D restores the previous 2D style.
- Shared Project Map semantics live above renderer-specific drawing, camera, hit-testing/raycasting and visual encoding.

### Galaxy 3D — adopted moving native style

Galaxy is a native 3D interpretation of the established 2D Galaxy language, not a flat copy and not a literal Milky Way simulator.

Current adopted contract:

- owner at the semantic nucleus;
- a flattened finite-thickness disc rather than an isotropic sphere cloud;
- **2 / 3 / 4 trailing logarithmic arms** for 1–4 / 5–8 / >8 categories;
- category-arm skeleton and spiral dust share a generic **22° logarithmic pitch** at initialization;
- 22° is a readable generic spiral choice, not a claimed Milky Way value;
- category systems co-rotate around the nucleus;
- galactocentric visual period grows approximately with radius (`T ∝ r`, bounded), giving lower outer angular speed and a flat-rotation-curve-inspired differential rotation;
- repositories follow deliberately slow local category orbits on approximately the same several-minute scale as 2D Galaxy Hybrid, continuing the 2D interaction metaphor rather than claiming stellar/Keplerian category gravity;
- Contributed repositories remain semantically external on outer lanes and co-rotate without gaining owned category membership;
- spiral dust is a separate presentation pattern rather than a material arm. Its adopted period is **2400 s**, matching the established 2D Galaxy Hybrid global-turn timescale;
- with the visual material rule `T ≈ 16r`, the current classical density-wave-inspired presentation has a **visual corotation radius `r = 150` renderer units**: inner semantic material overtakes the slower arm pattern, while outside that radius the rigid visual pattern is faster than the material;
- this single rigid pattern speed/corotation point is explicitly a visualization choice, not a claim that all spiral galaxies obey one long-lived density-wave model. Transient/recurrent and approximately co-rotating arm behavior remain scientifically valid alternatives;
- far/mid/near decorative star shells stay in an inertial world frame in Galaxy instead of counter-rotating against the semantic disc;
- persistent Galaxy graph lines are restricted to faint **category → repository membership** edges. Ownership, contribution and other relation spokes are not always-on astrophysical-looking structures;
- moving labels, selection targets, selected camera target and retained edge endpoints follow moving meshes;
- Motion Off freezes semantic node orbits; the existing reduced-motion-derived default remains respected;
- Cosmic / Aurora / Wireframe retain their existing non-Galaxy layout/motion policy.

The rich Chromium Galaxy evidence uses multi-category + Contributed fixtures. Runtime evidence proves co-rotation, outer slowdown, external-lane separation, initial logarithmic pitch, trailing orientation, actual category/repository/Contributed movement, Motion Off freeze, inertial starfield behavior, membership-only line policy, separate arm-pattern motion, and the current visual corotation boundary.

For the detailed astronomy/non-astronomy boundary, use `docs/threejs-galaxy-astronomy.md` and `docs/threejs-galaxy-corotation.md` rather than inferring physics from presentation code.

### Renderer-neutral semantics — completed baseline

The #276 convergence program is completed. Current shared baseline includes:

- browser-safe Project Map view-model above domain-neutral Spatial Core;
- strict Contributed admission and safe metadata;
- shared Original/Fork/Archived/Contributed status semantics and structural projection;
- transferable 2D/3D URL state;
- renderer-neutral Local Graph and Search Context;
- renderer-neutral category navigation semantics;
- bounded selected/direct-search labels;
- common read-only `window.ProjectMapRenderer.snapshot()` evidence/capability contract.

Do not reopen these as architecture TODOs without a concrete parity regression.

### 2D runtime bootstrap ordering — adopted invariant

PR #313 closed a real initialization race. All nine 2D viewer runtimes must install the ordered shared/deferred runtime patches before starting asynchronous `graph.json` fetch. Do not restore an early second fetch path. A query string alone is not semantic readiness; the complete renderer-neutral derived state is the authority.

### Contributed — frozen semantic boundary

- Contributed means explicit external work, never owned category membership.
- `fork` / `archived` remain secondary source flags and never override primary `relation: "contributed"` presentation.
- canonical `contribution` edges are evidence, not ownership-like layout membership;
- browser admission remains fail-closed for malformed external identity/diagnostics;
- all three shared 2D Galaxy styles move Contributed when motion is enabled; Motion Off / reduced-motion may stop it;
- Galaxy 3D also moves external Contributed lanes while preserving their spatial/authority separation;
- do not restore the old Galaxy Systems static `external-rail` behavior or persistent cross-galaxy contribution lines.

### 2D cosmic/star-depth state — already implemented

2D already has deterministic far/mid/near star layers, camera-depth parallax, haze, scene-aware galaxy envelope/dust and reduced-motion handling. Therefore a second “back-port the Three.js stars to 2D” runtime is **not active work**. Reuse or refine the existing 2D cosmic background only when rendered evidence identifies a concrete deficiency.

### Render density / quality controls — rejected product experiment

- no Auto / High / Low render-density control;
- legacy `render=` is not a product API;
- 2D Canvas uses native DPR;
- 3D uses one renderer-internal bounded backing-store policy;
- repository Quality evidence is unrelated and remains intact.

Reopen only from a concrete device/readability/performance problem where backing-store density is demonstrated to be causal.

## Three.js performance research conclusion

Software-rendered CI profiling is useful as research/regression evidence, not a real-device FPS acceptance gate. Current real-environment use has no observed Three.js heaviness.

Therefore:

- no InstancedMesh repository batching based only on CI FPS;
- no halo suppression/batching based only on CI FPS;
- no visual/semantic reduction merely to improve synthetic throughput;
- preserve the straightforward renderer while real-device behavior is healthy;
- reopen optimization from reproducible real-device interaction, startup, memory, thermal/power or realistic-scale evidence.

## Work that is still worth doing

Priorities remain evidence-driven:

1. **Production regressions first.** Visible/correctness failures in Contributed, View/Style, state transfer, search, bootstrap, project-subpath loading or setup outrank research polish.
2. **Release/setup integrity.** Keep stable-v1, immutable pins and published GitHub-only setup boundaries mechanically tested.
3. **Galaxy 3D only when evidence improves comprehension.** Morphology/motion refinements need astronomy evidence *and* rendered readability evidence; do not chase literal astrophysical simulation.
4. **UX/accessibility improvements with browser evidence.** Camera/selection/search feedback, labels, keyboard/mobile behavior and readable motion are valid when a real problem appears.
5. **Renderer-neutral maintenance only when it removes real drift.** Do not commonize Canvas and WebGL internals for symmetry.
6. **Optional semantic overlays only from concrete user value.** Activity/Freshness, repository Quality or focused relation visuals remain dormant unless they improve navigation without clutter.
7. **New styles only with a distinct product purpose.** Galaxy qualified because it changes spatial interpretation while preserving semantics; style-count growth itself is not a goal.

## Explicitly not active

- N-body or physically scaled galactic simulation;
- claiming Galaxy is a literal Milky Way reconstruction;
- forcing a single universal spiral-arm theory, pattern speed, corotation radius or exact Milky Way pitch/rotation curve;
- adding a forced central bar/warp/thick-disc taxonomy merely for Milky Way resemblance;
- fast/chaotic repository motion or autonomous camera motion;
- persistent ownership/contribution spokes through the Galaxy disc;
- Three.js InstancedMesh / halo optimization based only on software CI FPS;
- Auto / High / Low render-density UI or Canvas DPR experiments;
- duplicate 2D starfield back-port work;
- Three.js promotion to a thirteenth 2D Style;
- one-click installer production exposure;
- arbitrary clustering restarts, repository-wide 3D DOM labels or style proliferation.

## Verification / promotion rule

For future changes:

`refresh latest main -> read roadmap + research decision ledger + astronomy/corotation boundary when Galaxy is involved -> identify one concrete gap -> smallest authority-preserving delta -> focused tests -> rendered Chromium/WebKit evidence -> Pages proof for deployment changes -> release proof only if release pins move`

Source/build success alone does not prove visible behavior. Astronomy plausibility alone does not justify harming semantic readability, and a semantic metaphor must not be presented as literal astrophysics.
