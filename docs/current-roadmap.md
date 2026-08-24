# Current roadmap

Status snapshot: **2026-08-24**

This is the short canonical list of work that is still worth doing. Historical research and completed phase documents remain in `docs/`, but they should not be mistaken for active TODOs.

## P1 — no active production acceptance blocker

The IPM ↔ static SVG Contributed parity release is complete. Interactive and generated static presentations now share the reviewed relation-first contract across all twelve presets: Contributed is explicit external work, uses the warm orange identity, does not gain owned category membership, and its canonical `contribution` edge remains semantic evidence/data rather than an ownership-like visible spoke or layout spring.

Stable `v1` and `main` were aligned at release commit **R `2a172c3c62e8be8138e38822f05dd48671072209`**, which pins inner Action implementation **F `a5519222947325ff71a20309c483feba1085c718`**. Exact reusable-workflow proof run **`32695676884`** then proved R → F resolution on the real `nekomario28` profile before `v1` was fast-forwarded. The canonical profile subsequently regenerated through `@v1` and published commit **`2e9972832674cef02e30d8999e4159157edf4830`** with the simplified static Contributed presentation.

The GitHub-only setup path remains the production onboarding path. The optional Cloudflare/GitHub App one-click installer is deliberately **DORMANT / NOT_PRODUCTION_EXPOSED**: its implementation and security/regression tests remain retained, but credential presence alone must not expose it. Public UI and installer routes require the separate explicit `ENABLE_ONE_CLICK_INSTALLER=true` gate, which stays off by default.

Real Cloudflare/GitHub credentials must remain only in Cloudflare secret storage or ignored local files. Public tracked files may contain names, documentation and obvious placeholders only.

## P2 — maintenance / deferred ideas only when evidence appears

