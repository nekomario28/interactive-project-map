import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertExactSurfaceFileSet,
  validateCssAgainstGrammar,
  validateDesignSystem
} from "../scripts/validate-design-system.mjs";

const grammar = JSON.parse(await readFile(new URL("../design/ui-reference-grammar.json", import.meta.url), "utf8"));
const sharedCss = await readFile(new URL("../scripts/public-viewer.css", import.meta.url), "utf8");
const threeCss = await readFile(new URL("../scripts/public-threejs-viewer.css", import.meta.url), "utf8");
const threeLabelCss = await readFile(new URL("../scripts/public-threejs-repository-labels.css", import.meta.url), "utf8");
const sources = { shared_2d: [sharedCss], threejs_cosmic: [threeCss, threeLabelCss] };

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("current public UI passes the measured detection-only grammar across complete surface source sets", async () => {
  const report = await validateDesignSystem(new URL("..", import.meta.url).pathname);
  assert.equal(report.surfaces.shared_2d.source_files, 1);
  assert.equal(report.surfaces.shared_2d.roles, 14);
  assert.equal(report.surfaces.shared_2d.consumed_roles, 14);
  assert.equal(report.surfaces.shared_2d.unconsumed_roles, 0);
  assert.equal(report.surfaces.threejs_cosmic.source_files, 2);
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

test("grammar v1 cannot silently bypass composite-surface coverage", () => {
  const changed = clone(grammar);
  changed.version = 1;
  assert.throws(() => validateCssAgainstGrammar(changed, sources), /grammar.version must be 2/);
});

test("measured shared semantic color drift is detected before screenshots", () => {
  const changedCss = sharedCss.replace("--accent: #64d2ff;", "--accent: #63d2ff;");
  assert.throws(
    () => validateCssAgainstGrammar(grammar, { ...sources, shared_2d: [changedCss] }),
    /--accent expected #64d2ff but got #63d2ff/
  );
});

test("a previously unconsumed Three.js role cannot silently become renderer authority from auxiliary CSS", () => {
  const changedLabelCss = `${threeLabelCss}\n.design-probe { color: var(--three-text); }\n`;
  assert.throws(
    () => validateCssAgainstGrammar(grammar, { ...sources, threejs_cosmic: [threeCss, changedLabelCss] }),
    /semantic role consumption changed/
  );
});

test("reduced-motion remains a hard cross-surface accessibility boundary", () => {
  const changedCss = threeCss.replace("@media (prefers-reduced-motion: reduce)", "@media (min-width: 1px)");
  assert.throws(
    () => validateCssAgainstGrammar(grammar, { ...sources, threejs_cosmic: [changedCss, threeLabelCss] }),
    /missing prefers-reduced-motion boundary/
  );
});

test("repository-label presentation literals are included in the Three.js census without becoming authority", () => {
  const full = validateCssAgainstGrammar(grammar, sources);
  const viewerOnlyGrammar = clone(grammar);
  viewerOnlyGrammar.surfaces.threejs_cosmic.files = ["scripts/public-threejs-viewer.css"];
  const viewerOnly = validateCssAgainstGrammar(viewerOnlyGrammar, {
    shared_2d: [sharedCss],
    threejs_cosmic: [threeCss]
  });
  assert.equal(
    full.surfaces.threejs_cosmic.raw_color_literals,
    viewerOnly.surfaces.threejs_cosmic.raw_color_literals + 12
  );
  assert.equal(full.surfaces.threejs_cosmic.consumed_roles, viewerOnly.surfaces.threejs_cosmic.consumed_roles);
});

test("raw artistic color literals are censused rather than globally banned", () => {
  const baseline = validateCssAgainstGrammar(grammar, sources);
  const changedLabelCss = `${threeLabelCss}\n.design-probe { box-shadow: 0 0 1px #123456; }\n`;
  const changed = validateCssAgainstGrammar(grammar, {
    ...sources,
    threejs_cosmic: [threeCss, changedLabelCss]
  });
  assert.equal(changed.surfaces.threejs_cosmic.raw_color_literals, baseline.surfaces.threejs_cosmic.raw_color_literals + 1);
});

test("CSS source count must match the grammar source set", () => {
  assert.throws(
    () => validateCssAgainstGrammar(grammar, { ...sources, threejs_cosmic: [threeCss] }),
    /CSS source count must match grammar files \(2\)/
  );
});

test("Three.js source-set discovery fails closed on missing or extra presentation CSS", () => {
  const declared = grammar.surfaces.threejs_cosmic.files;
  assert.doesNotThrow(() => assertExactSurfaceFileSet("threejs_cosmic", declared, [...declared].reverse()));
  assert.throws(
    () => assertExactSurfaceFileSet("threejs_cosmic", declared, [declared[0]]),
    /source file set drift/
  );
  assert.throws(
    () => assertExactSurfaceFileSet("threejs_cosmic", declared, [...declared, "scripts/public-threejs-future.css"]),
    /source file set drift/
  );
});
