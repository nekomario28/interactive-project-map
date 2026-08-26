import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateCssAgainstGrammar, validateDesignSystem } from "../scripts/validate-design-system.mjs";

const grammar = JSON.parse(await readFile(new URL("../design/ui-reference-grammar.json", import.meta.url), "utf8"));
const sharedCss = await readFile(new URL("../scripts/public-viewer.css", import.meta.url), "utf8");
const threeCss = await readFile(new URL("../scripts/public-threejs-viewer.css", import.meta.url), "utf8");
const sources = { shared_2d: sharedCss, threejs_cosmic: threeCss };

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("current public UI passes the measured detection-only grammar", async () => {
  const report = await validateDesignSystem(new URL("..", import.meta.url).pathname);
  assert.equal(report.surfaces.shared_2d.roles, 14);
  assert.equal(report.surfaces.shared_2d.consumed_roles, 14);
  assert.equal(report.surfaces.shared_2d.unconsumed_roles, 0);
  assert.equal(report.surfaces.threejs_cosmic.roles, 8);
  assert.equal(report.surfaces.threejs_cosmic.consumed_roles, 1);
  assert.equal(report.surfaces.threejs_cosmic.unconsumed_roles, 7);
  assert.ok(report.surfaces.shared_2d.raw_color_literals > 0);
  assert.ok(report.surfaces.threejs_cosmic.raw_color_literals > 0);
  assert.match(report.fingerprint, /^[0-9a-f]{64}$/);
});

test("unknown grammar keys fail closed", () => {
  const changed = clone(grammar);
  changed.unreviewed = true;
  assert.throws(() => validateCssAgainstGrammar(changed, sources), /grammar keys must be exactly/);
});

test("measured shared semantic color drift is detected before screenshots", () => {
  const changedCss = sharedCss.replace("--accent: #64d2ff;", "--accent: #63d2ff;");
  assert.throws(
    () => validateCssAgainstGrammar(grammar, { ...sources, shared_2d: changedCss }),
    /--accent expected #64d2ff but got #63d2ff/
  );
});

test("a previously unconsumed Three.js role cannot silently become renderer authority", () => {
  const changedCss = `${threeCss}\n.design-probe { color: var(--three-text); }\n`;
  assert.throws(
    () => validateCssAgainstGrammar(grammar, { ...sources, threejs_cosmic: changedCss }),
    /semantic role consumption changed/
  );
});

test("reduced-motion remains a hard cross-surface accessibility boundary", () => {
  const changedCss = threeCss.replace("@media (prefers-reduced-motion: reduce)", "@media (min-width: 1px)");
  assert.throws(
    () => validateCssAgainstGrammar(grammar, { ...sources, threejs_cosmic: changedCss }),
    /missing prefers-reduced-motion boundary/
  );
});

test("raw artistic color literals are censused rather than globally banned", () => {
  const baseline = validateCssAgainstGrammar(grammar, sources);
  const changedCss = `${threeCss}\n.design-probe { box-shadow: 0 0 1px #123456; }\n`;
  const changed = validateCssAgainstGrammar(grammar, { ...sources, threejs_cosmic: changedCss });
  assert.equal(changed.surfaces.threejs_cosmic.raw_color_literals, baseline.surfaces.threejs_cosmic.raw_color_literals + 1);
});
