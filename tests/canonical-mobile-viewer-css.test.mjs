import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceCss = await readFile(new URL("../scripts/public-viewer.css", import.meta.url), "utf8");

const MOBILE_HARDENING_MARKER = "Emitted-site mobile hardening: keep the viewer inside narrow viewports.";

test("narrow-mobile viewer hardening lives in the canonical stylesheet", () => {
  assert.equal(sourceCss.split(MOBILE_HARDENING_MARKER).length - 1, 1);
  assert.match(sourceCss, /@media \(max-width: 480px\)/);
  assert.match(sourceCss, /\.field:first-child\s*\{\s*flex: 1 1 100%;/s);
  assert.match(sourceCss, /\.field:nth-child\(2\)\s*\{\s*flex: 1 1 150px;/s);
  assert.match(sourceCss, /\.field select\s*\{\s*width: 100%;\s*min-width: 0;/s);
  assert.match(sourceCss, /footer > span:first-child\s*\{[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/s);
});
