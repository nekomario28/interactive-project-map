# FreeToken local-delta Quality calibration — 2026-08-25

Status: calibration-only; not a live Quality admission.

## Exact identities

- Fork: `nekomario28/FreeToken`
- Fork default branch: `main`
- Frozen fork default-head revision: `b2c0f162ae74c22898fb61b7369b4d7a3474bbfa`
- Meaningful local feature revision: `3ab9469657d83b02da6fd1fcd28f2b2f4b297355`
- Upstream: `FlashML-org/FreeToken`
- Observed upstream `main`: `2757bb5f91156fc8a44d88ec4b302a81f10c9e81`
- Merge base: `f0abe587a11cca53bb3c37a9596fad24973ace62`
- Evidence event date: `2026-08-24`
- Calibration observation date: `2026-08-25`

The current heads are diverged: the fork is 2 commits ahead and 7 behind upstream. The extra ahead commit is the merge of the one meaningful local feature revision, so Quality attribution is bounded to that local feature delta rather than to the inherited fork snapshot.

## Bounded local evidence

The local feature adds opt-in MoE decode cache telemetry. Its local documentation distinguishes logical H2D expert-row payload from measured PCIe bandwidth. Its implementation carries typed counters through the scheduler/message path into `/v1/stats` and `ft ctl stats`, and its focused tests cover counter derivation, missing snapshots, LRU-versus-hybrid fetch semantics, wire propagation, throttled reporting, and payload terminology.

PR #1 records exact base/head identities and a focused validation recipe. The receipt reports `98 passed` for the bounded CPU regression set, compileall and `git diff --check` success, plus a counter-path check on an RX 7800 XT-class ROCm device. That device receipt is not a full checkpoint serve and does not establish the supported NVIDIA/CUDA runtime path.

## Quality interpretation

Artifact route: `application`.

The application route has six emphasized target dimensions. This calibration interprets only three from local evidence:

- Understandability: supports
- Verification: supports, bounded to the project-owned PR validation receipt plus repository-native focused tests
- Reproducibility: supports, bounded to the exact feature validation recipe
- Maintainability: unknown
- Security/Safety: unknown
- Stewardship: unknown

The inherited upstream license, broader upstream tests, upstream build configuration, popularity, and current upstream development are not personal/local-delta Quality evidence.

## Claim boundaries

- No exact-head GitHub Actions run was observed for the local feature or merged fork default head.
- The PR validation receipt is project-owned evidence, not independent CI evidence.
- No full checkpoint serve on the supported NVIDIA/CUDA path is claimed.
- The ROCm device check is limited to the counter path.
- `h2d_payload_bytes` is not a measured bandwidth result.
- Byte-identical rebuild determinism is not verified.
- Release publication is not claimed.
- This calibration does not add FreeToken to the live Quality manifest.

A later live admission, if attempted, must separately prove that the frozen local-delta carrier remains the intended default-branch authority and must preserve all fork attribution and freshness invariants.
