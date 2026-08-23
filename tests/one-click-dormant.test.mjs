import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderHome } from "../src/home.ts";
import { dormantInstallerResponse, isOneClickInstallerExposed } from "../src/one-click-exposure.ts";

const configuredSecrets = {
  GITHUB_APP_CLIENT_ID: "Iv1.test-client",
  GITHUB_APP_CLIENT_SECRET: "client-secret",
  GITHUB_APP_SLUG: "project-map-test",
  INSTALL_STATE_SECRET: "s".repeat(32),
};

test("one-click stays hidden while dormant even when credentials exist", () => {
  assert.equal(isOneClickInstallerExposed(configuredSecrets), false);
  assert.doesNotMatch(renderHome("https://maps.example", isOneClickInstallerExposed(configuredSecrets)), /id="one-click-install"/);
});

test("one-click exposure requires an explicit true gate in addition to complete credentials", () => {
  const enabled = { ...configuredSecrets, ENABLE_ONE_CLICK_INSTALLER: "true" };
  assert.equal(isOneClickInstallerExposed(enabled), true);
  assert.match(renderHome("https://maps.example", isOneClickInstallerExposed(enabled)), /id="one-click-install"/);

  assert.equal(isOneClickInstallerExposed({ ENABLE_ONE_CLICK_INSTALLER: "true" }), false);
  assert.equal(isOneClickInstallerExposed({ ...configuredSecrets, ENABLE_ONE_CLICK_INSTALLER: "false" }), false);
});

test("dormant installer response is non-cacheable 404", async () => {
  const response = dormantInstallerResponse();
  assert.equal(response.status, 404);
  assert.equal(await response.text(), "Not Found");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
});

test("Worker root redirects dormant setup traffic to canonical GitHub Pages and only restores legacy home after explicit exposure", async () => {
  const source = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
  assert.match(source, /const CANONICAL_SETUP_URL = "https:\/\/nekomario28\.github\.io\/interactive-project-map\/";/);
  assert.match(source, /if \(url\.pathname === "\/"\) \{\s*const oneClickExposed = isOneClickInstallerExposed\(env\);\s*if \(!oneClickExposed\) \{[\s\S]*?status: 302,[\s\S]*?Location: CANONICAL_SETUP_URL,[\s\S]*?return new Response\(renderHome\(url\.origin, true\)/);
});

test("Worker entrypoint gates both installer GET routes before operational work and clears dormant callback nonce", async () => {
  const source = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
  assert.match(source, /if \(url\.pathname === "\/api\/install\/start"\) \{\s*if \(!isOneClickInstallerExposed\(env\)\) return dormantInstallerResponse\(\);\s*await enforceInstallerRateLimit/);
  assert.match(source, /if \(url\.pathname === "\/api\/install\/callback"\) \{\s*if \(!isOneClickInstallerExposed\(env\)\) \{\s*const response = dormantInstallerResponse\(\);\s*response\.headers\.append\("Set-Cookie", clearInstallNonceCookie\(\)\);\s*return response;/);
});
