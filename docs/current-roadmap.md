# Current roadmap

Status snapshot: **2026-08-23**

This is the short canonical list of work that is still worth doing. Historical research and completed phase documents remain in `docs/`, but they should not be mistaken for active TODOs.

## P0 — expose the stable Contributed opt-in in public setup

The Contributed data model, generator, all-12-preset semantics, real-profile privacy proof, release chain, stable `v1` promotion, canonical profile regeneration, and live GitHub Pages UX proof are complete. The remaining product gap is **public setup exposure**, not another schema/viewer/release phase.

1. Add an explicit Contributed opt-in to the public install options / setup generator and emit `contributed: true|false` into the generated reusable-workflow call.
2. Keep the default **false**. Do not silently change existing generated workflows or globally enable external contribution collection.
3. Update public setup copy/README so users understand that Contributed means work in repositories owned by other people or organizations, never repository ownership.
4. Add focused install/setup tests proving the stable `@v1` workflow receives the option without changing existing defaults.

This work is now safe because stable `v1` already resolves release **R = `b0734590a7ea65fea68eee9fb4e9b5c5d40ee8a0`**, whose reusable workflow resolves inner Action **F = `e5dafc86bec1cee6d913deaf040a2631599afb53`**.

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
- C5 direct Action-F real-profile/privacy proof is GREEN on run `32631530792`: 13 owned + 6 Contributed repositories, 6 direct contribution edges, 0 privacy-marker keys and 0 ownership violations.
- Release-chain PR **#141** advanced the reusable inner Action and public metadata mirrors to F. Exact-head run **#694 / `32631951199`** passed Verify, taxonomy, 12-preset comparison, Chromium, iPhone WebKit and evidence upload before merge.
- Exact reusable-workflow proof run **`32632124217`** proved R → F resolution and reproduced 13 owned + 6 Contributed, privacy 0 and ownership 0.
- Stable **`v1`** was then fast-forwarded to R; Contributed remains default-off globally.
- Canonical `nekomario28/nekomario28` generation through `@v1` published commit **`ad6930e4339dfe1a3ba74da946776e54701dc73f`** containing 6 Contributed nodes and 6 direct `contribution` edges.
- Live GitHub Pages proof run **`32632402395`** passed desktop Chromium and mobile WebKit against the published canonical map: 6 Contributed repositories, details/status sharing working, `status=c` restored on mobile, no horizontal overflow, and 0 browser errors. Temporary proof workflows were removed after their receipts were recorded.

## Current tracker state

There is no remaining C5 release blocker. The stable Contributed implementation is production-proven and published. The next P0 is only the **default-off public setup opt-in**. Do not change the global default, revive rejected visual-style experiments, or add another contribution data source without new evidence.
