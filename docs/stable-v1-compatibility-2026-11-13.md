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

## Release verification and rollback gates (not yet complete)

1. Validate this candidate workflow (its exact head SHA and immutable inner Action `2933861...`) with full Verify + Chromium + WebKit checks.
2. Run the actual candidate reusable workflow from a safe test caller at exact SHA, **without publishing to the profile or moving `v1`**. Validate Halo motion/orbits, 30 owned / 12 Contributed, zero verified duplicate pairs and eight Fork backlinks against a reproducible public profile fixture. Validate privacy and the owner summary.
3. Smoke-test Galaxy Classic with Contributed off as in `rotep` and Galaxy Systems without external contributed as in `RPG-478`; compare semantic output and dimensions with prior stable fixture. Test direct Action default independently.
4. Inspect package/license and code changes and record all GitHub Actions run URLs, immutable candidate SHA and proposed rollback SHA.
5. Only after these gates pass, advance **`refs/heads/v1` as a branch** from expected previous head (without force pushing) and run `scripts/audit-release-channel.mjs --require-current`. Verify the actual resolved inner Action, a generated public SVG and known callers. Roll back with the recorded previous SHA if needed.

Do not auto-promote this candidate in a PR merge. Branch protection rules for `main` and `v1` remain a separate maintenance task.
