import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { patchThreeDViewDimension, patchTwoDViewDimension } from "../scripts/apply-view-dimension-toggle.mjs";

const twoD = '<!doctype html><html><head><title>x</title></head><body data-map-style="galaxy-systems"><div class="controls"><label class="field"><span>Search</span><input id="search"></label><label class="field"><span>Style</span><select id="style"><option value="galaxy-systems">Galaxy Systems</option></select></label></div></body></html>';
const threeD = '<!doctype html><html><head><title>x</title></head><body data-map-style="threejs-cosmic"><div class="controls"><a id="twoDLink" class="three-link-button" href="../u/">2D Map</a></div></body></html>';

test("2D viewer gets a separate View dimension control without adding 3D to Style", () => {
  const html = patchTwoDViewDimension(twoD);
  assert.match(html, /data-view-dimension="2d"/);
  assert.match(html, /aria-label="View dimension"/);
  assert.match(html, /aria-current="page">2D</);
  assert.match(html, /id="view3D"[^>]*>3D <small>Lab<\/small>/);
  assert.match(html, /<select id="style"><option value="galaxy-systems">/);
  assert.doesNotMatch(html, /<option[^>]+value="(?:three|threejs|cosmic)"/);
  assert.match(html, /view-dimension-toggle\.css/);
  assert.match(html, /view-dimension-toggle\.js/);
  assert.equal(patchTwoDViewDimension(html), html);
});

test("Three.js viewer exposes the same View axis and a renderer-local Cosmic style", () => {
  const html = patchThreeDViewDimension(threeD);
  assert.match(html, /data-view-dimension="3d"/);
  assert.match(html, /id="twoDLink"[^>]*>2D<\/a>/);
  assert.match(html, /aria-current="page">3D <small>Lab<\/small>/);
  assert.match(html, /id="threeStyle"[^>]*><option value="cosmic">Cosmic<\/option>/);
  assert.match(html, /view-dimension-toggle\.css/);
  assert.match(html, /view-dimension-toggle\.js/);
  assert.equal(patchThreeDViewDimension(html), html);
});

test("view dimension runtime keeps renderer navigation separate from Style state", async () => {
  const source = await readFile(new URL("../scripts/public-view-dimension-toggle.js", import.meta.url), "utf8");
  assert.match(source, /const TWO_D_STYLES = new Set/);
  assert.match(source, /url\.searchParams\.delete\("style"\)/);
  assert.match(source, /url\.searchParams\.set\("style2d", current2DStyle\(\)\)/);
  assert.match(source, /url\.searchParams\.set\("style", style\)/);
  assert.match(source, /url\.searchParams\.delete\("style2d"\)/);
  assert.match(source, /url\.searchParams\.delete\("render"\)/);
  assert.match(source, /ProjectMapTransferableState/);
  assert.match(source, /ProjectMapViewDimension/);
});
