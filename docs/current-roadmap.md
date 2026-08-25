# Current roadmap

Status snapshot: **2026-08-26**

This is the short canonical list of work that is still worth doing. Historical research, old phase documents, closed experiment carriers, and older release receipts remain elsewhere in `docs/` and GitHub history; they are not active TODOs merely because they still exist.

## P1 — no active production acceptance blocker

The current production state is healthy:

- The last product/runtime Pages baseline is **`1aef658c62ea7d3f6617e4ef92e61c4183089ab0`** (`Document scene-aware pan containment`). Main may advance beyond that baseline for documentation-only maintenance without changing the runtime claim. Baseline main-push **Verify #1001 / `32837286203`** passed full Verify, twelve-preset comparison, Chromium, and iPhone WebKit. Baseline main-push **Pages #179 / `32837286129`** completed build and deploy successfully.
- Stable reusable **`v1` is `72ead19e8c49354af2bcbfa9144404c7a8d6ff9f`**. It is intentionally independent from Pages `main`. Its reusable workflow pins immutable taxonomy artifact-identity Action **F `9d018370d7b22d82d8974ae1ac018de5589dd85a`**; advancing interactive Pages-only or documentation-only work must not move `v1`.
- The taxonomy artifact-identity release is proven end to end: implementation F passed **Verify #1054 / `32874394913`**; exact read-only real-profile proof **#203 / `32884677113`** preserved `lime_tidyup` as `robotics-automation` with `artifact:service`, ROS2/Gazebo facets, and accepted Contributed evidence while removing incidental `artifact:documentation`; release-chain candidate **Verify #1057 / `32885280022`** passed full Verify, twelve-preset rendering, Chromium, and iPhone WebKit; production profile refresh **#204 / `32885875590`** resolved `@v1` to `72ead19e8c49354af2bcbfa9144404c7a8d6ff9f` and published map commit `ec06d4614925b85b3acb6c59fb72652fef48f00a`.

### Frozen product boundaries

- The IPM ↔ static SVG Contributed contract is relation-first across all twelve presets: Contributed is explicit external work, uses the reviewed warm identity, does not gain owned category membership, and canonical `contribution` edges remain semantic evidence rather than ownership-like layout membership.
- `fork` / `archived` are secondary source flags. They must not override primary `relation: "contributed"` presentation.
- Static generated graph data, browser projections/layouts, and source ownership/taxonomy remain separate contracts.
- Stable `v1`, the outer reusable workflow, and the immutable inner Action pin are separate release/authority layers. Do not conflate or move them without the declared release-chain proof.
- The GitHub-only setup path remains the production onboarding architecture.
- The optional Cloudflare/GitHub App one-click installer remains **DORMANT / NOT_PRODUCTION_EXPOSED**. Keep its retained implementation and security tests compatible with `main`, but do not advertise, credential-test, expand, or reactivate it without concrete onboarding evidence or an explicit reviewed product decision. Public exposure still requires the separate `ENABLE_ONE_CLICK_INSTALLER=true` gate plus complete credentials and real-credential acceptance.
- Real GitHub/Cloudflare credentials must never enter tracked files.

## Recent completed viewer work

The shared interactive `/u/` camera/background UX line is complete enough to treat as the current baseline rather than an open project:

- Camera coherence normalizes wheel delta modes, preserves pointer-anchored zoom, applies common scene-aware zoom bounds to wheel / keyboard / pinch, and prevents ordinary scenes from shrinking into tiny islands surrounded by effectively unbounded empty space.
- The cosmic background now shares camera depth: deterministic far/mid/near star planes respond to pan and zoom, a stable world-anchored diffuse galaxy envelope provides body-to-deep-space transition, and reduced-motion behavior remains gated. Rendered browser/pixel evidence is required for this low-contrast visual layer.
- Scene-aware pan containment keeps the graph from being lost in empty space. Empty-space drag may elastically exceed the hard guard with resistance, then settles inside scene-derived bounds when pointer interaction ends; zoom paths are contained by the same guard. Node drag, Fit, Reset, static SVG output, dedicated viewers, and stable `v1` remain untouched.
- The current shared Galaxy Systems / Hybrid label layer already uses adaptive semantic LOD with smooth detail scaling, density budgeting, and eligibility hysteresis. Do **not** reopen the base viewer's raw repository-label threshold as a default-viewer bug unless rendered evidence shows an actual remaining regression. Classic/Obsidian label-transition tuning is discretionary UX work, not a blocker.

## P2 — maintenance / deferred work only when evidence appears

- **ONE_CLICK_INSTALLER → DORMANT / NOT_PRODUCTION_EXPOSED.** Maintain compatibility only; do not expand it without measured onboarding friction or an explicit reviewed product decision.
- **Do not add new visual style presets now.** Magic-circle / spell-array, activation-sequence, selection-only cast/explosion, and SF × magic concepts remain parked in `docs/future-visual-style-ideas.md`. Revisit only if a candidate materially improves readability, hierarchy, focus feedback, dense-profile behavior, or profile identity over current production layouts.
- Dependabot / Action pin maintenance should be grouped and reviewed rather than churned one update at a time.
- Re-run large-portfolio stress only when graph/layout behavior changes materially.
- Revisit additional clustering only if materially different evidence appears; do not restart the rejected clustering experiment by default.
- Advanced SVG width/height exposure or further compacting mobile controls remain discretionary UX polish.
- Camera inertia, animated settling, or additional Classic/Obsidian label-transition polish should be added only if rendered evidence demonstrates a real interaction/readability benefit; avoid motion for motion's sake.
- Contributed motion-scheduler consolidation or lower-layer viewer-adapter cleanup is architecture maintenance only. Proceed only when a focused change has measurable maintenance/runtime value and preserves the current semantics, reduced-motion behavior, dense-profile behavior, and browser evidence gates.

## Verification / promotion rule

For any future viewer or layout change, use the repository development loop:

`refresh live truth -> read this roadmap -> identify one product gap -> reuse existing shared projection/adapter -> smallest delta -> focused unit/static validation -> twelve-preset comparison where affected -> Chromium/WebKit rendered interaction proof where affected -> release proof only if release pins move`

Source/build success alone does not prove visible browser behavior. Conversely, Pages-only viewer changes do not justify stable `v1` promotion when the reusable Action/static output contract is unchanged.

## Current tracker state

There is no active static-SVG, interactive Contributed, stable-release, public-setup, Category-navigator, camera-coherence, cosmic-background, pan-containment, taxonomy artifact-identity, or one-click production acceptance blocker.

Treat **runtime baseline `1aef658c62ea7d3f6617e4ef92e61c4183089ab0`** and **stable reusable `v1 = 72ead19e8c49354af2bcbfa9144404c7a8d6ff9f`** as distinct reviewed baselines. Documentation-only main commits may advance independently. Keep the proven semantic/rendering contract frozen until new evidence identifies a concrete product, maintenance, performance, or release gap.
