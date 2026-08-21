import assert from "node:assert/strict";
import test from "node:test";
import { renderViewer } from "../src/viewer.ts";

test("hosted viewer reports one-click install, update, and repair outcomes then removes transient URL state", () => {
  const html = renderViewer("octocat");
  assert.match(html, /id="install-result" role="status" hidden/);
  assert.match(html, /created:'Project Map installed · initial generation started\.'/);
  assert.match(html, /updated:'Project Map integration updated · regeneration started\.'/);
  assert.match(html, /unchanged:'Project Map is already current · regeneration started\.'/);
  assert.match(html, /cleanUrl\.searchParams\.delete\('install'\)/);
  assert.match(html, /history\.replaceState\(null,'',cleanUrl\)/);
  assert.match(html, /graphUrl\.searchParams\.set\('static','1'\)/);
});