- **ONE_CLICK_INSTALLER → DORMANT / NOT_PRODUCTION_EXPOSED.** Keep the small implementation, signed-state/callback compatibility, managed-workflow ownership rules and security tests maintained with `main`; do not advertise, credential-test, or expand it until measured onboarding friction or an explicit reviewed product decision justifies reactivation.
- **Do not add new visual style presets now.** Magic-circle / spell-array, activation-sequence, selection-only cast/explosion, and SF × magic ideas are parked in `docs/future-visual-style-ideas.md`. Revisit only if a candidate materially improves readability, hierarchy, focus feedback, dense-profile behavior, or profile identity over current production layouts.
- Dependabot/action pin maintenance: update in grouped, reviewed changes rather than churn.
- Re-run large-portfolio stress only when graph/layout behavior changes materially.
- Revisit additional clustering only if materially different evidence appears; do not restart the rejected experiment by default.
- Advanced SVG width/height exposure or further compacting mobile controls remain discretionary UX polish, not correctness blockers.
- The dedicated Contributed motion scheduler and lower-layer viewer adapters may be simplified later if a focused architecture change can preserve the current semantics, reduced-motion behavior and exact visual contract. Do not reopen them as product blockers without evidence of maintenance or runtime cost.

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
- Release-chain PR **#141** advanced the earlier reusable inner Action and public metadata mirrors. Exact-head run **#694 / `32631951199`** passed Verify, taxonomy, 12-preset comparison, Chromium, iPhone WebKit and evidence upload before merge.
- Earlier exact reusable-workflow proof run **`32632124217`** proved its R → F resolution and reproduced 13 owned + 6 Contributed, privacy 0 and ownership 0.
- Public setup exposure merged in **#143**: both public generator surfaces show an explicit unchecked **Include Contributed** control, generated stable-`@v1` workflows always emit `contributed: true|false`, share URLs restore the choice, README/setup copy defines Contributed as work in repositories owned by others rather than ownership, and focused install/Pages/hosted-UI validators freeze the default-off contract.
- Optional GitHub App state/callback support merged in **#145**: old v1 payloads with no `includeContributed` normalize to false, explicit booleans are signed and restored, malformed non-booleans are rejected, and the managed workflow receives the restored value. This code is retained for future reuse but is not a public production surface while the installer is dormant.
- **#148 UI contract audit fixes** merged on 2026-08-24: Sunburst restores dense-profile label LOD instead of drawing all 300 repository names over one another; direct search hits remain readable; every interactive route has explicit Contributed legend semantics; zero-count mobile status chips stop consuming narrow-screen space; and the Pages setup UI now uses one 0→3 onboarding sequence, labels theme as the profile SVG theme, collapses the duplicate style selector, explains the bounded Contributed window/cap, and warns when the currently published SVG can still reflect previous settings. Exact-head Verify, twelve-preset comparison, Chromium (including the 300-repository canvas assertion) and iPhone WebKit were GREEN.
- **#149 dormant Worker setup consolidation** merged on 2026-08-24: in the normal dormant state, Worker `/` redirects to the canonical GitHub Pages generator instead of exposing a second drifting registration UI. The retained legacy Worker home is available only if the existing explicit one-click exposure condition is deliberately satisfied; Worker APIs/viewer/fallback remain intact. The reusable workflow also now describes `theme` as the **Static profile SVG theme**. Exact-head Verify, Chromium and iPhone WebKit were GREEN.
- **#157 first static parity repair** aligned generated Galaxy Systems with the interactive Contributed semantics: no synthetic `External contributions` category hub, no owned membership mutation, warm Contributed identity, no decorative halo, and owner-centered external presentation. Exact-head **Verify #738** passed unit/static checks, twelve-preset comparison, Chromium and iPhone WebKit.
- **#158 renderer-wide static parity** merged as implementation **F `a5519222947325ff71a20309c483feba1085c718`**. All twelve static presets now retain relation-first Contributed semantics; Matrix/Sankey expose the fourth status bucket; canonical direct `contribution` edges are data-only for static rendering; category-oriented layouts use presentation-only external context; Classic no longer relies on the old fake `repositoryCount=81` mode-forcing hack. Exact-head **Verify #741** passed 265 tests, the C2-shaped all-preset Contributed gate, 300-repository stress, twelve-preset comparison, Chromium and iPhone WebKit.
- **#159 release-chain promotion** synchronized the reusable workflow, TypeScript mirror and Pages mirror to F, producing release **R `2a172c3c62e8be8138e38822f05dd48671072209`**. Exact-head **Verify #744** passed full verify, twelve-preset comparison, Chromium and iPhone WebKit.
- Evidence-only **#160** was closed unmerged after dedicated run **`32695676884`** proved exact reusable R resolves inner F and generated the real profile with the simplified Contributed SVG plus ownership/privacy invariants intact.
- Stable **`v1`** was then fast-forwarded without history rewrite to **R `2a172c3c62e8be8138e38822f05dd48671072209`**.
- Canonical profile workflow validation was updated for the simplified contract at `nekomario28/nekomario28` commit **`b1e0c5fc29cc99f551caf079691e39949a6d3ae0`**, replacing obsolete requirements for the synthetic external hub/old visual cue.
- Production regeneration through the new `@v1` published **`nekomario28/nekomario28` commit `2e9972832674cef02e30d8999e4159157edf4830`**. The resulting graph has 14 owned repositories + 1 accepted Contributed repository, no owned membership on that external repository, and one canonical `contribution` evidence edge. The published Galaxy Systems SVG uses `#E69F00`, `data-galaxy-external="true"`, `data-galaxy-orbit="contributed"`, and the explicit Contributed legend, while the obsolete synthetic `External contributions` hub is absent.
- **Repository cleanup (2026-08-24):** speculative Visual Block IR adapter PR #120 was closed **NO-GO** after re-audit found no `SpatialGraph` consumer or duplication to remove; AI Director execution-only PRs #130–#139 were closed unmerged as historical receipts after their research line moved to `nekomario28/shotfork`, where derived outcome/coverage/runtime evidence is canonicalized.

## Current tracker state

There is no active static-SVG, Contributed, stable-release, public-setup, Category-navigator or one-click production acceptance blocker. `main` and stable `v1` are aligned at R for the reviewed static Contributed release; the canonical profile has regenerated successfully through that release.

Further Contributed motion-scheduler consolidation or lower-layer adapter cleanup is architecture maintenance only. Keep the currently proven semantic/rendering contract frozen unless a focused change has measurable maintenance/runtime value and passes the existing all-preset, dense-profile and browser gates.
