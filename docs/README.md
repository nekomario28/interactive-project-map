# Documentation map

Use this page to distinguish current project authority from retained research and evidence.

## Start here

1. [`../README.md`](../README.md) — product, setup, architecture, and public usage.
2. [`current-roadmap.md`](current-roadmap.md) — canonical active-work and frozen product boundaries.
3. [`research-decision-ledger.md`](research-decision-ledger.md) — adopted, completed, rejected, not-planned, and dormant decisions plus reopen conditions.
4. [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — development loop and validation expectations.
5. [`../SECURITY.md`](../SECURITY.md) — permissions, secrets, and security reporting.

Live `main`, open pull requests/issues, CI, release refs, and runtime evidence override an older documentation snapshot when they differ. A dated research or maintenance document is evidence for the decision it records; its presence does not make that work active again.

For build-stage counts and execution order, `package.json` plus the executable stage-order tests are the live authority. [`build-postprocess-inventory.md`](build-postprocess-inventory.md) retains the cut-by-cut migration history, so historical counts inside that document describe the state at those cuts unless explicitly marked as a current snapshot.

## Product and release boundaries

- [`release-chain.md`](release-chain.md) — `main`, reusable `v1`, outer workflow, and immutable inner Action release authority.
- [`update-policy.md`](update-policy.md) — supported update path for reusable installs.
- [`github-only-architecture-decision.md`](github-only-architecture-decision.md) — production GitHub-only architecture.
- [`github-app-one-click-installer.md`](github-app-one-click-installer.md) — retained dormant installer design and its activation boundary.
- [`build-postprocess-inventory.md`](build-postprocess-inventory.md) — historical build/postprocess consolidation ledger; reconcile its dated snapshots against the live build before making current-state claims.

## Renderer and visual research

- [`threejs-galaxy-astronomy.md`](threejs-galaxy-astronomy.md) — scientific and semantic boundary for the native Three.js Galaxy renderer.
- [`threejs-galaxy-corotation.md`](threejs-galaxy-corotation.md) — adopted visual corotation approximation and its limits.
- [`design-system-consistency.md`](design-system-consistency.md) — design-system consistency notes.
- [`licensing-audit-2026-08-21.md`](licensing-audit-2026-08-21.md) — licensing and research-reference boundaries.

## Historical evidence

Files named with dates or terms such as `research`, `calibration`, `experiment`, `receipt`, `maintenance`, or a completed feature/fix record are retained for provenance and reproducibility. Read them when tracing why a current decision exists or when a recorded reopen condition is satisfied.

Do not treat those files as a backlog. Before reviving one, reconcile it against `current-roadmap.md`, `research-decision-ledger.md`, the current `main` head, and live PR/Issue state.
