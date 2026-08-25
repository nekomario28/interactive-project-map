# Repository Quality fork calibration — OffHandCombat — 2026-08-25

Status: **frozen local-delta calibration / not live-admitted / no composite score**

This calibration evaluates only the attributable fork-local delta of `nekomario28/OffHandCombat`.

## Authority

Current consumer authority:

```text
repository        nekomario28/OffHandCombat
default branch    master
default revision  317c2ec2e40325d8dd41f6dc5e730e95c97ae7e1
upstream          BunnyCinnamon/OffHandCombat
upstream revision e7df3ad2eec858407dd371cdfde574b35d0322c4
```

The fork default is six commits ahead and zero behind that upstream baseline.

The strongest release gate did **not** directly execute the later GitHub merge commit `317c2ec2...`. It executed PR head:

```text
validated revision  5633ab1e6d4482a015192e81b8b7c7789537dd63
workflow run        30934082130
evidence date       2026-08-04
```

The validated PR head and current default revision both point to the exact same Git tree:

```text
a5b60f6c9af607be5ecba3d678a0e4bb665cb7a7
```

That tree identity is the content-equivalence bridge. It permits the successful runtime evidence to describe the content now on default `master`, while keeping commit identity honest. It does **not** become a claim that Actions directly ran merge commit `317c2ec2...`.

Evidence freshness therefore stays `2026-08-04`. The later merge date and this calibration/publication date do not refresh the runtime evidence.

## Attribution boundary

This repository is a fork. Upstream code remains project context only.

Person-side portfolio Quality may use only evidence attributable to the local delta:

```text
BunnyCinnamon/OffHandCombat@e7df3ad2...
    ...
nekomario28/OffHandCombat@317c2ec2...
```

No upstream Quality is inherited as personal Quality.

## Local-delta evidence

### Understandability — supports

The local-ahead README and `TEST_MATRIX.md` document:

- Minecraft 1.21.1, NeoForge 21.1 and Java 21;
- dual-wield interaction and server-authoritative off-hand attack semantics;
- independent cooldown/HUD behavior;
- exact acceptance commands;
- compatibility limits;
- what is automated versus still manual/visual.

### Verification — supports

`Build and audit` run `30934082130` completed successfully on validated revision `5633ab1e...`. The release jobs covered:

- build/static audit;
- ten required NeoForge GameTests;
- dedicated-server bootstrap;
- physical-client bootstrap;
- integrated real-input and HUD behavior;
- modded client against vanilla server;
- vanilla client against modded NeoForge server;
- two-client multiplayer;
- lifecycle behavior;
- network stress;
- release-resource/NBT safety audit;
- distributable JAR audit.

The current default tree is byte-for-byte the same Git tree that was tested. Again, this is **tree-equivalent content evidence**, not direct exact-commit execution evidence for the merge commit.

### Reproducibility — supports

The local delta records the Java/Minecraft/NeoForge build contract, Gradle wrapper/bootstrap path, source-integrity manifest and executable acceptance commands.

This supports reconstructing the tested environment. It does not establish a byte-identical clean rebuild, so no such claim is made.

### Maintainability — unknown

The port contains deliberate boundaries, documentation, audits and tests, but this calibration does not perform a sufficiently broad review of change cost, coupling and long-term modification behavior.

Maintainability therefore stays `unknown`.

### Interoperability — supports

The local delta documents protocol and compatibility boundaries and verifies both optional-peer directions:

- modded NeoForge client -> Mojang vanilla server;
- Mojang vanilla client -> NeoForge server with OffHandCombat;
- two-client multiplayer and lifecycle paths.

Overlapping combat-authority mods such as Better Combat and Combatify are explicitly not claimed compatible merely because startup might succeed.

### Security / Safety — supports, but optional

The port deliberately replaces or rejects risky inherited/alternative patterns:

- no vanilla packet-format mutation;
- no live inventory/attribute swapping;
- no hurt-immunity reset;
- no early right-click theft;
- server-authoritative canonical off-hand state;
- ordered custom-payload sequences and replay protection;
- held-state/target validation;
- vanilla attack semantics;
- GameTest-only resources excluded from the release JAR.

This is meaningful project-specific evidence but remains optional for the generic game-mod target denominator.

### Stewardship — supports

The fork retains the upstream MIT notice, records the fork's 2026 contribution notice, keeps third-party provenance, distinguishes independently adapted concepts from copied code, documents asset licensing, and maintains explicit audit/test receipts.

## Current vector

For the six generic game-mod target dimensions:

```text
Understandability  supports
Verification       supports
Reproducibility    supports
Maintainability    unknown
Interoperability   supports
Stewardship        supports
```

Coverage:

```text
target dimensions       6
inspected dimensions    5
directional dimensions  5
```

Optional `Security / Safety` is also `supports` and does not inflate the six-dimension denominator.

## What this does not claim

- no Quality scalar or tier;
- no Confidence scalar;
- no ranking or prominence authority;
- no Structure/default-renderer change;
- no upstream Quality personal credit;
- no direct Actions execution at merge commit `317c2ec2...`;
- no byte-identical rebuild;
- no release/publication claim from this calibration;
- no freshness later than the 2026-08-04 verification event.

## Admission gate

This commit is calibration-only. The current live profile baseline remains:

```text
15 joined repositories
8 bounded assessment sources
7 Quality overlays available
8 unavailable
```

Only after this calibration passes the full Interactive Project Map Verify gate may a separate source-manifest admission be considered. A successful admission would add no graph membership and would target:

```text
9 bounded assessment sources
8 Quality overlays available
7 unavailable
```

The added OffHandCombat presentation freshness must remain `2026-08-04`; existing source dates must not be rewritten.
