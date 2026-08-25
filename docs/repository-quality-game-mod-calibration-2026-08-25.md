# Repository Quality game-mod calibration — 2026-08-25

Status: **frozen real-evidence calibration / AntiFullbright 1.1.0 / no composite score / no personal-attribution claim**

This calibration adds a real `artifact:game-mod` example after the application, library/fork, and external dataset cases. The subject is `nekomario28/antifullbright` at exact revision `154bd1a1085412ca7a5abe797abf253a43dd29a8`, the released 1.1.0 source state.

## Why this case is useful

The generic game-mod route emphasizes six Quality dimensions:

```text
Understandability
Verification
Reproducibility
Maintainability
Interoperability
Stewardship
```

`Security / Safety` remains optional in the generic game-mod route. AntiFullbright has unusually strong direct security/safety documentation, so that evidence is retained as an optional observed finding rather than silently changing the generic artifact contract.

## Evidence boundary

### Understandability — supports

The exact-revision README documents:

- Minecraft `1.21.1` and NeoForge `21.1.235`;
- Java 21 build and installation paths;
- server-side dark-mining behavior;
- client scanner behavior;
- server/client configuration;
- resource-pack monitoring;
- data-pack extension points;
- administrator commands;
- persistence and JSONL evidence logs;
- privacy, enforcement scope, and security limitations.

This is direct repository-native content evidence.

### Verification — supports

The stable release-gate receipt records one exact-head workflow set covering:

- Build;
- GameTest;
- Packaged Server;
- External Runtime;
- Cross-platform Scanner on Ubuntu, Windows, and macOS.

All required workflows succeeded. All 24 required GameTests passed.

The External Runtime path also exercised a packaged NeoForge server with a real Minecraft protocol client. Two real stone breaks went through the normal client digging packet and NeoForge `BlockEvent.BreakEvent`, reached the production AntiFullbright handler, produced JSONL evidence, advanced warning state, and terminated the connection with `action=kick`.

This is stronger than CI-mechanism presence: the evidence records the required exact-head outcomes.

### Reproducibility — supports

`build.gradle` and `gradle.properties` record the Java, Minecraft, NeoForge, version, test, and source-set build contract. The release receipt additionally records an isolated offline clean rebuild whose JAR was byte-for-byte identical to the GitHub-built stable candidate:

```text
antifullbright-1.1.0.jar
SHA-256 4cc843c0c39348203e3ffe30ab4dbd6c33a9eb0f6d2907913d005b89a80588fe
```

The calibration therefore treats Reproducibility as directly supported rather than inferring it from a lockfile or CI file alone.

### Maintainability — unknown

The repository has modular tests, production/GameTest separation, bounded configuration and substantial documentation, but this calibration does not perform a sufficiently deep maintainability review of code structure, change cost, architectural coupling, or long-term modification behavior.

Maintainability therefore stays `unknown` rather than being promoted from proxy signals.

### Interoperability — supports

The repository documents exact game/loader compatibility, server-only versus optional client installation, interactions with FakePlayers and tools from other mods, and data-pack tags intended for extension.

The scanner and recursive filesystem-watcher also passed their bounded behavior matrix on Ubuntu, Windows, and macOS. That matrix is **not** treated as proof of complete graphical Minecraft launcher/runtime behavior on every platform; the repository explicitly limits that claim.

### Security / Safety — supports, but optional

AntiFullbright's README explicitly documents:

- high-confidence BLOCK versus broad WARNING behavior;
- configurable fail-open/fail-closed handling;
- scanner privacy boundaries;
- non-attestation;
- false-positive boundaries;
- the fact that the scanner is removable/modifiable and is not tamper-proof;
- the fact that it is not server-enforced anti-cheat.

These are meaningful direct security/safety findings for this particular project. They remain optional for generic `game-mod` target coverage.

### Stewardship — supports

Build metadata records MIT licensing and stable version `1.1.0`. The release-gate receipt freezes exact JAR identity and states that stable publication must use the reviewed candidate artifact without rebuilding it after approval.

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

The optional `Security / Safety` dimension is also observed as `supports`, but it does not inflate target coverage.

## What this does not claim

- no Quality scalar or tier is produced;
- no Confidence scalar is produced;
- Stars/Forks do not become Quality;
- release count does not become Quality;
- recent activity does not become Quality;
- complete graphical runtime on Windows/macOS is not claimed by the cross-platform scanner matrix;
- repository ownership does not prove solo authorship;
- collaboration therefore remains `unknown`;
- project-side Quality does not by itself grant direct personal prominence.

## Next gate

After this calibration passes the repository's full Verify workflow, it can be considered as a bounded fifth Quality evidence source for the current profile. If admitted, the expected presentation would move from three to four available overlays while retaining the fork-local-delta boundary. Admission should reuse this frozen exact-revision fixture rather than refreshing claims opportunistically during profile publication.
