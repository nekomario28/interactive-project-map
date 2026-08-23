# Current roadmap

Status snapshot: **2026-08-23**

This is the short canonical list of work that is still worth doing. Historical research and completed phase documents remain in `docs/`, but they should not be mistaken for active TODOs.

## P0 — finish explicit external contribution support

The bounded acquisition foundation, explicit Contributed graph schema, conservative generator integration, all-12-preset C4 semantics, and direct real-profile Action-F privacy proof are GREEN. The remaining work is the release-chain proof and stable production acceptance without implying ownership.

1. Promote the reusable workflow's immutable inner Action pin and both public metadata mirrors to **F = `e5dafc86bec1cee6d913deaf040a2631599afb53`**, while forwarding the existing opt-in `contributed` input in the same reviewed release change.
2. Run the full exact-head Verify + 12-preset comparison + Chromium + iPhone WebKit gates for that release change.
3. After merge, call the reusable workflow at exact release commit **R** with `contributed: true` and prove that it resolves inner Action F and reproduces the real-profile privacy/ownership invariants.
4. Only after that proof, move stable `v1` to R. Do not make Contributed globally default-on.
5. Opt the canonical `nekomario28/nekomario28` profile workflow into `contributed: true` through `@v1`, regenerate the published graph/SVG, and verify that at least one eligible Contributed repository is present with no private/restricted leakage or ownership path.
6. Perform the live GitHub Pages UX pass on that canonical map: Contributed identity/details, filters, shareable state and mobile behavior.

Direct production proof already completed: run `32631530792` against Action F produced 13 owned + 6 Contributed repositories, 6 direct contribution edges, 0 privacy-marker keys and 0 ownership violations. Detailed evidence: `docs/contributed-generator-c3.md` and `docs/external-contributions-research.md`.

## P1 — production acceptance checks

These are small but useful operational checks rather than new architecture.

- Finish and validate **#121 Category navigator / focus index**: Category label selects the Category, `+ / −` independently discloses repositories, repository rows select repositories, Search temporarily expands matching Categories, current status filters are respected, and existing context-preserving selection dimming is reused instead of creating another graph-filtering model. Keep repository Local Graph depth 1–3 independent.
- Exercise the optional Cloudflare/GitHub App one-click path with real operator credentials if it is going to be advertised as a live convenience. This is **not** a dependency of the GitHub-only default path and is not a blocker for Project Map itself.
- Keep real Cloudflare/GitHub credentials only in Cloudflare secret storage or ignored local files. Public tracked files may contain names, documentation and obvious placeholders only.

## P2 — maintenance / deferred ideas only when evidence appears

- **Do not add new visual style presets now.** Magic-circle / spell-array, activation-sequence, selection-only cast/explosion, and SF × magic ideas are parked in `docs/future-visual-style-ideas.md`. Revisit only if a candidate materially improves readability, hierarchy, focus feedback, dense-profile behavior, or profile identity over current production layouts.
- Dependabot/action pin maintenance: update in grouped, reviewed changes rather than churn.
- Re-run large-portfolio stress only when graph/layout behavior changes materially.
- Revisit additional clustering only if materially different evidence appears; do not restart the rejected experiment by default.

## Completed / no longer TODO

- Search-aware repository/category context, facet reasons, keyboard navigation and dedicated-preset search emphasis are implemented (#62, #63, #64). `docs/future-ui-todos.md` is historical and should not be read as an active Search TODO.
- Original / Fork / Archived projection consistency and empty-category pruning are implemented (#103, #104, #109, #110).
- Redundant Status/Activity draw-time wrappers were removed in #111.
- Local clustering evaluation issue #61 is closed **NO-GO** after the 0.72–0.90 threshold sweep; the standard taxonomy + Local Graph remains the default.
- Stable reusable-generator setup, repair/update semantics and advanced immutable pinning are implemented (#98, #105, #107).
- Beginner profile-repository onboarding plus public-repo Cloudflare secret hardening are implemented in #115.
- External contribution API feasibility was proven in diagnostic #116 and the bounded source/static acquisition foundation merged in #117.
- C1 ranking/cap, C2 graph schema/privacy boundary and C3 generator integration are implemented.
- C4a shared Galaxy/Obsidian Contributed viewer contract merged in **#129** after exact-head Verify, Chromium and iPhone WebKit were GREEN.
- C4b dedicated-viewer semantics merged in **#140**: strict external `owner/repo` reconstruction, Contributed-over-fork/archive precedence, fourth status/filter/URL alias, presentation-only external layout context where required, aggregate fourth buckets, and C2-shaped eight-route browser gates.
- C5 direct Action-F real-profile/privacy proof is GREEN on run `32631530792`; its experimental output was artifact-only and did not replace the canonical profile map.

## Current tracker state

The active P0 line is the inner-pin/reusable-workflow release proof on `release/contributed-inner-pin`. Do not move `v1`, enable Contributed globally by default, or revive rejected visual-style experiments before exact release proof is GREEN.
