import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { patchThreeDViewDimension, patchTwoDViewDimension } from "../scripts/apply-view-dimension-toggle.mjs";

const twoD = '<!doctype html><html><head><title>x</title></head><body data-map-style="galaxy-systems"><div class="controls"><label class="field"><span>Search</span><input id="search"></label><label class="field"><span>Style</span><select id="style"><option value="galaxy-systems">Galaxy Systems</option></select></label></div></body></html>';
const threeD = '<!doctype html><html><head><title>x</title></head><body data-map-style="threejs-cosmic"><div class="controls"><a id="twoDLink" class="three-link-button" href="../u/">2D Map</a></div></body></html>';

test("2D viewer gets a separate View dimension control without adding 3D to Style", () => {
  const html = patchTwoDViewDimension(twoD);
  assert.match(html, /data-view-dimension="2d"/);
  assert.match(html, /aria-label="Rendering dimension"/);
  assert.match(html, /aria-current="page">2D</);
  assert.match(html, /id="view3D"[^>]*>3D <small>Lab<\/small>/);
  assert.match(html, /<select id="style"><option value="galaxy-systems">/);
  assert.doesNotMatch(html, /<option[^>]+value="(?:three|threejs|cosmic)"/);
  assert.match(html, /view-dimension-toggle\.css/);
  assert.match(html, /view-dimension-toggle\.js/);
  assert.equal(patchTwoDViewDimension(html), html);
});

test("Three.js viewer exposes four renderer-local styles", () => {
  const html = patchThreeDViewDimension(threeD);
  assert.match(html, /data-view-dimension="3d"/);
  assert.match(html, /aria-label="Rendering dimension"/);
  assert.match(html, /id="twoDLink"[^>]*>2D<\/a>/);
  assert.match(html, /aria-current="page">3D <small>Lab<\/small>/);
  assert.match(html, /id="threeStyle"[^>]*><option value="cosmic">Cosmic<\/option><option value="galaxy">Galaxy<\/option><option value="aurora">Aurora<\/option><option value="wireframe">Wireframe<\/option>/);
  assert.match(html, /view-dimension-toggle\.css/);
  assert.match(html, /view-dimension-toggle\.js/);
  assert.equal(patchThreeDViewDimension(html), html);
});

test("Three.js Style control is restored even when the View control already exists", () => {
  const complete = patchThreeDViewDimension(threeD);
  const partial = complete.replace(/<label class="field view-style-field">[\s\S]*?<\/label>/, "");
  assert.match(partial, /class="control-cluster view-mode-cluster"/);
  assert.doesNotMatch(partial, /id="threeStyle"/);

  const repaired = patchThreeDViewDimension(partial);
  assert.match(repaired, /class="field view-style-field"/);
  assert.match(repaired, /<option value="cosmic">Cosmic<\/option>/);
  assert.match(repaired, /<option value="galaxy">Galaxy<\/option>/);
  assert.match(repaired, /<option value="aurora">Aurora<\/option>/);
  assert.match(repaired, /<option value="wireframe">Wireframe<\/option>/);
  assert.equal(patchThreeDViewDimension(repaired), repaired);
});

test("view dimension runtime keeps 2D and 3D Style state separate", async () => {
  const source = await readFile(new URL("../scripts/public-view-dimension-toggle.js", import.meta.url), "utf8");
  assert.match(source, /const TWO_D_STYLES = new Set/);
  assert.match(source, /const THREE_D_STYLES = new Set\(\["cosmic", "galaxy", "aurora", "wireframe"\]\)/);
  assert.match(source, /url\.searchParams\.delete\("style"\)/);
  assert.match(source, /url\.searchParams\.set\("style2d", current2DStyle\(\)\)/);
  assert.match(source, /url\.searchParams\.set\("style3d", style\)/);
  assert.match(source, /url\.searchParams\.delete\("style3d"\)/);
  assert.match(source, /if \(style\) url\.searchParams\.set\("style", style\)/);
  assert.match(source, /url\.searchParams\.delete\("style2d"\)/);
  assert.match(source, /url\.searchParams\.delete\("render"\)/);
  assert.match(source, /valid2DStyle\(source\.searchParams\.get\("style2d"\)\)/);
  assert.match(source, /current3DStyle/);
  assert.match(source, /ProjectMapTransferableState/);
  assert.match(source, /ProjectMapViewDimension/);
});

test("Three.js View and Style controls stay ahead of the remaining toolbar controls", async () => {
  const source = await readFile(new URL("../scripts/public-view-dimension-toggle.css", import.meta.url), "utf8");
  assert.match(source, /body\[data-view-dimension="3d"\] \.view-mode-cluster \{[\s\S]*?order: -2;/);
  assert.match(source, /body\[data-view-dimension="3d"\] \.view-style-field \{[\s\S]*?order: -1;/);
  assert.match(source, /visibility: visible;/);
  assert.match(source, /opacity: 1;/);
});

test("render density stays renderer-local in both 2D to 3D and 3D to 2D navigation", async () => {
  const source = await readFile(new URL("../scripts/public-view-dimension-toggle.js", import.meta.url), "utf8");
  const transferable = source.match(/const TRANSFERABLE_KEYS = \[([^\]]+)\]/)?.[1] || "";
  assert.ok(transferable, "TRANSFERABLE_KEYS should remain explicit and inspectable");
  assert.doesNotMatch(transferable, /["']render["']/);
  assert.doesNotMatch(transferable, /["']style3d["']/);
  assert.match(source, /url\.searchParams\.delete\("render"\)/);
});
