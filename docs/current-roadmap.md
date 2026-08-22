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

- Do one live GitHub Pages UX pass after the next production feature lands: beginner Step 0 profile-repo creation, Step 1 workflow handoff, Step 2 initial run, map load, mobile behavior and shareable state.
- Keep the experimental **Profile Galaxy / magic-UI** line evidence-driven. The earlier Arcane Circle v2 / Techno Arcana v2 / Celestial Orrery v2 visual candidates are **not** production candidates; only their independently expandable Category navigator, Category focus, Repository focus, context-preserving dimming and bounded focus feedback remain product candidates. A new real 740×420 implementation on `experiment/anime-magic-ipm-styles` now tests `Crimson Cast`, `CAD Sequence`, `Layered Formula`, and `Arcane Compiler`, using dramatic cast staging and CAD/activation-sequence information-processing principles rather than copying characters or proprietary layouts. `CAD Sequence` is currently the strongest information-architecture candidate and `Crimson Cast` the strongest profile-identity candidate, but no production preset ID should be added until the same real `graph.json`, representative small/medium profiles, 20–80 repository readability, 100/300 stress where applicable, keyboard/touch, reduced-motion, and Galaxy Systems/Hybrid/Obsidian comparison gates pass. Detailed evidence: `docs/anime-magic-style-evaluation-2026-08-22.md`.
- Exercise the optional Cloudflare/GitHub App one-click path with real operator credentials if it is going to be advertised as a live convenience. This is **not** a dependency of the GitHub-only default path and is not a blocker for Project Map itself.
- Keep real Cloudflare/GitHub credentials only in Cloudflare secret storage or ignored local files. Public tracked files may contain names, documentation and obvious placeholders only.

## P2 — maintenance only when evidence appears

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

At this snapshot there are no open product issues or open PRs in this repository. New work should be opened from the P0/P1 items above rather than reviving completed historical phases.
