# Current roadmap

Status snapshot: **2026-08-23**

This is the short canonical list of work that is still worth doing. Historical research and completed phase documents remain in `docs/`, but they should not be mistaken for active TODOs.

## P1 — no active production acceptance blocker

The GitHub-only setup path is the production onboarding path. The optional Cloudflare/GitHub App one-click installer is deliberately **DORMANT / NOT_PRODUCTION_EXPOSED**: its implementation and security/regression tests remain in `main`, but credential presence alone must not expose it. Public UI and installer routes require the separate explicit `ENABLE_ONE_CLICK_INSTALLER=true` gate, which stays off by default.

One-click real-credential acceptance is therefore **not an active P1 task**. Reactivate it only when concrete evidence justifies the extra GitHub App/Cloudflare operational surface—for example, measured onboarding friction in the GitHub-only workflow or an explicit reviewed product decision. Reactivation must then include the documented real-credential acceptance before public exposure.

Real Cloudflare/GitHub credentials must remain only in Cloudflare secret storage or ignored local files. Public tracked files may contain names, documentation and obvious placeholders only.

## P2 — maintenance / deferred ideas only when evidence appears

- **ONE_CLICK_INSTALLER → DORMANT / NOT_PRODUCTION_EXPOSED.** Keep the small implementation, signed-state/callback compatibility, managed-workflow ownership rules and security tests maintained with `main`; do not advertise, credential-test, or expand it until the reactivation condition above is met.
- **Do not add new visual style presets now.** Magic-circle / spell-array, activation-sequence, selection-only cast/explosion, and SF × magic ideas are parked in `docs/future-visual-style-ideas.md`. Revisit only if a candidate materially improves readability, hierarchy, focus feedback, dense-profile behavior, or profile identity over current production layouts.
- Dependabot/action pin maintenance: update in grouped, reviewed changes rather than churn.
- Re-run large-portfolio stress only when graph/layout behavior changes materially.
- Revisit additional clustering only if materially different evidence appears; do not restart the rejected experiment by default.

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
- Stable **`v1`** was then fast-forwarded to R; Contributed remains default-off globally.
- Canonical `nekomario28/nekomario28` generation through `@v1` published commit **`ad6930e4339dfe1a3ba74da946776e54701dc73f`** containing 6 Contributed nodes and 6 direct `contribution` edges.
- Live GitHub Pages proof run **`32632402395`** passed desktop Chromium and mobile WebKit against the published canonical map: 6 Contributed repositories, details/status sharing working, `status=c` restored on mobile, no horizontal overflow, and 0 browser errors. Temporary proof workflows were removed after their receipts were recorded.
- Public setup exposure merged in **#143**: both public generator surfaces show an explicit unchecked **Include Contributed** control, generated stable-`@v1` workflows always emit `contributed: true|false`, share URLs restore the choice, README/setup copy defines Contributed as work in repositories owned by others rather than ownership, and focused install/Pages/hosted-UI validators freeze the default-off contract.
- Optional GitHub App state/callback support merged in **#145**: old v1 payloads with no `includeContributed` normalize to false, explicit booleans are signed and restored, malformed non-booleans are rejected, and the managed workflow receives the restored value. This code is retained for future reuse but is not a public production surface while the installer is dormant.

## Current tracker state

There is no remaining C5, public-setup, Category-navigator, or active one-click blocker. The stable Contributed implementation is production-proven, published and exposed through the GitHub-only path while remaining default-off. The optional one-click implementation is preserved and CI-covered but deliberately dormant; it should not consume active roadmap attention until its explicit reactivation condition is met.
