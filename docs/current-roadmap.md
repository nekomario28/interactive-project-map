# Current roadmap

Status snapshot: **2026-08-22**

This is the short canonical list of work that is still worth doing. Historical research and completed phase documents remain in `docs/`, but they should not be mistaken for active TODOs.

## P0 — finish explicit external contribution support

The acquisition foundation is already merged in #117. The remaining product work is to promote public work in repositories owned by other people/organizations without implying ownership.

1. Evaluate a deterministic meaningful-work ranking/cap for the bounded 365-day GraphQL contribution data.
2. Add an explicit **Contributed** graph relation with full `owner/repo` identity and bounded contribution metadata.
3. Guarantee that no `ownership` path from the Project Map user can reach an external repository.
4. Extend strict static-graph sanitization for explicitly Contributed public repositories only.
5. Connect the generator behind an explicit inclusion policy; do not add PATs, browser fetching, or another backend.
6. Add `Contributed` beside Original / Fork / Archived and keep the behavior consistent across all 12 presets.
7. Gate composition with Search, Focus/Local Graph, Activity, URL sharing, empty-category pruning, hover/selection and aggregate layouts.
8. Run a real-profile privacy/UX proof, then one final full Verify + 12-preset + Chromium + iPhone WebKit gate.
9. Move the stable `v1` branch only after the final Contributed head is reviewed and GREEN.

Detailed plan and evidence: `docs/external-contributions-research.md`.

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

## Current tracker state

PR **#121** is the active product/UI change. Do not revive the rejected visual-style experiments while it is being validated. After #121, return to the P0 external-contribution line unless new evidence changes priority.
