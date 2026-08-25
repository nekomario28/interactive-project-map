# Repository Quality game-mod calibration — 2026-08-25

Status: **frozen real-evidence calibration / AntiFullbright 1.1.0 + FTBPublicClaims default snapshot / no composite score / no personal-attribution claim**

This calibration contains two real `artifact:game-mod` cases:

- `nekomario28/antifullbright` at exact released revision `154bd1a1085412ca7a5abe797abf253a43dd29a8`;
- `nekomario28/FTBPublicClaims` at exact default-branch revision `8caaab65266a94e7bdedc6ad2f66030c7e394edf`.

The generic game-mod route emphasizes six target dimensions:

```text
Understandability
Verification
Reproducibility
Maintainability
Interoperability
Stewardship
```

`Security / Safety` remains optional. Direct project-specific safety evidence may be retained without increasing six-dimension target coverage.

## AntiFullbright — released executable-evidence case

AntiFullbright remains the stronger executable calibration. Its released 1.1.0 snapshot directly supports:

```text
Understandability  supports
Verification       supports
Reproducibility    supports
Maintainability    unknown
Interoperability   supports
Stewardship        supports
```

Coverage is `5/6` inspected and directional. Optional `Security / Safety` is also `supports`.

The evidence boundary includes the README, exact release-gate receipts, a packaged-server external runtime path, an isolated byte-identical offline rebuild, bounded cross-platform scanner evidence, and exact release identity. Maintainability remains unknown because this calibration does not promote modularity or test volume into a broad maintainability conclusion.

AntiFullbright is already admitted into the bounded live profile as a repository-snapshot Quality source.

## FTBPublicClaims — default snapshot only

The FTBPublicClaims case intentionally assesses **only** the current default `public-claim-context` revision:

```text
8caaab65266a94e7bdedc6ad2f66030c7e394edf
```

The repository also has an active NeoForge 1.21.1 port in open PR #1 and a stacked dependency-range fix in PR #2. Those carriers contain substantially stronger runtime and GameTest evidence, but they are **unmerged**. None of that execution evidence is imported into this default-snapshot Quality case.

That exclusion is an assessment invariant: repository-snapshot Quality must not silently borrow evidence from a future or unmerged carrier.

### Understandability — supports

The default README documents the public-claim ownership model, owner/manager/general-player permissions, client/server installation requirements, the `/publicclaim` command surface, anti-grief defaults and claim limits, Minecraft `1.20.1` / Forge `47.4.13`, exact FTB Chunks / Teams / Library versions, and the reason private FTB Teams behavior is isolated behind a compatibility bridge.

### Verification — unknown

`build.gradle` contains Forge GameTest run configuration, but the frozen default tree contains no GameTest source and no exact-head runtime receipt usable by this calibration.

The open NeoForge port records strong runtime verification, including GameTests, RCON/client assertions and persistence checks, but that evidence belongs to an unmerged carrier. Verification therefore remains `unknown` rather than being inferred from configured infrastructure or another branch.

### Reproducibility — supports

The default snapshot records a concrete build contract:

- Java 17;
- Minecraft `1.20.1`;
- Forge `47.4.13`;
- official `1.20.1` mappings;
- FTB Chunks `2001.3.6`;
- FTB Teams `2001.3.1`;
- FTB Library `2001.2.12`;
- Architectury `9.1.12`;
- Gradle wrapper and repository build scripts.

This supports reconstructing the declared development/build environment. It does **not** claim a byte-identical rebuild or successful current runtime execution.

### Maintainability — supports

The repository explicitly identifies the unstable private/internal FTB Teams 2001.3.1 dependency as a compatibility risk and isolates it in `FTBServerTeamBridge`. Service and packet layers consume that bridge rather than duplicating private FTB integration throughout the codebase.

This is a bounded maintainability finding about a known version-sensitive dependency boundary, not a claim that every subsystem has been deeply reviewed for long-term change cost.

### Interoperability — supports

The default snapshot defines exact FTB component versions, Forge/Minecraft ranges and BOTH-side mod dependencies. README also states that the client UI and custom networking require the mod on both client and server. The private FTB Teams dependency is explicitly bounded to the verified legacy version rather than presented as generic compatibility.

### Security / Safety — supports, but optional

The public-claim path contains explicit server-side constraints: feature-enable and manager authorization checks, per-project claim capacity, player-distance limits, adjacency requirements, refusal to overwrite already-claimed chunks, a maximum 64 changes per packet, malformed packet-count rejection, and default FTB team policy disabling explosions, mob griefing, PVP and fake-player block editing.

This is direct repository-native safety evidence for this project. It remains optional in the generic game-mod route.

### Stewardship — supports

The snapshot carries an MIT license, explicit project identity/version metadata, supported-runtime documentation, and repository-local engineering guidance. `AGENTS.md` also records the maintenance boundary that default history and active unmerged port carriers must not be conflated.

## FTBPublicClaims current vector

For the six generic game-mod target dimensions:

```text
Understandability  supports
Verification       unknown
Reproducibility    supports
Maintainability    supports
Interoperability   supports
Stewardship        supports
```

Coverage:

```text
target dimensions       6
inspected dimensions    5
directional dimensions  5
```

Optional `Security / Safety` is observed as `supports` and does not inflate target coverage.

## Shared claim boundaries

Neither case produces a Quality scalar or tier. Neither produces a Confidence scalar. Stars/Forks remain Impact signals, release count remains maturity/context, and recent commit activity remains Activity/lifecycle context.

Repository ownership does not establish solo authorship. Collaboration remains `unknown`, and project-side Quality does not by itself authorize direct personal prominence.

For FTBPublicClaims specifically:

- open PR #1 runtime evidence is excluded;
- open PR #2 dependency-range evidence is excluded;
- configured GameTest infrastructure is not equivalent to observed verification;
- default snapshot Quality remains tied to `8caaab65266a94e7bdedc6ad2f66030c7e394edf` until a new bounded evidence snapshot is deliberately reviewed.

## Calibration proof and current admission gate

The two-case calibration was already exercised by IPM PR #225 exact head `7d2765ccf3eba584aae1f74cfda6cf278e8c56aa`. Verify #936 (`32818217615`) passed full Verify, twelve-preset comparison, Chromium, iPhone WebKit, and browser evidence upload.

That old probe was based on a pre-BuyClaimChunks IPM main, so its tested branch is not a current release candidate. The calibration fixture and tests may be re-composed onto current main, but current-main exact-head CI must pass before landing.

Current live state before any FTBPublicClaims admission is:

```text
repository membership       15
bounded assessment sources   6
Quality available            5
Quality unavailable         10
```

If this default-snapshot case is later explicitly selected for live admission, the expected state is:

```text
repository membership       15 unchanged
bounded assessment sources   7
Quality available            6
Quality unavailable          9
```

FTBPublicClaims evidence snapshot date is `2026-08-25`. Adding it must preserve the existing mixed presentation freshness introduced by BuyClaimChunks: `snapshotDates=[2026-07-25, 2026-08-25]`, oldest `2026-07-25`, newest `2026-08-25`, `automaticRefresh=false`.

Admission remains a separate authority from calibration. It requires a current-main producer proof, an exact-revision real-profile consumer proof, and inspection of the published sidecar artifact before production publication can be claimed.
