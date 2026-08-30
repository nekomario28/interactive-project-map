# Current roadmap

Status snapshot: **2026-08-30**

This is the short canonical list of work that is still worth doing. Historical research, old phase documents, closed experiment carriers, and older release receipts remain elsewhere in `docs/` and GitHub history; they are not active TODOs merely because they still exist.

## P1 — no active production acceptance blocker

The current production state is healthy:

- The reviewed reusable/static-output baseline remains independent from Pages-only viewer work. Stable reusable **`v1` is `72ead19e8c49354af2bcbfa9144404c7a8d6ff9f`** and must not move merely because interactive Pages `main` advances.
- The earlier reviewed `/u/` production baseline `1aef658c62ea7d3f6617e4ef92e61c4183089ab0` remains historical evidence for camera/background/pan containment. Pages `main` has since advanced through the experimental Three.js line and cleanup work.
- Current Pages runtime head after removing the retired Canvas render-density experiment is **`c2d7e500c92246147d8cdbb3d52a62637b3d9099`**. PR #295 passed Verify, twelve-preset comparison, Chromium and iPhone WebKit before merge; Pages #209 built and deployed the same head successfully.
- The taxonomy artifact-identity release remains proven end to end. Do not move stable release pins without the declared release-chain proof.

### Frozen product boundaries

- The IPM ↔ static SVG Contributed contract is relation-first across all twelve 2D presets: Contributed is explicit external work, uses the reviewed warm identity, does not gain owned category membership, and canonical `contribution` edges remain semantic evidence rather than ownership-like layout membership.
- `fork` / `archived` are secondary source flags. They must not override primary `relation: "contributed"` presentation.
- Static generated graph data, browser projections/layouts, source ownership/taxonomy and renderer presentation remain separate contracts.
- Stable `v1`, the outer reusable workflow, immutable inner Action pins and interactive Pages `main` are separate release/authority layers. Do not conflate or move them without evidence appropriate to that layer.
- The GitHub-only setup path remains the production onboarding architecture.
- The optional Cloudflare/GitHub App one-click installer remains **DORMANT / NOT_PRODUCTION_EXPOSED**. Keep retained implementation/security tests compatible with `main`, but do not advertise, credential-test, expand or reactivate it without concrete onboarding evidence or an explicit reviewed product decision.
- Real GitHub/Cloudflare credentials must never enter tracked files.

## Recent completed viewer work

The shared interactive `/u/` camera/background UX line is complete enough to treat as baseline rather than an open project:

- Camera coherence normalizes wheel delta modes, preserves pointer-anchored zoom, applies common scene-aware zoom bounds to wheel / keyboard / pinch, and prevents ordinary scenes from shrinking into tiny islands surrounded by effectively unbounded empty space.
- The cosmic background shares camera depth through deterministic far/mid/near star planes and a stable world-anchored diffuse galaxy envelope; reduced-motion behavior remains gated.
- Scene-aware pan containment keeps the graph from being lost in empty space while preserving node drag, Fit, Reset, static SVG output and dedicated viewers.
- Galaxy Systems / Hybrid already use adaptive semantic label LOD with smooth detail scaling, density budgeting and eligibility hysteresis. Do **not** reopen raw repository-label thresholds without rendered evidence of a real regression.

The experimental **Three.js Lab** line has also moved materially beyond its original one-style prototype:

- `View: 2D | 3D Lab` is a separate product axis from Style. 3D is real Three.js/WebGL and switching back to 2D restores the previous 2D style.
- The Three.js runtime engine is supplied locally from an immutable upstream Three.js 0.185.1 source pin; runtime jsDelivr dependency was removed. GitHub Pages subpath asset resolution is regression-tested.
- Three.js currently has three renderer-local styles: **Cosmic / Aurora / Wireframe**. These share graph geometry/camera/semantic projection and vary renderer-local presentation. `style3d=` stays separate from 2D `style=`.
- Shared graph admission, structural status projection, transferable URL state, search context, Category Navigator, Local Graph focus and selective repository labels have been donated into 3D through renderer-neutral boundaries where practical.
- The user-facing **Render Auto / High / Low** control has been removed. Legacy `render=` state is no longer a product feature. Three.js keeps one automatic bounded backing-store policy internally; 2D Canvas uses native DPR directly.
- The Canvas render-density experiment #285 is closed `not_planned` for default/UI promotion. Historical DPR/readability evidence remains useful research evidence, but the runtime/postprocessor/shim and experiment-specific tests have been removed from active Pages code.

