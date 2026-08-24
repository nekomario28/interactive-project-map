# Repository assessment real L1 receipt — 2026-08-25

Status: **bounded calibration evidence / no production score or tier**

This receipt follows the real L0 pass and records only L1 facts that resolve a material assessment boundary. It deliberately does not deep-scan every repository and does not infer solo authorship or lifecycle from absence of contrary evidence.

## Scope

Bounded sample inherited from the L0 receipt:

- `nekomario28/interactive-project-map`
- `nekomario28/ProjExD_Group10`
- `nekomario28/FTBPublicClaims`
- `nekomario28/antifullbright`
- `nekomario28/gz-sim`
- `nekomario28/turing-smart-screen-python-owl`
- `nekomario28/FreeToken`
- `c0c25034/ProjExD_4`

The first L1 pass targeted only three high-value questions:

1. can collaboration be resolved without guessing solo/team?
2. can fork parent/upstream context and local default-branch delta be separated?
3. can the one L0-unknown Contributed category/artifact be resolved from direct repository evidence?

## Collaboration resolution is asymmetric

A bounded public commit-history sample for `ProjExD_Group10` contains merge commits from multiple distinct contributor branches, including:

```text
#1  c0a2517694/main
#2  c0a2514087/main
#3  c0a2504494/main
#4  c0a2525296/main
#5  c0c25034/main
```

Representative merge commits include:

```text
2c7507e152ec479b1f032fd8fdc4749fb9ef4be9
90ee797491b71ac5069f863e6f1b0526bf68ee14
b639d840b2108031ba150ac11f81f036583fff77
a3db0764d4632bb9143a1cd4a2734310796ffbe1
d0cb70da3675d5316efa928cafe34a9822bde827
```

This is positive evidence that the project is collaborative, so its assessment relation can advance from:

```text
owned × unknown × original
```

to:

```text
owned × team × original
```

The inverse is not allowed. If a bounded history shows only one visible author, that is insufficient to establish `solo`; collaboration remains `unknown` unless stronger evidence establishes solo authorship.

Therefore `interactive-project-map`, `FTBPublicClaims`, and `antifullbright` remain collaboration-unknown in this receipt rather than being promoted to solo merely because no team evidence was collected here.

## Fork parent and upstream context

Repository metadata directly resolves the selected fork parents:

| Local fork | Parent/source | Local stars/forks | Upstream stars/forks snapshot |
| --- | --- | ---: | ---: |
| `nekomario28/gz-sim` | `gazebosim/gz-sim` | 0 / 0 | 1461 / 458 |
| `nekomario28/turing-smart-screen-python-owl` | `mathoudebine/turing-smart-screen-python` | 0 / 0 | 2227 / 404 |
| `nekomario28/FreeToken` | `FlashML-org/FreeToken` | 0 / 0 | 4671 / 415 |

These upstream counters are project-side context only. They do not become the local fork owner's Impact or Quality.

## Default-branch local delta

Cross-fork compare evidence further separates the three forks.

### `gz-sim`

```text
upstream: gazebosim/gz-sim main
local:    nekomario28/gz-sim main
status:   behind
ahead:    0
behind:   2
changed files from local-ahead commits: 0
```

Interpretation:

- no local default-branch commit delta is currently observed;
- the upstream project's Quality/Impact/Scale remains context-only;
- this does **not** prove that the person has never contributed elsewhere, on another branch, or upstream;
- the local fork itself cannot claim a default-branch local-delta contribution from this evidence.

### `turing-smart-screen-python-owl`

```text
upstream: mathoudebine/turing-smart-screen-python main
local:    nekomario28/turing-smart-screen-python-owl main
status:   diverged
ahead:    3
behind:   24
```

Observed local-delta files include substantial changes in `library/lcd/lcd_comm_rev_c.py`, configuration/dependency files, README, themes, and workflow compatibility edits.

Interpretation:

- a local default-branch delta is directly observed;
- the delta is real contribution evidence, but line count/file count does not itself determine merit;
- upstream reputation remains separate from the local delta.

### `FreeToken`

```text
upstream: FlashML-org/FreeToken main
local:    nekomario28/FreeToken main
status:   diverged
ahead:    2
behind:   6
```

The compare reports local changes across scheduler/server/tokenizer/MoE paths plus tests, including a new `tests/server/test_moe_stats.py`.

Interpretation:

- a local default-branch delta is directly observed;
- the presence of implementation and test changes is stronger evidence than namespace ownership or raw commit count alone;
- contribution magnitude/responsibility still requires semantic review before any Personal Contribution score.

## Contributed semantic-context resolution

`c0c25034/ProjExD_4` was the only L0 repository whose Standard Taxonomy category and artifact remained unknown.

Direct repository evidence now shows:

```text
language: Python
root:
  fig/
  musou_kokaton.py
```

`musou_kokaton.py` directly imports `pygame`, defines a game window, sprites, player movement, projectiles/effects, and other game runtime behavior.

For assessment routing, that is sufficient direct evidence for:

```text
category: game-development
artifact: application
```

This resolves assessment context only. It does not silently rewrite the canonical profile graph or claim that a legacy `uncategorized` classifier was correct.

The repository still remains:

```text
ownership: contributed
collaboration: unknown
lineage: original
```

and its already-observed one commit / one merged PR remains activity evidence rather than a contribution-magnitude score.

## L1 state after this pass

| Repository | Collaboration | Lineage context | Assessment-context change |
| --- | --- | --- | --- |
| `interactive-project-map` | unknown | original | none |
| `ProjExD_Group10` | **team observed** | original | collaboration resolved |
| `FTBPublicClaims` | unknown | original | none |
| `antifullbright` | unknown | original | none |
| `gz-sim` | unknown | fork; parent observed | no local default-branch delta observed |
| `turing-smart-screen-python-owl` | unknown | fork; parent observed | local default-branch delta observed |
| `FreeToken` | unknown | fork; parent observed | local default-branch delta observed |
| `c0c25034/ProjExD_4` | unknown | original / contributed | category+artifact resolved |

## Reusable decision rules confirmed by real evidence

1. **Positive team evidence may resolve `unknown -> team`; lack of team evidence may not resolve `unknown -> solo`.**
2. **Fork parent/source metadata is upstream context, never authored local merit.**
3. **Cross-fork compare should distinguish local default-branch delta from upstream state before Personal Contribution is assessed.**
4. **`ahead = 0` means no observed local default-branch commit delta in that comparison, not “the person never contributed”.**
5. **A non-zero local delta is evidence of work, not a scalar merit score; changed LOC/files/commits remain features, not the verdict.**
6. **Missing semantic context may be resolved from direct repository contents without treating a legacy non-standard classifier ID as canonical taxonomy.**

## Next calibration gate

The next useful work is Quality/Scale/Personal-Contribution evidence extraction for a smaller subset where L1 changed the assessment materially:

```text
ProjExD_Group10
  team attribution boundary

turing-smart-screen-python-owl
  fork with observed local delta

FreeToken
  fork with observed implementation + test delta

c0c25034/ProjExD_4
  contributed project with direct activity but sparse repository stewardship evidence

interactive-project-map
  high-evidence owned-original reference case; collaboration remains unknown unless separately established
```

Do not freeze Quality weights, Personal Contribution weights, tiers, or SVG geometry until those evidence vectors are compared.
