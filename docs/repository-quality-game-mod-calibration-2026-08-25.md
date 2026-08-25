# Repository Quality game-mod calibration — 2026-08-25

Status: **frozen real-evidence calibration / two exact carriers / no composite score / no personal-attribution claim**

This calibration now contains two real `artifact:game-mod` cases:

1. `nekomario28/antifullbright` at released revision `154bd1a1085412ca7a5abe797abf253a43dd29a8` (`1.1.0`).
2. `nekomario28/FTBPublicClaims` at active NeoForge port revision `12c57797637d1903ad7f76174e6d676364a3c339` (PR #1, `0.2.0-SNAPSHOT`, open draft).

The second case deliberately freezes the active implementation carrier rather than the older default branch. The repository's engineering entrypoint says live port PRs are authoritative for current implementation state until the port is integrated, and the exact carrier has direct GitHub Actions outcomes.

## Generic game-mod route

The generic game-mod route emphasizes six Quality dimensions:

```text
Understandability
Verification
Reproducibility
Maintainability
Interoperability
Stewardship
```

`Security / Safety` remains optional. Project-specific evidence can still be shown there without inflating the six-dimension target coverage.

## Case A — AntiFullbright 1.1.0

AntiFullbright remains the released reference case.

### Evidence summary

- **Understandability — supports:** README documents Minecraft/NeoForge target, installation, server behavior, client scanner, configuration, persistence, evidence logs, privacy and security limitations.
- **Verification — supports:** exact release-gate evidence covers Build, GameTest, Packaged Server, External Runtime and cross-platform scanner checks; all 24 required GameTests passed, and a real protocol client exercised the production block-break enforcement path through connection termination.
- **Reproducibility — supports:** build metadata freezes Java/Minecraft/NeoForge/version/source-set identity, and an isolated offline clean rebuild produced a byte-for-byte identical JAR.
- **Maintainability — unknown:** modularity and tests exist, but the calibration intentionally does not infer maintainability from proxies without a deeper code-change review.
- **Interoperability — supports:** exact loader/game compatibility, server/client modes, FakePlayer/tool behavior and data-pack extension points are documented; cross-platform scanner evidence is bounded to scanner/watcher behavior.
- **Security / Safety — supports, optional:** fail-open/fail-closed behavior, privacy, non-attestation and anti-cheat limitations are explicit.
- **Stewardship — supports:** MIT/stable-version metadata and exact release artifact identity are frozen.

Target coverage:

```text
target dimensions       6
inspected dimensions    5
directional dimensions  5
```

The optional `Security / Safety` result does not increase target coverage.

## Case B — FTB Public Claims active NeoForge carrier

The current product implementation is not the old Forge 1.20.1 default-branch snapshot. The frozen assessment carrier is PR #1 head:

```text
repository  nekomario28/FTBPublicClaims
head        neoforge-1.21.1-port
revision    12c57797637d1903ad7f76174e6d676364a3c339
state       open draft
version     0.2.0-SNAPSHOT
```

Draft/snapshot state is retained as lifecycle and maturity context. It does not erase directly observed project Quality, and it is not represented as a stable release.

### Understandability — supports

The exact-carrier README documents:

- the single `Global Public Claims` realm and ownership model;
- public versus personal/party claim and capacity separation;
- commands and configuration;
- client/server installation requirements;
- BuyClaimChunks Continued coexistence;
- exact Minecraft, NeoForge and FTB compatibility;
- automated validation scope;
- the migration boundary for unreleased multi-project development saves.

### Verification — supports

Two GitHub Actions runs are tied to the exact carrier revision.

`Build` run #195 passed:

- clean Java 21 build and distributable-JAR audit;
- FTB Chunks client-map ABI inspection;
- real NeoForge client behavior under Xvfb with real mouse input;
- combined NeoForge GameTests;
- dedicated-server persistence across normal stop and a second JVM.

`Validate compatible FTB stack` run #20 also passed:

- compile/test/JAR audit;
- runtime dependency metadata validation;
- FTB Chunks `2101.1.21` client-map ABI inspection;
- combined NeoForge GameTests with BuyClaimChunks Continued present.

These are outcome receipts, not merely evidence that CI files exist.

### Reproducibility — supports

The exact revision records Java 21, Minecraft `1.21.1`, NeoForge `21.1.242`, Architectury `13.0.8`, FTB Chunks `2101.1.21` with minimum `2101.1.20`, FTB Teams `2101.1.10`, FTB Library `2101.1.34`, and the Gradle build contract. The exact-head clean build and distributable-JAR audit passed.

This supports reproducible build identity and dependency reconstruction; it does **not** claim byte-for-byte deterministic rebuilds because that stronger experiment was not performed for this carrier.

### Maintainability — supports, bounded

Version-sensitive FTB Teams/Chunks behavior is isolated in `FTBServerTeamBridge`, whose source explicitly labels the FTB version boundary. The README separately identifies version-dependent bridge/client integration and requires ABI inspection.

The finding is intentionally bounded to this architectural isolation. It does not claim that every component has low change cost or prove long-term maintainability of the whole codebase.

### Interoperability — supports

The README defines coexistence with BuyClaimChunks Continued and keeps public ownership/capacity independent from personal/party ownership/capacity. The compatible-stack run verifies a newer supported FTB Chunks point release, runtime dependency metadata, client-map ABI, and combined NeoForge GameTests.

### Security / Safety — supports, optional

The active carrier documents and enforces safety boundaries relevant to a shared claim system:

- public claims do not overwrite existing personal/party claims;
- public capacity remains isolated from personal capacity;
- fake-player editing is disabled by default;
- explosion and mob-grief terrain damage are disabled by default;
- network claim changes are bounded;
- legacy multi-team development saves are not auto-merged where ownership could conflict.

This remains optional in the generic game-mod route.

### Stewardship — supports

The exact carrier records MIT licensing, explicit `0.2.0-SNAPSHOT` identity, compatibility ranges, migration boundaries and a concrete validation contract. The draft state is preserved rather than being disguised as a release.

Target coverage:

```text
target dimensions       6
inspected dimensions    6
directional dimensions  6
```

The optional `Security / Safety` finding is visible but does not inflate the denominator.

## Shared claim boundaries

Neither case produces a scalar Quality score or Confidence score. In both cases:

- Stars/Forks remain Impact signals;
- release count remains Maturity/context;
- recent activity remains Activity/lifecycle context;
- repository ownership does not prove solo authorship;
- collaboration remains `unknown` unless separately evidenced;
- project-side Quality does not by itself grant direct personal prominence.

For FTB Public Claims specifically, an open draft PR is not a Quality penalty and is not evidence of stable release readiness. Those are distinct lifecycle/maturity questions.

## Next gate

AntiFullbright is already admitted to the live bounded profile as the fifth assessment source and fourth available Quality overlay.

FTB Public Claims must first pass the full IPM Verify workflow as this frozen exact-carrier calibration. Only after that should it be considered for live admission as a sixth bounded assessment source. If admitted, the expected current-profile presentation moves from:

```text
5 assessment sources / 4 available / 11 unavailable
```

to:

```text
6 assessment sources / 5 available / 10 unavailable
```

Admission must reuse the frozen `12c57797637d1903ad7f76174e6d676364a3c339` carrier and its exact evidence receipts rather than silently following future PR movement.
