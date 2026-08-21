import assert from "node:assert/strict";
import test from "node:test";
import { completeGitHubAppInstall, createInstallState } from "../src/github-app-installer.ts";

const secret = "o".repeat(32);
const env = {
  GITHUB_APP_CLIENT_ID: "Iv1.oauth-test",
  GITHUB_APP_CLIENT_SECRET: "client-secret",
  GITHUB_APP_SLUG: "project-map-test",
  INSTALL_STATE_SECRET: secret,
};
const options = { username: "octocat", theme: "dark", maxRepos: 50, includeForks: true, includeArchived: false };
const nowMs = Date.UTC(2026, 7, 22, 2, 0, 0);

function callbackRequest(state, nonce) {
  return new Request(`https://maps.example/api/install/callback?code=oauth-code&state=${encodeURIComponent(state)}`, {
    headers: { Cookie: `project_map_install_nonce=${nonce}` },
  });
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

test("OAuth code exchange is bound to the exact callback URL", async () => {
  const created = await createInstallState(options, secret, { nowMs, nonce: "oauth-browser" });
  let oauthBody;
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    if (url === "https://github.com/login/oauth/access_token") {
      oauthBody = new URLSearchParams(init.body);
      return json({ access_token: "ghu_ephemeral" });
    }
    if (url.endsWith("/user/installations?per_page=100")) return json({ installations: [] });
    throw new Error(`unexpected fetch ${url}`);
  };

  await assert.rejects(
    () => completeGitHubAppInstall(callbackRequest(created.state, created.nonce), env, { nowMs, fetchImpl, sleep: async () => {} }),
    (error) => error?.code === "profile_installation_missing",
  );
  assert.equal(oauthBody.get("client_id"), env.GITHUB_APP_CLIENT_ID);
  assert.equal(oauthBody.get("code"), "oauth-code");
  assert.equal(oauthBody.get("redirect_uri"), "https://maps.example/api/install/callback");
});

test("OAuth exchange rejects tokens that are not GitHub App user tokens", async () => {
  const created = await createInstallState(options, secret, { nowMs, nonce: "wrong-token-browser" });
  const fetchImpl = async (input) => {
    const url = String(input);
    if (url === "https://github.com/login/oauth/access_token") return json({ access_token: "gho_wrong-token-kind" });
    throw new Error(`unexpected fetch ${url}`);
  };

  await assert.rejects(
    () => completeGitHubAppInstall(callbackRequest(created.state, created.nonce), env, { nowMs, fetchImpl, sleep: async () => {} }),
    (error) => error?.code === "oauth_exchange_failed" && error?.status === 403,
  );
});
