import assert from "node:assert/strict";
import test from "node:test";
import { githubAppRegistrationUrl } from "../scripts/github-app-registration-url.mjs";

test("GitHub App registration URL preselects the production one-click contract", () => {
  const url = new URL(githubAppRegistrationUrl("https://project-map.example.workers.dev"));

  assert.equal(url.origin, "https://github.com");
  assert.equal(url.pathname, "/settings/apps/new");
  assert.equal(url.searchParams.get("name"), "interactive-project-map");
  assert.equal(url.searchParams.get("url"), "https://project-map.example.workers.dev");
  assert.deepEqual(url.searchParams.getAll("callback_urls[]"), ["https://project-map.example.workers.dev/api/install/callback"]);
  assert.equal(url.searchParams.get("request_oauth_on_install"), "true");
  assert.equal(url.searchParams.get("public"), "true");
  assert.equal(url.searchParams.get("webhook_active"), "false");
  assert.equal(url.searchParams.get("contents"), "write");
  assert.equal(url.searchParams.get("workflows"), "write");
  assert.equal(url.searchParams.get("actions"), "write");
  assert.equal(url.searchParams.getAll("events[]").length, 0);
});

test("registration helper refuses an origin that could misbind OAuth callback", () => {
  assert.throws(() => githubAppRegistrationUrl("http://project-map.example.workers.dev"), /must use https/);
  assert.throws(() => githubAppRegistrationUrl("https://project-map.example.workers.dev/path"), /only the Worker origin/);
});
