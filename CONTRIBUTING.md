# Contributing

Issues and pull requests are welcome. Unless explicitly stated otherwise, contributions submitted to this repository are provided under the repository's MIT License.

## Start from current project truth

Before changing behavior, read:

1. `README.md` for the public product and setup contract.
2. `docs/current-roadmap.md` for active work and frozen boundaries.
3. `docs/research-decision-ledger.md` before reviving an older experiment or rejected lane.
4. `SECURITY.md` when permissions, tokens, GitHub App, Worker, or public setup behavior is affected.

Historical research documents are evidence, not an automatic backlog. Prefer the smallest change that fixes a concrete product, correctness, accessibility, maintenance, release, or real-device problem.

## Local requirements

- Node.js **24 is recommended** and matches CI. `package.json` currently supports Node.js `>=22.18.0`.
- npm is required.
- The current full `npm run verify` path expects a Unix-like shell. `scripts/validate-actions.sh` uses `bash`, `curl`, `tar`, and `sha256sum`, and downloads the pinned Linux x86_64 `actionlint` binary into `.tmp/`.
- Browser E2E uses Playwright. CI runs it in the pinned Playwright container; local browser installation is only needed when you run the E2E suites locally.

Install dependencies without lifecycle scripts:

```bash
npm ci --ignore-scripts
```

Build the production Pages output:

```bash
npm run build:pages
```

Run the Node test suite:

```bash
npm test
```

Run the full repository verification gate when your environment supports the Unix/actionlint requirements:

```bash
npm run verify
```

For rendered viewer changes, also run the affected Playwright lane:

```bash
npm run test:e2e
npm run test:e2e:webkit
```

## Change discipline

For grouping, generation, setup, or rendering changes, preserve these constraints:

1. Public API and generated-workflow behavior should remain backwards-compatible where practical.
2. Layouts must remain deterministic for the same graph input unless an explicitly reviewed runtime-motion contract says otherwise.
3. GitHub tokens and other credentials must stay outside public generated artifacts and browser-visible data.
4. SVG output must remain safe to embed as an image in GitHub README files.
5. The interactive viewer should remain usable with mouse, trackpad, keyboard where supported, and touch/pointer input.
6. Original, Fork, Archived, and opt-in Contributed semantics must not be silently collapsed into one ownership meaning.
7. Reuse shared view-model / spatial-core behavior before adding another renderer-specific semantic implementation.
8. Source/build success is not enough for visible UI changes; preserve rendered Chromium and mobile WebKit evidence where the affected surface requires it.

## Setup and release boundaries

The normal public setup path is the GitHub Pages generator plus the reusable workflow:

```yaml
uses: nekomario28/interactive-project-map/.github/workflows/generate-project-map.yml@v1
```

`v1` is the outer reviewed compatibility channel. The reusable workflow invokes an independently reviewed immutable inner Action SHA. Do not conflate or move those two release layers without the proof sequence in `docs/release-chain.md`.

The Cloudflare/GitHub App one-click installer is **DORMANT / NOT_PRODUCTION_EXPOSED**. Keep retained code fail-closed; do not advertise, expand, or reactivate it merely because credentials or implementation code exist.

## Pull requests and evidence

A PR is useful for review-heavy, release-sensitive, or larger changes, but small owner-maintained changes do not require artificial PR ceremony. Regardless of merge method, record the exact tested commit and run the smallest affected gate first. Run the broader/full gate only when the change risk requires it.
