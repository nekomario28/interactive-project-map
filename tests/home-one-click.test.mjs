import assert from "node:assert/strict";
import test from "node:test";
import { renderHome } from "../src/home.ts";

test("one-click control is absent when GitHub App secrets are not configured", () => {
  const html = renderHome("https://maps.example");
  assert.doesNotMatch(html, /id="one-click-install"/);
  assert.match(html, /id="workflow"/);
  assert.match(html, /Copy workflow/);
});

test("configured home adds one-click start without removing the manual fallback", () => {
  const html = renderHome("https://maps.example", true);
  assert.match(html, /id="one-click-install"/);
  assert.match(html, /Install with GitHub App/);
  assert.match(html, /\/api\/install\/start/);
  assert.match(html, /if\(oneClickInstall\)oneClickInstall\.href=u\.oneClick/);
  assert.match(html, /id="workflow"/);
  assert.match(html, /Copy workflow/);
});