## P2 — active research / maintenance only where evidence supports it

The highest-value remaining interactive work is the open renderer-neutral / Three.js convergence tracker **#276**. Treat its old checklist as historical staging; reconcile against current code before implementing any item. Current likely-value areas are:

- standardize a small cross-renderer capability/evidence snapshot so parity tests can compare renderer id/style, visible semantic projection, selection and viewport/backing-store evidence without coupling Canvas and WebGL pixels;
- improve Three.js large-portfolio performance before adding expensive visual overlays. Prefer measured instancing/material sharing, visibility/LOD, focused-graph cost reduction and raycast/label budgeting;
- only after acceptable performance evidence, evaluate renderer-specific Activity/Freshness, repository Quality evidence presentation and focused semantic relation rendering;
- make a later explicit promotion decision for Three.js Lab. Semantic parity alone does not make it a thirteenth 2D preset or automatically make it production-default navigation.

Other deferred work remains evidence-gated:

- **ONE_CLICK_INSTALLER → DORMANT / NOT_PRODUCTION_EXPOSED.** Maintain compatibility only; do not expand it without measured onboarding friction or an explicit reviewed product decision.
- **Do not add more visual style presets merely to increase the count.** The current 2D set plus Three.js Cosmic/Aurora/Wireframe is sufficient until a candidate materially improves readability, hierarchy, focus feedback, dense-profile behavior or profile identity. Magic-circle / spell-array and other concepts remain parked in `docs/future-visual-style-ideas.md`.
- Do not reintroduce user-facing render-density/quality switching unless new evidence demonstrates a concrete user need. Backing-store density is an implementation concern by default.
- Dependabot / Action pin maintenance should be grouped and reviewed rather than churned one update at a time.
- Re-run large-portfolio stress when 3D renderer cost, graph projection or layout behavior changes materially; avoid repeated stress runs for unrelated docs/UI cleanup.
- Revisit additional clustering only if materially different evidence appears; do not restart rejected clustering experiments by default.
- Advanced SVG width/height exposure, compacting mobile controls, camera inertia, animated settling or Classic/Obsidian label-transition polish remain discretionary UX work and require rendered benefit.
- Lower-layer adapter cleanup is architecture maintenance only. Proceed when a focused change reduces real duplication or runtime cost while preserving semantics, reduced-motion behavior, dense-profile behavior and browser gates.

## Verification / promotion rule

For future viewer/layout changes use the repository development loop:

`refresh live truth -> read this roadmap -> identify one product gap -> reuse existing shared projection/adapter -> smallest delta -> focused unit/static validation -> twelve-preset comparison where affected -> Chromium/WebKit rendered interaction proof where affected -> release proof only if release pins move`

Source/build success alone does not prove visible browser behavior. Pages-only viewer changes do not justify stable `v1` promotion when the reusable Action/static-output contract is unchanged.

For UI controls specifically, do not keep a selector/toggle merely because the underlying renderer can expose a parameter. A control needs a meaningful, visible user outcome and a plausible use case; otherwise keep the policy internal or remove it.

## Current tracker state

There is no active static-SVG, interactive Contributed, stable-release, public-setup, Category-navigator, camera-coherence, cosmic-background, pan-containment, taxonomy artifact-identity, one-click production or render-density acceptance blocker.

- **#285 is closed**: do not promote Canvas Auto/High/Low; 2D stays native DPR and the retired experiment runtime has been removed.
- **#276 remains the main architectural/research tracker**: first reconcile its historical checklist against the already-materialized P0/P1/P2 work, then prioritize measurable Three.js performance and a common renderer evidence contract before richer overlays or promotion.

Keep the proven semantic/rendering contracts frozen until new evidence identifies a concrete product, maintenance, performance or release gap.
