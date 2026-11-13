import test from "node:test";
import assert from "node:assert/strict";
import { collapseVerifiedContributionForks } from "../scripts/contributed-generation.mjs";

const upstream = [{ owner: "astral-sh", name: "ruff", nameWithOwner: "astral-sh/ruff" }];
const fork = (name, lineage = {}) => ({ name, fork: true, ...lineage });
const ok = (lineage, fullName) => ({
  ok: true,
  json: async () => ({ fork: true, ...(fullName ? { full_name: fullName } : {}), ...lineage }),
});

test("renamed personal fork is suppressed using its verified API parent", async () => {
  const calls = [];
  const result = await collapseVerifiedContributionForks([
    fork("my-ruff"), { name: "my-project", fork: false },
  ], upstream, "example", "token", {
    fetchImpl: async (url, request) => {
      calls.push(url);
      assert.equal(request.headers.Authorization, "Bearer token");
      return ok({ parent: { full_name: "astral-sh/ruff" } }, "example/my-ruff");
    },
  });
  assert.deepEqual(calls, ["https://api.github.com/repos/example/my-ruff"]);
  assert.deepEqual(result.repositories.map((r) => r.name), ["my-project"]);
  assert.equal(result.suppressedForkCount, 1);
  assert.equal(result.lineageLookups, 1);
  assert.equal(result.linkedForks.get("astral-sh/ruff"), "https://github.com/example/my-ruff");
});

test("verified inline lineage does not spend API calls", async () => {
  const result = await collapseVerifiedContributionForks([
    fork("my-renamed", { source: { full_name: "ASTRAL-SH/RUFF" } }),
  ], upstream, "example", "", {
    maxLookups: 0,
    fetchImpl: () => { throw new Error("no network expected"); },
  });
  assert.equal(result.suppressedForkCount, 1);
  assert.equal(result.lineageLookups, 0);
});

test("same-name unrelated fork and unknown lineage are preserved", async () => {
  const result = await collapseVerifiedContributionForks([
    fork("ruff"), fork("my-renamed"),
  ], upstream, "example", "", {
    fetchImpl: async (url) => url.endsWith("/ruff")
      ? ok({ source: { full_name: "another/ruff" }, parent: { full_name: "another/ruff" } })
      : { ok: false, status: 429 },
  });
  assert.deepEqual(result.repositories.map((r) => r.name), ["ruff", "my-renamed"]);
  assert.equal(result.suppressedForkCount, 0);
  assert.equal(result.linkedForks.size, 0);
});

test("an unrelated same-name fork cannot suppress a selected upstream", async () => {
  const result = await collapseVerifiedContributionForks([
    fork("ruff", { source: { full_name: "someone-else/ruff" } }),
  ], upstream, "example", "", { maxLookups: 0 });
  assert.equal(result.repositories.length, 1);
  assert.equal(result.suppressedForkCount, 0);
});

test("API lookup count is bounded and matching names are prioritized", async () => {
  const calls = [];
  const many = Array.from({ length: 30 }, (_, i) => fork(`other-${i}`));
  many.push(fork("ruff"));
  const result = await collapseVerifiedContributionForks(many, upstream, "example", "", {
    maxLookups: 2,
    fetchImpl: async (url) => {
      calls.push(url);
      return ok({ source: { full_name: "another/unrelated" } });
    },
  });
  assert.equal(result.lineageLookups, 2);
  assert.equal(calls.length, 2);
  assert.equal(calls[0], "https://api.github.com/repos/example/ruff");
  assert.equal(result.repositories.length, 31);
});

test("successful lineage lookups are cached across calls", async () => {
  const cache = new Map();
  let calls = 0;
  const opts = {
    lineageCache: cache,
    fetchImpl: async () => {
      calls += 1;
      return ok({ source: { full_name: "astral-sh/ruff" } });
    },
  };
  const first = await collapseVerifiedContributionForks([fork("my-ruff")], upstream, "example", "", opts);
  const second = await collapseVerifiedContributionForks([fork("my-ruff")], upstream, "example", "", { ...opts, maxLookups: 0 });
  assert.equal(first.suppressedForkCount, 1);
  assert.equal(second.suppressedForkCount, 1);
  assert.equal(second.lineageLookups, 0);
  assert.equal(calls, 1);
});

test("wrong repository identity and malformed parent/source are fail-closed", async () => {
  const result = await collapseVerifiedContributionForks([
    fork("my-ruff"), fork("other"),
  ], upstream, "example", "", {
    fetchImpl: async (url) => url.endsWith("/my-ruff")
      ? ok({ parent: { full_name: "astral-sh/ruff" } }, "attacker/my-ruff")
      : ok({ source: { full_name: "astral-sh/ruff/extra" } }, "example/other"),
  });
  assert.equal(result.repositories.length, 2);
  assert.equal(result.suppressedForkCount, 0);
});
