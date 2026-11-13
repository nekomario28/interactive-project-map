import assert from "node:assert/strict";
import test from "node:test";
import { innerActionSha, readStableBranch, releaseAuditReport } from "../scripts/audit-release-channel.mjs";

const STABLE = "9b062afdf8e7a0ff64c4a58d5e1c398ab7626704";
const OLD = "f1688ba0811ea17455edbd9e51dd82c5e67a0f4a";
const CANDIDATE = "10a7be7ee1caad1eb0cac334365a7cbbb95d3660";

test("release audit queries refs/heads/v1 and reads the exact resolved commit", async () => {
  const visited = [];
  const fetchImpl = async (url, init) => {
    visited.push(url);
    assert.equal(init.headers.Authorization, "Bearer read-token");
    const data = url.endsWith("/branches/v1")
      ? { commit: { sha: STABLE } }
      : { encoding: "base64", content: Buffer.from(`name: Generate\nsteps:\n  - uses: nekomario28/interactive-project-map@${OLD}\n`).toString("base64") };
    return { ok: true, json: async () => data };
  };
  const stable = await readStableBranch({ fetchImpl, token: "read-token" });
  assert.deepEqual(stable, { ref: "refs/heads/v1", commit: STABLE, innerAction: OLD });
  assert.ok(visited[0].endsWith("/branches/v1"));
  assert.ok(visited[1].endsWith(`/contents/.github/workflows/generate-project-map.yml?ref=${STABLE}`));
});

test("release audit distinguishes intentionally old stable channel from mismatched candidate pin", () => {
  const stable = { ref: "refs/heads/v1", commit: STABLE, innerAction: OLD };
  const candidateWorkflow = `uses: nekomario28/interactive-project-map@${CANDIDATE}`;
  const report = releaseAuditReport({ stable, candidateWorkflow, candidateCommit: "a".repeat(40), advertisedAction: CANDIDATE });
  assert.equal(report.releaseDiffers, true);
  assert.equal(report.promotionVerified, false);
  assert.throws(() => releaseAuditReport({ stable, candidateWorkflow, candidateCommit: STABLE, advertisedAction: OLD }), /diverged/);
  assert.throws(() => innerActionSha(candidateWorkflow + "\n" + candidateWorkflow), /exactly one/);
  assert.equal(releaseAuditReport({ stable, candidateWorkflow: `uses: nekomario28/interactive-project-map@${OLD}`, candidateCommit: STABLE, advertisedAction: OLD }).promotionVerified, true);
});

test("release audit rejects missing branch metadata and malformed workflow", async () => {
  await assert.rejects(
    readStableBranch({ fetchImpl: async () => ({ ok: true, json: async () => ({ commit: { sha: "short" } }) }) }),
    /valid commit SHA/,
  );
});
