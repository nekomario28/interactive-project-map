import assert from "node:assert/strict";
import test from "node:test";
import {
  MANAGED_WORKFLOW_MARKER,
  beginGitHubAppInstall,
  completeGitHubAppInstall,
  createInstallState,
  verifyInstallState,
} from "../src/github-app-installer.ts";

const secret = "s".repeat(32);
const env = {
  GITHUB_APP_CLIENT_ID: "Iv1.test-client",
  GITHUB_APP_CLIENT_SECRET: "client-secret",
  GITHUB_APP_SLUG: "project-map-test",
  INSTALL_STATE_SECRET: secret,
};
const options = {
  username: "octocat",
  theme: "dark",
  style: "sankey",
  maxRepos: 100,
  includeForks: true,
  includeArchived: false,
};
const nowMs = Date.UTC(2026, 7, 22, 0, 0, 0);

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", ...headers } });
}

function callbackRequest(state, nonce) {
  return new Request(`https://maps.example/api/install/callback?code=oauth-code&state=${encodeURIComponent(state)}`, {
    headers: { Cookie: `project_map_install_nonce=${nonce}` },
  });
}

test("signed installer state round-trips, expires, and is bound to the HttpOnly nonce cookie", async () => {
  const created = await createInstallState(options, secret, { nowMs, nonce: "browser-nonce" });
  const payload = await verifyInstallState(created.state, secret, created.nonce, { nowMs: nowMs + 30_000 });
  assert.equal(payload.username, "octocat");
  assert.equal(payload.style, "sankey");
  assert.equal(payload.maxRepos, 100);
  assert.equal(payload.nonce, "browser-nonce");

  await assert.rejects(() => verifyInstallState(created.state, secret, "wrong-browser", { nowMs }), /cookie mismatch/);
  await assert.rejects(() => verifyInstallState(created.state, secret, created.nonce, { nowMs: nowMs + 16 * 60_000 }), /expired/);

  const [body, signature] = created.state.split(".");
  const tampered = `${body.slice(0, -1)}${body.endsWith("A") ? "B" : "A"}.${signature}`;
  await assert.rejects(() => verifyInstallState(tampered, secret, created.nonce, { nowMs }), /state|signature/i);
});

test("install start redirects only to the configured GitHub App and sets a short-lived secure nonce cookie", async () => {
  const response = await beginGitHubAppInstall(new Request("https://maps.example/api/install/start"), env, options, { nowMs, nonce: "browser-nonce" });
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("Location"));
  assert.equal(location.origin, "https://github.com");
  assert.equal(location.pathname, "/apps/project-map-test/installations/new");
  assert.ok(location.searchParams.get("state"));
  assert.match(response.headers.get("Set-Cookie"), /project_map_install_nonce=browser-nonce/);
  assert.match(response.headers.get("Set-Cookie"), /HttpOnly/);
  assert.match(response.headers.get("Set-Cookie"), /Secure/);
  assert.match(response.headers.get("Set-Cookie"), /SameSite=Lax/);
});

