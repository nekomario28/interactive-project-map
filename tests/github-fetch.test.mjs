import assert from "node:assert/strict";
import test from "node:test";
import { fetchPublicRepos } from "../src/github.ts";

function repo(id, overrides = {}) {
  return {
    id,
    name: `repo-${id}`,
    html_url: `https://github.com/example/repo-${id}`,
    description: null,
    language: "TypeScript",
    topics: [],
    stargazers_count: 0,
    forks_count: 0,
    fork: false,
    archived: false,
    updated_at: "2026-08-18T00:00:00Z",
    ...overrides,
  };
}

test("filtered pagination keeps fetching until maxRepos eligible repositories are found", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      const page = Number(new URL(String(url)).searchParams.get("page"));
      if (page === 1) {
        return Response.json(Array.from({ length: 100 }, (_, index) => repo(index + 1, { fork: true })));
      }
      return Response.json([
        repo(101, { fork: false }),
        repo(102, { fork: false }),
      ]);
    };

    const repos = await fetchPublicRepos("example", {}, 2, {
      includeForks: false,
      includeArchived: true,
    });

    assert.equal(calls.length, 2);
    assert.deepEqual(repos.map((item) => item.id), [101, 102]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("archived repositories are skipped before the requested limit is applied", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json([
      repo(1, { archived: true }),
      repo(2),
      repo(3),
    ]);

    const repos = await fetchPublicRepos("example", {}, 2, {
      includeForks: true,
      includeArchived: false,
    });

    assert.deepEqual(repos.map((item) => item.id), [2, 3]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
