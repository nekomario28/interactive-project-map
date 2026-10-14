import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { collectSourceDependencies, pythonArtifact } from "../scripts/export-gxkit-deps.mjs";

function fixture(files, testBody) {
  const root = mkdtempSync(join(tmpdir(), "ipm-gxkit-"));
  try {
    for (const [name, body] of Object.entries(files)) {
      const path = join(root, name);
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, body);
    }
    return testBody(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("source dependencies include imports, re-exports, dynamic import, require and type imports", () => fixture({
  "src/index.ts": 'import type { X } from "./data"; export { a } from "./bar.js"; import("./future"); require("./legacy.cjs"); import type T from "./data";',
  "src/data.ts": "export type X = string;",
  "src/bar.ts": "export const a = 1;",
  "src/future.ts": "export const future = true;",
  "src/legacy.cjs": "module.exports = 1;",
  "src/notes.css": "body {}",
}, (root) => {
  const result = collectSourceDependencies(root);
  assert.deepEqual(result.depends, [
    ["src/index.ts", "src/bar.ts"],
    ["src/index.ts", "src/data.ts"],
    ["src/index.ts", "src/future.ts"],
    ["src/index.ts", "src/legacy.cjs"],
  ]);
  assert.deepEqual(result.missing, []);
  assert.equal(result.modules.length, 5);
}));

test("missing local modules are left dangling for depsgx, not silently dropped", () => fixture({
  "scripts/a.mjs": 'import "./missing.mjs"; import "node:fs"; import "./style.css";',
  "scripts/style.css": "a {}",
}, (root) => {
  const result = collectSourceDependencies(root);
  assert.deepEqual(result.depends, [["scripts/a.mjs", "unresolved:scripts/missing.mjs"]]);
  assert.deepEqual(result.missing, [{ importer: "scripts/a.mjs", specifier: "./missing.mjs", target: "scripts/missing.mjs" }]);
}));

test("module cycles and deterministic output are preserved as edges", () => fixture({
  "packages/x/src/a.js": 'export { b } from "./b.js";',
  "packages/x/src/b.js": 'import "./a.js";',
  "packages/x/src/ignored.txt": "not code",
}, (root) => {
  const result = collectSourceDependencies(root);
  assert.deepEqual(result.depends, [
    ["packages/x/src/a.js", "packages/x/src/b.js"],
    ["packages/x/src/b.js", "packages/x/src/a.js"],
  ]);
  assert.deepEqual(result, collectSourceDependencies(root));
  const python = pythonArtifact(result);
  assert.match(python, /from depsgx import ModuleGraph/);
  assert.match(python, /depends=\[tuple\(pair\) for pair in /);
  assert.match(python, /packages\/x\/src\/a\.js/);
  assert.equal(python.includes("undefined"), false);
}));

test("generated Python data escapes hostile filenames rather than injecting source", () => {
  const payload = pythonArtifact({ modules: ['module"; __import__("os")'], depends: [], missing: [] });
  assert.match(payload, /module\\"; __import__/);
});

test("the inspected repo itself contains source modules", () => {
  const root = new URL("..", import.meta.url).pathname;
  // This smoke test ensures a rename cannot turn inspection into a no-op.
  const model = collectSourceDependencies(root);
  assert.ok(model.modules.includes("scripts/export-gxkit-deps.mjs"));
});