test("callback verifies the user's installation, installs only the managed profile workflow, and dispatches it", async () => {
  const created = await createInstallState(options, secret, { nowMs, nonce: "browser-nonce" });
  const calls = [];
  let dispatchAttempts = 0;
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === "https://github.com/login/oauth/access_token") return json({ access_token: "ghu_ephemeral" });
    if (url.endsWith("/user/installations?per_page=100")) {
      return json({ installations: [{ id: 42, account: { login: "octocat", type: "User" } }] });
    }
    if (url.includes("/user/installations/42/repositories?")) {
      return json({ repositories: [{ full_name: "octocat/octocat", default_branch: "main", permissions: { push: true } }] });
    }
    if (url.includes("/repos/octocat/octocat/contents/.github/workflows/project-map.yml?ref=main")) {
      return new Response("not found", { status: 404 });
    }
    if (url.endsWith("/repos/octocat/octocat/contents/.github/workflows/project-map.yml") && init.method === "PUT") {
      const body = JSON.parse(init.body);
      const workflow = Buffer.from(body.content, "base64").toString("utf8");
      assert.ok(workflow.startsWith(MANAGED_WORKFLOW_MARKER));
      assert.match(workflow, /generate-project-map\.yml@v1/);
      assert.match(workflow, /style: sankey/);
      assert.match(workflow, /contents: write/);
      return json({ content: { path: ".github/workflows/project-map.yml" }, commit: { sha: "abc" } }, 201);
    }
    if (url.endsWith("/repos/octocat/octocat/actions/workflows/project-map.yml/dispatches")) {
      dispatchAttempts += 1;
      return dispatchAttempts === 1 ? new Response("not found", { status: 404 }) : new Response(null, { status: 204 });
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  const result = await completeGitHubAppInstall(callbackRequest(created.state, created.nonce), env, {
    nowMs,
    fetchImpl,
    sleep: async () => {},
  });

  assert.deepEqual({ username: result.username, repository: result.repository, workflow: result.workflow }, {
    username: "octocat",
    repository: "octocat/octocat",
    workflow: "created",
  });
  assert.match(result.viewerUrl, /^https:\/\/maps\.example\/u\/octocat\?/);
  assert.match(result.viewerUrl, /style=sankey/);
  assert.match(result.viewerUrl, /install=created/);
  assert.equal(dispatchAttempts, 2);
  const authCalls = calls.filter((call) => call.url.startsWith("https://api.github.com/"));
  assert.ok(authCalls.length >= 4);
  for (const call of authCalls) assert.equal(call.init.headers.Authorization, "Bearer ghu_ephemeral");
  assert.doesNotMatch(JSON.stringify(result), /ghu_ephemeral|oauth-code/);
});

test("callback refuses to overwrite an unrelated existing workflow", async () => {
  const created = await createInstallState(options, secret, { nowMs, nonce: "browser-nonce" });
  const unmanaged = Buffer.from("name: My existing workflow\n", "utf8").toString("base64");
  let writeAttempted = false;
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    if (url === "https://github.com/login/oauth/access_token") return json({ access_token: "ghu_ephemeral" });
    if (url.endsWith("/user/installations?per_page=100")) return json({ installations: [{ id: 42, account: { login: "octocat", type: "User" } }] });
    if (url.includes("/user/installations/42/repositories?")) return json({ repositories: [{ full_name: "octocat/octocat", default_branch: "main", permissions: { push: true } }] });
    if (url.includes("/contents/.github/workflows/project-map.yml?ref=main")) return json({ sha: "existing", content: unmanaged });
    if (init.method === "PUT") writeAttempted = true;
    throw new Error(`unexpected fetch ${url}`);
  };

  await assert.rejects(
    () => completeGitHubAppInstall(callbackRequest(created.state, created.nonce), env, { nowMs, fetchImpl, sleep: async () => {} }),
    (error) => error?.code === "workflow_conflict" && error?.status === 409,
  );
  assert.equal(writeAttempted, false);
});

test("callback rejects a spoofed profile target that is not in the authorized installation", async () => {
  const created = await createInstallState(options, secret, { nowMs, nonce: "browser-nonce" });
  const fetchImpl = async (input) => {
    const url = String(input);
    if (url === "https://github.com/login/oauth/access_token") return json({ access_token: "ghu_ephemeral" });
    if (url.endsWith("/user/installations?per_page=100")) return json({ installations: [{ id: 99, account: { login: "someone-else", type: "User" } }] });
    throw new Error(`unexpected fetch ${url}`);
  };

  await assert.rejects(
    () => completeGitHubAppInstall(callbackRequest(created.state, created.nonce), env, { nowMs, fetchImpl, sleep: async () => {} }),
    (error) => error?.code === "profile_installation_missing" && error?.status === 403,
  );
});
