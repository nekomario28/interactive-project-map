import assert from "node:assert/strict";
import test from "node:test";
import { fetchPublicRepos } from "../scripts/github.mjs";

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

test("Pages pagination continues until maxRepos eligible repositories are found", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      const page = Number(new URL(String(url)).searchParams.get("page"));
      if (page === 1) {
        return Response.json(Array.from({ length: 100 }, (_, index) => repo(index + 1, { fork: true })));
      }
      return Response.json([repo(101), repo(102)]);
    };

    const repos = await fetchPublicRepos("example", undefined, 2, {
      includeForks: false,
      includeArchived: true,
      enrichReadmes: false,
    });

    assert.equal(calls.length, 2);
    assert.deepEqual(repos.map((item) => item.id), [101, 102]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("static fetch enriches selected repositories without requiring README success", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url) => {
      const target = String(url);
      calls.push(target);
      if (target.includes("/users/example/repos?")) return Response.json([repo(1), repo(2)]);
      if (target.endsWith("/repos/example/repo-1/readme")) return new Response("# Project\n\nMinecraft NeoForge addon.");
      if (target.endsWith("/repos/example/repo-2/readme")) return new Response("", { status: 404 });
      throw new Error(`unexpected URL: ${target}`);
    };

    const repos = await fetchPublicRepos("example", undefined, 2);
    assert.match(repos[0].readmeExcerpt ?? "", /Minecraft NeoForge addon/);
    assert.equal(repos[1].readmeExcerpt, undefined);
    assert.equal(calls.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
