# gxkit source dependency inspection

This is a **source-code integrity gate**, not a check on the GitHub portfolio
graph or the visual correctness of any of the twelve IPM renderers.

`scripts/export-gxkit-deps.mjs` parses the checked-in JavaScript/TypeScript
source under `src/`, `scripts/`, and `packages/` using Node.js TypeScript type stripping and the Espree JavaScript AST.
It records static relative imports, re-exports, declared type-only imports, string-literal dynamic imports,
and string-literal `require()` calls. Type-expression `import("...")` references are not currently extracted. A declared module
that cannot be resolved is intentionally left dangling. Existing non-source
assets and external packages are outside this specific model.

```sh
npm ci --ignore-scripts
node scripts/export-gxkit-deps.mjs --python .tmp/gxkit-source-deps.py
depsgx inspect .tmp/gxkit-source-deps.py --json --no-storyboard
```

In CI, the exact `gxkit` commit is pinned and its `depsgx` tool runs this
generated model. `depsgx` reports stable finding codes such as
`dangling-dependency` and `cycle`; any error fails the gate. The export
is deterministic and produces an inert Python declaration rather than
executing JavaScript or TypeScript source. The exported artifact is temporary
and is not shipped in the public Pages bundle.

**Boundaries:** no `roots` or layer policy is asserted because IPM has
multiple independent entry points, and renderer/runtime scripts are not a
single import-root hierarchy. Arbitrary computed dynamic imports, browser
globals, CSS load order, source/bundle parity, graph ownership semantics, and
visible interaction behavior are not proven by this inspection. Keep the
existing Node tests, generated Pages validators and Chromium/WebKit E2E tests
as separate gates. Do not feed `graph.json` to `depsgx`: membership and
contribution edges are not module imports.

## Browser-rendered visual inspection

The browser E2E suite emits separate **measured** evidence at
`.tmp/gxkit-visual/`, and the downstream `visual-gxkit` CI job consumes it
after Chromium and iPhone WebKit have passed.

- Two 2D styles (Galaxy Systems / Galaxy Hybrid): the Canvas adaptive label
  engine exposes read-only rectangles for labels it actually placed. These
  positions are *not* recomputed from graph coordinates by the checker.
- Native 3D Galaxy: Chromium measures real projected DOM label boxes in the
  actual label overlay after a direct repository search. Their geometry,
  typography and viewport size are saved as `layout.json`.
- `scripts/inspect-gxkit-visual.py` uses **gxkit's shared
  `gxcore.layout.check`** on those real boxes. It treats overlap and clipped
  text as errors, and rejects empty or malformed evidence. A self-test proves
  that intentional overlap/clipping and missing evidence are detected.
  `docgx` is *not* used to pretend an arbitrary web page is a static slide:
  its independent text wrapping model would not reflect DOM or Canvas pixels.
- Five actual WebGL canvas screenshots are collected over approximately
  three seconds with motion enabled and bounded camera-wheel interaction,
  then encoded into a video. The pinned
  `framegx` tool checks that encoded video for decodable frames, all-black
  output and frozen sequences. This checks visible renderer responsiveness
  rather than imposing a high visual-speed floor on very slow Galaxy orbits.
  The separate Three.js motion-state tests verify
  semantic orbit motion and Motion Off without confusing intentional freezing
  with a fault.

A visual audit is **not** a complete proof for every 2D preset or every frame
of every 3D style. The existing twelve-preset render comparison and all
Chromium/WebKit interactive suites remain required; a passing screenshot
inspection does not replace their tests. Animation analysis on the sampled
scene is not a real-device GPU/FPS acceptance gate.
