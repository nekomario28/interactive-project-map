import assert from "node:assert/strict";
import test from "node:test";
import { MANAGED_WORKFLOW_MARKER, completeGitHubAppInstall, createInstallState } from "../src/github-app-installer.ts";

const secret = "m".repeat(32);
const env = {
  GITHUB_APP_CLIENT_ID: "Iv1.marker-test",
  GITHUB_APP_CLIENT_SECRET: "client-secret",
  GITHUB_APP_SLUG: "project-map-test",
  INSTALL_STATE_SECRET: secret,
};
const options = { username: "octocat", theme: "dark", maxRepos: 100, includeForks: true, includeArchived: false };
const nowMs = Date.UTC(2026, 7, 22, 3, 0, 0);

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

test("a marker appearing later in an unrelated workflow does not grant installer ownership", async () => {
  const state = await createInstallState(options, secret, { nowMs, nonce: "marker-browser" });
  const unrelated = `name: My workflow\n# note: ${MANAGED_WORKFLOW_MARKER}\n`;
  let putCalls = 0;
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    if (url === "https://github.com/login/oauth/access_token") return json({ access_token: "ghu_ephemeral" });
    if (url.endsWith("/user/installations?per_page=100")) return json({ installations: [{ id: 42, account: { login: "octocat", type: "User" } }] });
    if (url.includes("/user/installations/42/repositories?")) return json({ repositories: [{ full_name: "octocat/octocat", default_branch: "main", permissions: { push: true } }] });
    if (url.includes("/contents/.github/workflows/project-map.yml?ref=main")) {
      return json({ sha: "existing", content: Buffer.from(unrelated, "utf8").toString("base64") });
    }
    if (init.method === "PUT") putCalls += 1;
    throw new Error(`unexpected fetch ${url}`);
  };
  const request = new Request(`https://maps.example/api/install/callback?code=oauth-code&state=${encodeURIComponent(state.state)}`, {
    headers: { Cookie: `project_map_install_nonce=${state.nonce}` },
  });

  await assert.rejects(
    () => completeGitHubAppInstall(request, env, { nowMs, fetchImpl, sleep: async () => {} }),
    (error) => error?.code === "workflow_conflict" && error?.status === 409,
  );
  assert.equal(putCalls, 0);
});
