import assert from "node:assert/strict";
import test from "node:test";
import { MANAGED_WORKFLOW_MARKER, completeGitHubAppInstall, createInstallState } from "../src/github-app-installer.ts";
import { renderInstallWorkflow } from "../src/install.ts";

const secret = "u".repeat(32);
const env = {
  GITHUB_APP_CLIENT_ID: "Iv1.update-test",
  GITHUB_APP_CLIENT_SECRET: "client-secret",
  GITHUB_APP_SLUG: "project-map-test",
  INSTALL_STATE_SECRET: secret,
};
const options = { username: "octocat", theme: "light", maxRepos: 80, includeForks: false, includeArchived: true };
const nowMs = Date.UTC(2026, 7, 22, 1, 0, 0);

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

function request(state, nonce) {
  return new Request(`https://maps.example/api/install/callback?code=oauth-code&state=${encodeURIComponent(state)}`, {
    headers: { Cookie: `project_map_install_nonce=${nonce}` },
  });
}

function commonFetch(existingContent, onPut, onDispatch = () => {}) {
  return async (input, init = {}) => {
    const url = String(input);
    if (url === "https://github.com/login/oauth/access_token") return json({ access_token: "ghu_ephemeral" });
    if (url.endsWith("/user/installations?per_page=100")) return json({ installations: [{ id: 42, account: { login: "octocat", type: "User" } }] });
    if (url.includes("/user/installations/42/repositories?")) return json({ repositories: [{ full_name: "octocat/octocat", default_branch: "main", permissions: { push: true } }] });
    if (url.includes("/contents/.github/workflows/project-map.yml?ref=main")) {
      return json({ sha: "existing-sha", content: Buffer.from(existingContent, "utf8").toString("base64") });
    }
    if (url.endsWith("/contents/.github/workflows/project-map.yml") && init.method === "PUT") {
      onPut(JSON.parse(init.body));
      return json({ content: {}, commit: { sha: "updated" } }, 200);
    }
    if (url.endsWith("/actions/workflows/project-map.yml/dispatches")) {
      onDispatch();
      return new Response(null, { status: 204 });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
}

test("managed workflow is updated in place with its current blob SHA", async () => {
  const state = await createInstallState(options, secret, { nowMs, nonce: "update-browser" });
  let putBody;
  let dispatched = 0;
  const fetchImpl = commonFetch(`${MANAGED_WORKFLOW_MARKER}\nname: Old managed Project Map\n`, (body) => { putBody = body; }, () => { dispatched += 1; });
  const result = await completeGitHubAppInstall(request(state.state, state.nonce), env, { nowMs, fetchImpl, sleep: async () => {} });

  assert.equal(result.workflow, "updated");
  assert.equal(putBody.sha, "existing-sha");
  const installed = Buffer.from(putBody.content, "base64").toString("utf8");
  assert.ok(installed.startsWith(MANAGED_WORKFLOW_MARKER));
  assert.match(installed, /generate-project-map\.yml@[0-9a-f]{40}/);
  assert.equal(dispatched, 1);
});

test("already-current managed workflow is not rewritten but can still dispatch", async () => {
  const state = await createInstallState(options, secret, { nowMs, nonce: "noop-browser" });
  const current = `${MANAGED_WORKFLOW_MARKER}\n${renderInstallWorkflow(options)}`;
  let putCalls = 0;
  let dispatchCalls = 0;
  const fetchImpl = commonFetch(current, () => { putCalls += 1; }, () => { dispatchCalls += 1; });
  const result = await completeGitHubAppInstall(request(state.state, state.nonce), env, { nowMs, fetchImpl, sleep: async () => {} });

  assert.equal(result.workflow, "unchanged");
  assert.equal(putCalls, 0);
  assert.equal(dispatchCalls, 1);
});
