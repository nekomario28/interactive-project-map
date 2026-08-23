# Interactive Project Map agent entrypoint

This is the provider-neutral entrypoint for Project Map work. `docs/current-roadmap.md`, current main/live PR state, accepted release/evidence records, and the affected source/tests are authoritative. Historical research documents and experiment carriers are not active TODOs merely because they still exist.

## Read first

1. `README.md` for product/trust/setup architecture.
2. `docs/current-roadmap.md` for the short canonical active-work list.
3. `CONTRIBUTING.md` and `SECURITY.md` when contribution, permissions, secrets, GitHub App, or public setup behavior is affected.
4. The exact current PR/head plus affected packages/viewer/action/workflow files and their validation gates.
5. Relevant historical docs only when they explain an accepted decision or rejected alternative.

## Product and release boundaries

- The GitHub-only setup path is the default production architecture.
- The optional Cloudflare/GitHub App one-click installer is **DORMANT / NOT_PRODUCTION_EXPOSED**. Keep its small implementation and tests compatible with `main`, but do not advertise, credential-test, expand, or reactivate it without concrete onboarding evidence or an explicit reviewed product decision. Public exposure requires the separate `ENABLE_ONE_CLICK_INSTALLER=true` gate plus complete credentials and the documented real-credential acceptance.
- Stable `v1`, the outer reusable workflow, and the immutable inner Action pin are distinct release/authority layers. Do not move or conflate them without the declared release-chain proof.
- Contributed is an explicit non-ownership relation, default-off globally. External repositories must not be silently promoted into owned taxonomy/category membership.
- Missing/unsupported optional installer semantics fail closed rather than silently dropping user opt-in.
- Static generated graph data, browser projections/layouts, and source ownership/taxonomy are separate contracts.

## Development loop

`refresh live truth -> read current-roadmap -> identify one product gap -> inspect existing shared adapter/projection before adding renderer-specific logic -> research/reuse when a new mechanism is genuinely needed -> implement the smallest delta -> focused unit/static validation -> twelve-preset comparison where affected -> Chromium/WebKit rendered interaction proof where affected -> exact release proof when release pins move`

Prefer one shared projection/adapter over copying behavior into multiple viewers. Reuse `spatial-core` and existing browser/view-state boundaries before adding another graph model.

## Evidence and visual verification

- Source/build success does not prove rendered browser behavior.
- When UI/viewer behavior changes, validate the actual rendered/interactive outcome with the existing browser gates; state-only assertions are insufficient for visible regressions.
- Preserve desktop Chromium and mobile WebKit coverage when the affected surface requires them.
- Large-portfolio stress, new clustering, and new visual styles stay deferred unless new evidence triggers them; do not reopen NO-GO work by default.
- Experimental AI Director or other `Do not merge` execution lanes are not Project Map product state.
- `NOT_RUN`, optional-path-unverified, NO-GO, historical, dormant, and production-proven are distinct evidence states.

## Secrets and permissions

- Never commit real GitHub/Cloudflare credentials or tokens.
- Public tracked files may contain documentation, names, feature-gate defaults, and obvious placeholders only.
- Do not widen workflow/App permissions or introduce a backend merely to simplify one setup interaction without an explicit reviewed decision.

## Cross-project boundary

Cross-repository agent/development-engineering contracts are tracked in `nekomario28/project-incubator`. Interactive Project Map remains authoritative for graph/taxonomy semantics, public setup, renderers, browser behavior, release-chain policy, permissions, and production acceptance.

Provider-specific instruction files should bridge to this entrypoint rather than duplicate it.
