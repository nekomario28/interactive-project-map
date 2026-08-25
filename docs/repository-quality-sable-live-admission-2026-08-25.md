# Sable live Quality admission — 2026-08-25

Status: **admitted and published / experimental non-default / fork-local-delta only / no scalar score**

This stage admits the reviewed Sable calibration into the bounded live Quality source manifest. It does not change graph membership, Structure/default rendering authority, stable `v1`, or any production score/rank/prominence channel.

## Authority boundary

- repository: `nekomario28/sable`
- frozen current default: `main@14397866926b06770da05c0c0304fae32d6e26b7`
- current upstream at calibration: `ryanhcode/sable@6966d2928340de7631abcecf8549904b877df0a8`
- validated code-bearing merge: `069d88fdceee399827e2eab0b3652c11a83c9e65`
- current default differs from that merge only by `AGENTS.md`; executable evidence is code-equivalence evidence, not direct execution of the current commit
- evidence snapshot date: `2026-08-21`
- open Sable PR #84 at calibration remains excluded from this evidence

## Admitted presentation

- attribution scope: `local-delta`
- overlay state: `available`
- target coverage: `5/6 interpreted`
- Understandability: supports
- Verification: supports
- Reproducibility: supports
- Maintainability: unknown
- Interoperability: supports
- Stewardship: supports
- Security/Safety: optional, supports
- composite Quality score: none
- production ranking: disabled

## Verification and publication receipt

The frozen current-profile fixture used for admission regression has 15 repositories. Within that frozen fixture, Sable changes bounded Quality coverage from 9 assessment sources / 8 available overlays / 7 unavailable overlays to 10 / 9 / 6. These are fixture cardinalities, not a promise that the independently regenerated profile graph will always contain 15 repositories.

- exact clean IPM admission: `24460c1d28c5f90634b7aa0eb2156127971c0927`
- exact-head carrier proof: Verify #1047 / run `32858251562` — full Verify, twelve-preset comparison, Chromium, and iPhone WebKit all passed
- promoted IPM main proof: Verify #1049 / run `32861619447` passed, and Pages #186 / run `32861619482` built and deployed successfully
- profile publisher consumer commit: `16a2d31c55d74ddc58bdc31221566f76128a9199`, pinning the exact IPM admission revision
- real-profile consumer proof: `Publish experimental Quality sidecars` #47 / run `32862249048` passed against the profile repository graph
- production publisher proof: #48 / run `32862399349` passed and produced bot publication commit `bf3960dc85eebf8e25c5e8a015e968322a984597`

At that publication snapshot, the independently regenerated profile graph contains 16 repositories, so the published presentation is a strict 16-repository join with 9 available and 7 unavailable overlays. Sable is published as `available` with `local-delta` attribution and frozen evidence date `2026-08-21`. The additional repository changes only the unavailable cardinality; it does not change the Sable admission or bounded-source count.

Published evidence freshness remains frozen and explicit: `2026-07-25`, `2026-08-04`, `2026-08-21`, `2026-08-24`, `2026-08-25`. All existing fork-attribution, visual-authority, no-score, and no-ranking invariants remain in force.
