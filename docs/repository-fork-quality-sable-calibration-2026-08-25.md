# Sable fork-local Quality calibration — 2026-08-25

Status: **frozen current-default local-delta calibration / not live-admitted / no scalar score**

## Authority

- fork: `nekomario28/sable`
- current default: `main@14397866926b06770da05c0c0304fae32d6e26b7`
- current upstream: `ryanhcode/sable@6966d2928340de7631abcecf8549904b877df0a8`
- merge base: `8ec2afab2253a2e2a6854cbef1ea815551cb4c88`
- current comparison: 97 commits ahead / 11 behind upstream
- executable evidence date: `2026-08-21`

The last code-bearing default-main state is merge `069d88fdceee399827e2eab0b3652c11a83c9e65`, whose tree `d96d98dcf1df8d870d6f33483c92b2c6daa94964` is the exact tree tested on PR #85 head `d15a5ddccae399ae1e46cceea70c3e80e3111406`. The current default adds only `AGENTS.md` after that merge. Therefore runtime evidence is reused as **code-equivalence evidence**, not as a claim that Actions executed current commit `143978669...` directly.

Open PR #84 is explicitly excluded. Its detached-physics materialization stage is unmerged and is not part of this current-default Quality case.

## Local-delta evidence

### Understandability — supports

`AGENTS.md` and `docs/transactional-sublevel-reconstruction.md` define the reconstruction authority, pre-mutation validation, provisional ownership, commit/rollback boundary, failure injection, GameTest expectations, JNI/native packaging discipline, and provenance rules. The documentation is explicit that historical or unmerged reconstruction stages must not silently become current claims.

### Verification — supports

PR #85 head `d15a5dd...` passed two complementary gates:

- build run `32501210866`: Gradle build + NeoForge GameTests;
- Verify Rust Native PR run `32501210848`: rebuild all Rapier natives, then run NeoForge GameTests against the rebuilt native bundle.

The tested head and merged code state share tree `d96d98dc...`. Current default differs from that merged code state only by documentation.

### Reproducibility — supports

The current tree retains the documented Docker/Gradle Rust-native build path and workflows that rebuild the native bundle before runtime GameTests. This supports reconstructing the validated build/runtime path. It does **not** establish byte-identical native rebuild determinism.

### Maintainability — unknown

The local delta has substantial modularization, narrow provider interfaces, self-tests and staged transaction boundaries, but this calibration does not turn those proxies into a broad maintainability judgment over a large 97-ahead intrusive fork. Maintainability remains `unknown`.

### Interoperability — supports

The local reconstruction work preserves explicit Fabric and NeoForge platform adapters and adds bounded Java/Rapier JNI interfaces. The README retains Sable's compatibility warning rather than claiming universal compatibility for an intrusive mixin-heavy mod.

### Security / Safety — supports, optional

The local program uses fail-closed ownership and rollback semantics. PR #85 specifically prevents a failed native acquisition from releasing Java/runtime-ID ownership when native cleanup cannot prove state removal. The reconstruction contract also requires exact inverse cleanup and rejects invalid/non-finite preconditions before mutation. This is meaningful safety evidence, but `Security / Safety` remains optional in the generic game-mod route.

### Stewardship — supports

The current `AGENTS.md` explicitly preserves upstream ownership/licensing, asks for narrow reviewable deviations, separates Sable-owned reconstruction semantics from consumers, and requires real GameTest/native evidence for runtime claims. README retains the upstream Polyform Shield licensing statement. These are local stewardship/provenance signals; upstream popularity is not Quality evidence.

## Current vector

```text
Understandability  supports
Verification       supports
Reproducibility    supports
Maintainability    unknown
Interoperability   supports
Stewardship        supports
Security / Safety  supports (optional)
```

Target coverage remains `5/6 interpreted`. No Quality scalar, confidence scalar, ranking, prominence, node-size/placement authority, or Structure-default change is produced.

## Admission boundary

This commit is calibration-only. It does not change `data/repository-quality-live-profile-enrichment-sources.v1.json` and does not change the current production `15 joined / 8 available / 7 unavailable` profile projection.

If the full IPM Verify gate passes on the exact calibration head, live admission may be considered as a separate stage. Any admission must keep:

- `qualityAttributionScope = local-delta`;
- frozen evidence date `2026-08-21`;
- open PR #84 excluded;
- Maintainability `unknown`;
- Security/Safety optional;
- no score/rank/prominence/Structure authority.
