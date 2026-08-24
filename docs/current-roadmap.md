# Current roadmap

Status snapshot: **2026-08-24**

This is the short canonical list of work that is still worth doing. Historical research and completed phase documents remain in `docs/`, but they should not be mistaken for active TODOs.

## P1 — static SVG Contributed parity / stable release drift

Interactive Contributed semantics are production-proven, but the generated static SVG family has drifted behind the interactive viewer contract. This is now an active correctness/release task, not discretionary visual polish.

Confirmed on 2026-08-24:

- current interactive `main` uses the simplified Contributed presentation: warm orange, explicit text/details, no always-on direct contribution spoke, no decorative Contributed halo, and presentation-only owner-centered Galaxy motion without owned membership;
- stable `v1` still carries the older cyan Contributed palette, so profile repositories generated through `@v1` can legitimately remain visually behind `main` until the reviewed release ref advances;
- the canonical `nekomario28/nekomario28/project-map/galaxy.svg` currently demonstrates that release drift;
- static Galaxy Systems additionally used a synthetic presentation `External contributions` category hub, while interactive Galaxy uses owner-centered external orbits;
- Galaxy Classic/Hybrid/Obsidian and the eight dedicated static SVG renderers have further Contributed retention/status/aggregation gaps documented in `docs/static-svg-parity-audit-2026-08-24.md`.

Current repair boundary:

1. align the currently published Galaxy Systems renderer first without mutating canonical `groupId`/membership;
2. introduce/reuse one shared static Contributed semantic boundary for relation-first status, palette/legend, external layout context and direct-contribution-edge suppression rather than eight unrelated patches;
3. cover Matrix/Sankey aggregate fourth-bucket semantics and static layouts that currently omit ungrouped external repositories;
4. run exact-head unit/static checks, twelve-preset comparison and Chromium/WebKit gates;
5. prove the reviewed release through the reusable workflow on a real profile;
6. only then advance stable `v1` and verify the canonical profile graph/SVG pair regenerated through that exact release.

Do **not** fast-forward `v1` merely because current `main` or one renderer is fixed. Partial parity must not be promoted as a complete static release.

The GitHub-only setup path remains the production onboarding path. The optional Cloudflare/GitHub App one-click installer is deliberately **DORMANT / NOT_PRODUCTION_EXPOSED**: its implementation and security/regression tests remain retained, but credential presence alone must not expose it. Public UI and installer routes require the separate explicit `ENABLE_ONE_CLICK_INSTALLER=true` gate, which stays off by default.

Real Cloudflare/GitHub credentials must remain only in Cloudflare secret storage or ignored local files. Public tracked files may contain names, documentation and obvious placeholders only.

## P2 — maintenance / deferred ideas only when evidence appears

- **ONE_CLICK_INSTALLER → DORMANT / NOT_PRODUCTION_EXPOSED.** Keep the small implementation, signed-state/callback compatibility, managed-workflow ownership rules and security tests maintained with `main`; do not advertise, credential-test, or expand it until measured onboarding friction or an explicit reviewed product decision justifies reactivation.
- **Do not add new visual style presets now.** Magic-circle / spell-array, activation-sequence, selection-only cast/explosion, and SF × magic ideas are parked in `docs/future-visual-style-ideas.md`. Revisit only if a candidate materially improves readability, hierarchy, focus feedback, dense-profile behavior, or profile identity over current production layouts.
- Dependabot/action pin maintenance: update in grouped, reviewed changes rather than churn.
- Re-run large-portfolio stress when graph/layout behavior changes materially; static Contributed parity is such a change for any renderer whose layout boundary changes.
- Revisit additional clustering only if materially different evidence appears; do not restart the rejected experiment by default.
- Advanced SVG width/height exposure or further compacting mobile controls remain discretionary UX polish, not correctness blockers.

## Completed / no longer TODO

