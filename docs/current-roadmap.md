# Current roadmap

Status snapshot: **2026-08-23**

This is the short canonical list of work that is still worth doing. Historical research and completed phase documents remain in `docs/`, but they should not be mistaken for active TODOs.

## P0 — finish explicit external contribution support

The bounded acquisition foundation, explicit Contributed graph schema, conservative generator integration, shared Galaxy/Obsidian viewer contract, and dedicated-preset C4 semantics are implemented. The remaining product work is the C5 real-profile production proof and stable-channel promotion without implying ownership.

1. Generate a real profile graph containing both owned and Contributed repositories and verify that no private/restricted repository name or metadata is serialized.
2. Perform one live GitHub Pages UX pass on the generated profile map, including Contributed identity/details, filters, shareable state and mobile behavior.
3. Run one final full Verify + 12-preset comparison + Chromium + iPhone WebKit gate on the exact reviewed production-proof head.
4. Move the stable `v1` branch only after that final Contributed head is reviewed and GREEN.

Detailed plan and evidence: `docs/external-contributions-research.md`. Dedicated C4b implementation boundary: `docs/contributed-dedicated-c4b.md`.

## P1 — production acceptance checks

These are small but useful operational checks rather than new architecture.

- Finish and validate **#121 Category navigator / focus index**: Category label selects the Category, `+ / −` independently discloses repositories, repository rows select repositories, Search temporarily expands matching Categories, current status filters are respected, and existing context-preserving selection dimming is reused instead of creating another graph-filtering model. Keep repository Local Graph depth 1–3 independent.
- Do one live GitHub Pages UX pass after the next production feature lands: beginner Step 0 profile-repo creation, Step 1 workflow handoff, Step 2 initial run, map load, mobile behavior and shareable state.
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
- C4b dedicated-viewer semantics are implemented in **#140**: strict external `owner/repo` reconstruction, Contributed-over-fork/archive precedence, fourth status/filter/URL alias, presentation-only external layout context where required, aggregate fourth buckets, and C2-shaped eight-route browser gates. The implementation head was GREEN on Verify, 12-preset comparison, Chromium and iPhone WebKit before the final roadmap-only update.

## Current tracker state

C5 production proof is the active P0 line. Do not move `v1`, enable Contributed by default, or revive rejected visual-style experiments before the real-profile privacy/UX proof and final exact-head gates are GREEN.
