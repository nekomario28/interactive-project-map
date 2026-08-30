# Three.js runtime engine supply

Status: build-localized experimental renderer dependency.

The `/three/` lab uses **Three.js 0.185.1**. The browser must not require jsDelivr for the happy path. Pages builds acquire the exact upstream module from the immutable Three.js commit below, validate that the response looks like the expected JavaScript engine, and publish it as a same-origin static asset under `site/vendor/`.

- Upstream project: `mrdoob/three.js`
- Version: `0.185.1` / release tag `r185`
- Pinned upstream commit: `2431a09f46f34c560bc8e44b33be0e567723d5b9`
- Build input: `build/three.module.min.js` at that commit
- License: MIT
- Runtime asset: `vendor/three-0.185.1.module.min.js`

## Boundary

The repository does not check the third-party minified bundle into source control. `scripts/apply-threejs-local-engine.mjs` is a final Pages build step. It downloads the immutable upstream file, fails closed on HTTP/error-like responses or obviously invalid engine content, writes the local static asset, rewrites the generated Three.js runtime to import that local asset, and removes jsDelivr from the generated `/three/` Content Security Policy.

This changes **engine supply only**. It does not change graph admission, taxonomy, Contributed semantics, 2D presets, SVG generation, Three.js layout/camera behavior, render-density policy, or the stable reusable `v1` contract.

The runtime still fetches the user's generated static `project-map/graph.json` from `raw.githubusercontent.com`, so `connect-src https://raw.githubusercontent.com` remains intentional. No GitHub REST dependency is added.

## Reproducibility and updates

An engine update is explicit: change the version, pinned upstream commit, local filename and source URL together; update the corresponding tests/documentation; then run the normal Verify + Chromium + iPhone WebKit gates. Do not follow a floating tag or `latest` URL.

The build-time network fetch is intentionally separate from runtime availability. A completed Pages artifact contains the engine bytes locally, so a jsDelivr outage or block does not affect the already-built Three.js happy path.

If stronger supply-chain evidence is later required, add a reviewed content digest for the pinned upstream file. Do not silently substitute a different CDN or version.
