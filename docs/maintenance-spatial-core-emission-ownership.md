# Spatial Core runtime emission ownership

Status: stacked qualification, 2026-09-04.

This cut moves only `spatial-core-runtime.js` byte generation from `postprocess-public-pages.mjs` into the canonical public Pages builder boundary.

- `scripts/public-spatial-core-runtime.mjs` owns the browser-runtime source derived from `packages/spatial-core` primitives.
- `scripts/build-public-pages.mjs` emits `spatial-core-runtime.js` before postprocessing.
- `scripts/postprocess-public-pages.mjs` continues to attach the existing Spatial Core script tag where required, but no longer imports force primitives or writes the runtime file.
- `tests/spatial-core-browser-runtime.test.mjs` proves package-primitive parity and that postprocessing leaves the builder-emitted runtime byte-identical.

No force settings, edge normalization, force-step semantics, script order, active post-build stage count, release authority, or `v1` state changes in this ownership-only cut.