- Search-aware repository/category context, facet reasons, keyboard navigation and dedicated-preset search emphasis are implemented (#62, #63, #64). `docs/future-ui-todos.md` is historical and should not be read as an active Search TODO.
- Original / Fork / Archived projection consistency and empty-category pruning are implemented (#103, #104, #109, #110).
- Redundant Status/Activity draw-time wrappers were removed in #111.
- **#121 Category navigator / focus index** merged on 2026-08-22: Category labels focus Categories, `+ / −` disclosure is independent, repository rows select repositories, Search temporarily expands matches, status filters remain authoritative, the shared runtime covers all nine interactive viewer routes, and Local Graph depth 1–3 remains independent. Its exact-head Verify, twelve-preset comparison, Chromium and iPhone WebKit gates were GREEN.
- Local clustering evaluation issue #61 is closed **NO-GO** after the 0.72–0.90 threshold sweep; the standard taxonomy + Local Graph remains the default.
- Stable reusable-generator setup, repair/update semantics and advanced immutable pinning are implemented (#98, #105, #107).
- Beginner profile-repository onboarding plus public-repo Cloudflare secret hardening are implemented in #115.
- External contribution API feasibility was proven in diagnostic #116 and the bounded source/static acquisition foundation merged in #117.
- C1 ranking/cap, C2 graph schema/privacy boundary and C3 generator integration are implemented.
- C4a shared Galaxy/Obsidian Contributed viewer contract merged in **#129** after exact-head Verify, Chromium and iPhone WebKit were GREEN.
- C4b dedicated-viewer semantics merged in **#140**: strict external `owner/repo` reconstruction, Contributed-over-fork/archive precedence, fourth status/filter/URL alias, presentation-only external layout context where required, aggregate fourth buckets, and C2-shaped eight-route browser gates.
- C5 direct Action-F real-profile/privacy proof is GREEN on run `32631530792`: 13 owned + 6 Contributed repositories, 6 direct contribution edges, 0 privacy-marker keys and 0 ownership violations.
- Release-chain PR **#141** advanced the reusable inner Action and public metadata mirrors to F. Exact-head run **#694 / `32631951199`** passed Verify, taxonomy, 12-preset comparison, Chromium, iPhone WebKit and evidence upload before merge.
- Exact reusable-workflow proof run **`32632124217`** proved R → F resolution and reproduced 13 owned + 6 Contributed, privacy 0 and ownership 0.
- Stable **`v1`** was then fast-forwarded to R; Contributed remains default-off globally. That release remains valid for its reviewed contract, but is now intentionally held until the newly discovered static visual parity work is complete.
- Canonical `nekomario28/nekomario28` generation through `@v1` published commit **`ad6930e4339dfe1a3ba74da946776e54701dc73f`** containing 6 Contributed nodes and 6 direct `contribution` edges.
- Live GitHub Pages proof run **`32632402395`** passed desktop Chromium and mobile WebKit against the published canonical map: 6 Contributed repositories, details/status sharing working, `status=c` restored on mobile, no horizontal overflow, and 0 browser errors. Temporary proof workflows were removed after their receipts were recorded.
- Public setup exposure merged in **#143**: both public generator surfaces show an explicit unchecked **Include Contributed** control, generated stable-`@v1` workflows always emit `contributed: true|false`, share URLs restore the choice, README/setup copy defines Contributed as work in repositories owned by others rather than ownership, and focused install/Pages/hosted-UI validators freeze the default-off contract.
- Optional GitHub App state/callback support merged in **#145**: old v1 payloads with no `includeContributed` normalize to false, explicit booleans are signed and restored, malformed non-booleans are rejected, and the managed workflow receives the restored value. This code is retained for future reuse but is not a public production surface while the installer is dormant.
- **#148 UI contract audit fixes** merged on 2026-08-24: Sunburst restores dense-profile label LOD instead of drawing all 300 repository names over one another; direct search hits remain readable; every interactive route has explicit Contributed legend semantics; zero-count mobile status chips stop consuming narrow-screen space; and the Pages setup UI now uses one 0→3 onboarding sequence, labels theme as the profile SVG theme, collapses the duplicate style selector, explains the bounded Contributed window/cap, and warns when the currently published SVG can still reflect previous settings. Exact-head Verify, twelve-preset comparison, Chromium (including the new 300-repository canvas assertion) and iPhone WebKit were GREEN.
- **#149 dormant Worker setup consolidation** merged on 2026-08-24: in the normal dormant state, Worker `/` redirects to the canonical GitHub Pages generator instead of exposing a second drifting registration UI. The retained legacy Worker home is available only if the existing explicit one-click exposure condition is deliberately satisfied; Worker APIs/viewer/fallback remain intact. The reusable workflow also now describes `theme` as the **Static profile SVG theme**. Exact-head Verify, Chromium and iPhone WebKit were GREEN.
- **Repository cleanup (2026-08-24):** speculative Visual Block IR adapter PR #120 was closed **NO-GO** after re-audit found no `SpatialGraph` consumer or duplication to remove; AI Director execution-only PRs #130–#139 were closed unmerged as historical receipts after their research line moved to `nekomario28/shotfork`, where derived outcome/coverage/runtime evidence is canonicalized. At that cleanup snapshot, product open PRs and open issues were both zero.

## Current tracker state

The active product correctness task is now **IPM ↔ static SVG Contributed parity**, including stable `v1` release drift. Interactive C4/C5 semantics remain proven; the regression is in static presentation parity and release propagation, not contribution discovery/privacy/ownership semantics.

The first repair is isolated on `fix/static-contributed-parity`: align Galaxy Systems with the interactive owner-centered external-orbit contract and freeze the finding with a focused regression test. Broader static-core parity remains required before moving `v1`. The optional one-click implementation remains dormant and should not consume active roadmap attention.
