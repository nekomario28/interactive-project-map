import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.ts";

const configuredSecrets = {
  GITHUB_APP_CLIENT_ID: "Iv1.test-client",
  GITHUB_APP_CLIENT_SECRET: "client-secret",
  GITHUB_APP_SLUG: "project-map-test",
  INSTALL_STATE_SECRET: "s".repeat(32),
};

const ctx = { waitUntil() {} };

test("one-click stays hidden and installer routes fail closed while dormant even when credentials exist", async () => {
  const home = await worker.fetch(new Request("https://maps.example/"), configuredSecrets, ctx);
  assert.equal(home.status, 200);
  assert.doesNotMatch(await home.text(), /id="one-click-install"/);

  const start = await worker.fetch(
    new Request("https://maps.example/api/install/start?username=octocat"),
    configuredSecrets,
    ctx,
  );
  assert.equal(start.status, 404);
  assert.equal(await start.text(), "Not Found");
  assert.equal(start.headers.get("Cache-Control"), "no-store");

  const callback = await worker.fetch(
    new Request("https://maps.example/api/install/callback?code=unused&state=unused"),
    configuredSecrets,
    ctx,
  );
  assert.equal(callback.status, 404);
  assert.match(callback.headers.get("Set-Cookie") ?? "", /Max-Age=0/);
});

test("one-click exposure requires an explicit true gate in addition to complete credentials", async () => {
  const enabledHome = await worker.fetch(
    new Request("https://maps.example/"),
    { ...configuredSecrets, ENABLE_ONE_CLICK_INSTALLER: "true" },
    ctx,
  );
  assert.equal(enabledHome.status, 200);
  assert.match(await enabledHome.text(), /id="one-click-install"/);

  const incompleteHome = await worker.fetch(
    new Request("https://maps.example/"),
    { ENABLE_ONE_CLICK_INSTALLER: "true" },
    ctx,
  );
  assert.equal(incompleteHome.status, 200);
  assert.doesNotMatch(await incompleteHome.text(), /id="one-click-install"/);
});
