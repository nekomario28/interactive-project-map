import assert from "node:assert/strict";
import test from "node:test";
import { renderHome } from "../src/home.ts";

test("one-click control is absent when GitHub App secrets are not configured", () => {
  const html = renderHome("https://maps.example");
  assert.doesNotMatch(html, /id="one-click-install"/);
  assert.match(html, /id="workflow"/);
  assert.match(html, /Copy workflow/);
});

test("Cloudflare setup exposes the same twelve style choices, Contributed opt-in, and beginner Step 0", () => {
  const html = renderHome("https://maps.example");
  const styles = ["radial", "galaxy-classic", "galaxy-systems", "galaxy-hybrid", "obsidian", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"];
  assert.match(html, /id="map-style"/);
  for (const style of styles) assert.match(html, new RegExp(`value="${style}"`));
  assert.match(html, /id="contributed" type="checkbox"/);
  assert.match(html, /Include public contributions/);
  assert.match(html, /p\.set\('contributed',String\(v\.contributed\)\)/);
  assert.match(html, /contributedInput\.checked=initial\.get\('contributed'\)==='true'/);
  assert.match(html, /id="create-profile-repo"/);
  assert.match(html, /https:\/\/github\.com\/new/);
  assert.match(html, /searchParams\.set\('visibility','public'\)/);
  assert.match(html, /enable <strong>Add README<\/strong>/);
  assert.match(html, /p\.set\('style',v\.style\)/);
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
