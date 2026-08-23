import assert from "node:assert/strict";
import test from "node:test";
import { CONTRIBUTED_MAX_REPOSITORIES, contributedRepositoryCap, isAcceptedContributedRepository, selectContributedRepositories } from "../scripts/contributed-ranking.mjs";

function contribution(nameWithOwner, { commits = 0, pullRequests = 0, mergedPullRequests = 0 } = {}) {
  return { nameWithOwner, commits, pullRequests, mergedPullRequests };
}

test("C1 cap stays small for sparse portfolios and bounded for very active portfolios", () => {
  assert.equal(contributedRepositoryCap(0), 4);
  assert.equal(contributedRepositoryCap(3), 4);
  assert.equal(contributedRepositoryCap(13), 7);
  assert.equal(contributedRepositoryCap(20), 10);
  assert.equal(contributedRepositoryCap(100), CONTRIBUTED_MAX_REPOSITORIES);
});

test("C1 accepts merged PRs or direct external commits, but not pending-PR-only repositories", () => {
  assert.equal(isAcceptedContributedRepository(contribution("example/merged", { pullRequests: 1, mergedPullRequests: 1 })), true);
  assert.equal(isAcceptedContributedRepository(contribution("example/direct", { commits: 1 })), true);
  assert.equal(isAcceptedContributedRepository(contribution("example/pending", { pullRequests: 4 })), false);
});

test("C1 real diagnostic evidence keeps accepted work and excludes five pending-only upstream PRs", () => {
  const realEvidence = [
    contribution("c0c25034/ProjExD_4", { commits: 1, pullRequests: 1, mergedPullRequests: 1 }),
    contribution("gazebosim/gz-sim", { pullRequests: 1 }),
    contribution("gazebosim/ros_gz", { pullRequests: 1 }),
    contribution("SkyAdri-mc/BuyClaimChunks", { pullRequests: 1 }),
    contribution("talhanation/recruits", { pullRequests: 1 }),
    contribution("talhanation/workers", { pullRequests: 1 }),
  ];
  const selected = selectContributedRepositories(realEvidence, 13);
  assert.equal(selected.diagnostics.cap, 7);
  assert.equal(selected.diagnostics.candidateRepositories, 6);
  assert.equal(selected.diagnostics.eligibleRepositories, 1);
  assert.equal(selected.diagnostics.pendingOnlyRepositories, 5);
  assert.equal(selected.diagnostics.omittedRepositories, 5);
  assert.deepEqual(selected.repositories.map((item) => item.nameWithOwner), ["c0c25034/ProjExD_4"]);
});

test("C1 ranks accepted merged PRs, then direct commits without invented weighted scores", () => {
  const selected = selectContributedRepositories([
    contribution("example/pending-many", { pullRequests: 3 }),
    contribution("example/commits", { commits: 4 }),
    contribution("example/merged", { mergedPullRequests: 1, pullRequests: 1 }),
    contribution("example/direct-one", { commits: 1 }),
  ], 20);
  assert.deepEqual(selected.repositories.map((item) => item.nameWithOwner), [
    "example/merged",
    "example/commits",
    "example/direct-one",
  ]);
  assert.equal(selected.diagnostics.pendingOnlyRepositories, 1);
});

test("C1 rejects noisy one-off pending PR activity instead of letting cap imply acceptance", () => {
  const noisy = Array.from({ length: 30 }, (_, index) => contribution(`external/repo-${String(index).padStart(2, "0")}`, { pullRequests: 1 }));
  const selected = selectContributedRepositories(noisy, 100);
  assert.equal(selected.repositories.length, 0);
  assert.equal(selected.diagnostics.pendingOnlyRepositories, 30);
  assert.equal(selected.diagnostics.omittedRepositories, 30);
  assert.equal(selected.diagnostics.policy, "accepted: merged-prs|commits; rank merged-prs>commits>prs>name");
});

test("C1 selection is deterministic and deduplicates case-insensitive repository identity", () => {
  const input = [
    contribution("Org/Repo", { pullRequests: 1 }),
    contribution("org/repo", { commits: 2 }),
    contribution("alpha/one", { commits: 1 }),
  ];
  const first = selectContributedRepositories(input, 10).repositories;
  const second = selectContributedRepositories([...input].reverse(), 10).repositories;
  assert.deepEqual(first, second);
  assert.equal(first.filter((item) => item.nameWithOwner.toLowerCase() === "org/repo").length, 1);
  assert.equal(first.find((item) => item.nameWithOwner.toLowerCase() === "org/repo")?.commits, 2);
});
