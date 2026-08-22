import assert from "node:assert/strict";
import test from "node:test";
import { CONTRIBUTED_MAX_REPOSITORIES, contributedRepositoryCap, selectContributedRepositories } from "../scripts/contributed-ranking.mjs";

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

test("C1 preserves the real diagnostic evidence without a merged-only threshold", () => {
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
  assert.equal(selected.repositories.length, 6);
  assert.equal(selected.repositories[0].nameWithOwner, "c0c25034/ProjExD_4");
  assert.deepEqual(new Set(selected.repositories.map((item) => item.nameWithOwner)), new Set(realEvidence.map((item) => item.nameWithOwner)));
});

test("C1 ranks merged PRs, then commits, then PRs without invented weighted scores", () => {
  const selected = selectContributedRepositories([
    contribution("example/open-many", { pullRequests: 3 }),
    contribution("example/commits", { commits: 4 }),
    contribution("example/merged", { mergedPullRequests: 1, pullRequests: 1 }),
    contribution("example/open-one", { pullRequests: 1 }),
  ], 20);
  assert.deepEqual(selected.repositories.map((item) => item.nameWithOwner), [
    "example/merged",
    "example/commits",
    "example/open-many",
    "example/open-one",
  ]);
});

test("C1 caps noisy one-off external activity instead of thresholding it away", () => {
  const noisy = Array.from({ length: 30 }, (_, index) => contribution(`external/repo-${String(index).padStart(2, "0")}`, { pullRequests: 1 }));
  const selected = selectContributedRepositories(noisy, 100);
  assert.equal(selected.repositories.length, 12);
  assert.equal(selected.diagnostics.omittedRepositories, 18);
  assert.equal(selected.diagnostics.policy, "merged-prs>commits>prs>name; no activity threshold");
});

test("C1 selection is deterministic and deduplicates case-insensitive repository identity", () => {
  const input = [
    contribution("Org/Repo", { pullRequests: 1 }),
    contribution("org/repo", { commits: 2 }),
    contribution("alpha/one", { pullRequests: 1 }),
  ];
  const first = selectContributedRepositories(input, 10).repositories;
  const second = selectContributedRepositories([...input].reverse(), 10).repositories;
  assert.deepEqual(first, second);
  assert.equal(first.filter((item) => item.nameWithOwner.toLowerCase() === "org/repo").length, 1);
  assert.equal(first.find((item) => item.nameWithOwner.toLowerCase() === "org/repo")?.commits, 2);
});
