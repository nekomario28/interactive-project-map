# gxkit source dependency inspection

This is a **source-code integrity gate**, not a check on the GitHub portfolio
graph or the visual correctness of any of the twelve IPM renderers.

`scripts/export-gxkit-deps.mjs` parses the checked-in JavaScript/TypeScript
source under `src/`, `scripts/`, and `packages/` with the TypeScript AST.
It records static relative imports, re-exports, string-literal dynamic imports,
string-literal `require()` calls, and `import("...")` types. A declared module
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
