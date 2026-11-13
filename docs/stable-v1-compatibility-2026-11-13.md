# Stable v1 compatibility assessment — 2026-11-13

## Release scope

This is an assessment and candidate change, **not a promotion of `refs/heads/v1`**.
Observed stable branch head: `9b062afdf8e7a0ff64c4a58d5e1c398ab7626704` with immutable inner Action `f1688ba0811ea17455edbd9e51dd82c5e67a0f4a`.
Reviewed main candidate: `d41dbf66027cfd6fba2080e15f2ff60aa7821d3a`, inner Action `293386179990d3ab3b2172e55ff1e934f988adeb`.

The pre-upgrade v1 Action drew Contributed Galaxy Systems nodes in animated **Halo**.
The reviewed main reusable workflow at `d41dbf6` defaulted the new optional `svg_contributed_layout` input to **Rail**, which would unexpectedly alter a legacy `@v1` Galaxy Systems caller who had no explicit layout input.

**Candidate compatibility contract:** reusable workflow's omitted layout defaults to `halo`; explicitly passing `rail` still selects Rail. Direct Action's omitted layout stays `rail`, preserving its existing independent default; do not conflate the workflow caller and direct Action contracts.

## Verified public caller census

The adoption census at `data/public-users.json` was checked 2026-11-12 and lists four public installations (including maintainer). Current default-branch workflow sources were inspected 2026-11-13:

| Profile | Source workflow | Reference | Style / options | Impact if v1 is promoted |
| --- | --- | --- | --- | --- |
| `nekomario28/nekomario28` | `.github/workflows/update-knowledge-graph.yml` | explicit reusable SHA `84395b4a782593e61e994dfddbdea781dab6090f` | Galaxy Systems, Contributed enabled, explicit `svg_contributed_layout: halo` | No automatic effect; separate exact-SHA proof required before changing profile |
| `rotep/rotep` | `.github/workflows/project-map.yml` | mutable reusable `@v1` | Galaxy Classic, Contributed disabled | Halo/Rail Galaxy Systems switch not exercised by this configuration; Action/release compatibility still requires smoke test |
| `RPG-478/RPG-478` | `.github/workflows/project-map.yml` | immutable reusable `9b062afdf8e7a0ff64c4a58d5e1c398ab7626704` | Galaxy Systems, Contributed disabled | Unaffected by moving `@v1`; pinned workflow remains older |
| `syun88/syun88` | `.github/workflows/project-map.yaml` | immutable **direct Action** `5f62155e586dce5d49280e3ca07446c0a201229f` | No explicit style or Contributed input (Action defaults) | Unaffected by moving reusable `@v1` |

These are known *public* users only. They do not prove the absence of unknown/private v1 clients. The regression contract therefore favors backward compatibility for legacy omitted layout.

## Existing public-profile render proof (inner Action only)

The current public `nekomario28/nekomario28` profile graph, generated at `2026-11-13T05:32:06.276Z`, contains **30 owned repositories, 12 Contributed repositories and 8 verified personal-Fork backlinks**. There is no repeated owned/Contributed label. Its public SVG uses `data-galaxy-external-layout="halo"`, contains **12** Contributed halo-orbit placements and contains no Rail layout marker.

The profile workflow currently invokes reusable commit `84395b4...` with `svg_contributed_layout: halo`, which uses the same reviewed inner Action `293386179990d3ab3b2172e55ff1e934f988adeb`. This is useful **existing inner-Action evidence**, but it is not proof of this new candidate reusable workflow's **omitted-input default**. The exact-SHA no-input reusable caller run is a separate remaining release gate.

## Release verification and rollback gates (not yet complete)

1. Validate this candidate workflow (its exact head SHA and immutable inner Action `2933861...`) with full Verify + Chromium + WebKit checks.
2. Run the actual candidate reusable workflow from a safe test caller at exact SHA, **without publishing to the profile or moving `v1`**. Validate Halo motion/orbits, 30 owned / 12 Contributed, zero verified duplicate pairs and eight Fork backlinks against a reproducible public profile fixture. Validate privacy and the owner summary.
3. Smoke-test Galaxy Classic with Contributed off as in `rotep` and Galaxy Systems without external contributed as in `RPG-478`; compare semantic output and dimensions with prior stable fixture. Test direct Action default independently.
4. Inspect package/license and code changes and record all GitHub Actions run URLs, immutable candidate SHA and proposed rollback SHA.
5. Only after these gates pass, advance **`refs/heads/v1` as a branch** from expected previous head (without force pushing) and run `scripts/audit-release-channel.mjs --require-current`. Verify the actual resolved inner Action, a generated public SVG and known callers. Roll back with the recorded previous SHA if needed.

Do not auto-promote this candidate in a PR merge. Branch protection rules for `main` and `v1` remain a separate maintenance task.

## 2026-11-13 pin-refresh candidate (subsequent to the historical baseline above)

Before advancing `v1`, refresh the immutable inner Action from the original audited `293386179990d3ab3b2172e55ff1e934f988adeb` to **feature head F = `cb58ea19bb7f1d09778924a38949f0074108b234`**.

This is required because F includes merged Three.js resource cleanup (#465), renamed-Fork verification (#466), static-graph byte cap (#463), event listener ownership (#467), SVG label corrections (#468), and the Halo-compatible reusable default (#462). A `v1` branch fast-forward without changing its independently pinned Action would otherwise omit the renamed-Fork fix from generation.

**Do not confuse F with R.** The pin update changes the reusable workflow, so its reviewed merge commit becomes the outer candidate **R**. Exercise the exact reusable workflow at R through a real `workflow_call` **without** `svg_contributed_layout`, inspect the generated canonical profile and non-Contributed classic caller, and only then consider a non-forced, lease-guarded `v1 → R` move. Require green full Verify, Chromium and WebKit for the pin PR and caller PRs. Record R, pre-move `v1`, and post-move audit outputs.
