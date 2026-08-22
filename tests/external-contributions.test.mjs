import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchPublicExternalContributions as fetchSourceContributions,
  externalContributionWindow as sourceWindow,
} from "../src/external-contributions.ts";
import {
  fetchPublicExternalContributions as fetchStaticContributions,
  externalContributionWindow as staticWindow,
} from "../scripts/external-contributions.mjs";

const NOW = Date.parse("2026-08-22T08:30:00Z");

function repository(nameWithOwner, overrides = {}) {
  const [owner, name] = nameWithOwner.split("/");
  return {
    nameWithOwner,
    name,
    owner: { login: owner },
    isPrivate: false,
    isFork: false,
    isArchived: false,
    url: `https://github.com/${nameWithOwner}`,
    description: `${name} project`,
    primaryLanguage: { name: "TypeScript" },
    repositoryTopics: { nodes: [{ topic: { name: "robotics" } }] },
    stargazerCount: 7,
    forkCount: 2,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2026-08-20T00:00:00Z",
    ...overrides,
  };
}

function payload() {
  return {
    data: {
      user: {
        contributionsCollection: {
          commitContributionsByRepository: [
            {
              repository: repository("upstream/alpha"),
              contributions: {
                pageInfo: { hasNextPage: false },
                nodes: [
                  { commitCount: 4, isRestricted: false },
                  { commitCount: 50, isRestricted: true },
                ],
              },
            },
            {
              repository: repository("example/owned"),
              contributions: { pageInfo: { hasNextPage: false }, nodes: [{ commitCount: 20, isRestricted: false }] },
            },
            {
              repository: repository("private/hidden", { isPrivate: true }),
              contributions: { pageInfo: { hasNextPage: false }, nodes: [{ commitCount: 20, isRestricted: false }] },
            },
          ],
          pullRequestContributionsByRepository: [
            {
              repository: repository("upstream/alpha"),
              contributions: {
                pageInfo: { hasNextPage: false },
                nodes: [
                  { isRestricted: false, pullRequest: { mergedAt: "2026-08-01T00:00:00Z" } },
                  { isRestricted: false, pullRequest: { mergedAt: null } },
                  { isRestricted: true, pullRequest: { mergedAt: "2026-08-02T00:00:00Z" } },
                ],
              },
            },
            {
              repository: repository("another/beta", { primaryLanguage: null, repositoryTopics: { nodes: [] } }),
              contributions: {
                pageInfo: { hasNextPage: true },
                nodes: [{ isRestricted: false, pullRequest: { mergedAt: null } }],
              },
            },
          ],
        },
      },
    },
  };
}

function mockFetch(calls) {
  return async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json(payload());
  };
}

async function run(fetcher) {
  const calls = [];
  const result = await fetcher("example", "test-token", {
    fetchImpl: mockFetch(calls),
    maxRepositories: 500,
    nowMs: NOW,
  });
  return { result, calls };
}

test("external contribution window is a bounded 365-day UTC range", () => {
  assert.deepEqual(sourceWindow(NOW), staticWindow(NOW));
  assert.deepEqual(sourceWindow(NOW), {
    from: "2025-08-22T08:30:00.000Z",
    to: "2026-08-22T08:30:00.000Z",
  });
});

test("public external contribution fetch excludes own/private/restricted data and source/static stay identical", async () => {
  const source = await run(fetchSourceContributions);
  const statik = await run(fetchStaticContributions);
  assert.deepEqual(source.result, statik.result);
  assert.equal(source.calls.length, 1);
  assert.equal(source.calls[0].url, "https://api.github.com/graphql");
  const headers = new Headers(source.calls[0].init.headers);
  assert.equal(headers.get("Authorization"), "Bearer test-token");
  const body = JSON.parse(source.calls[0].init.body);
  assert.equal(body.variables.login, "example");
  assert.equal(body.variables.maxRepositories, 100);
  assert.equal(body.variables.from, "2025-08-22T08:30:00.000Z");
  assert.equal(body.variables.to, "2026-08-22T08:30:00.000Z");

  assert.deepEqual(source.result.repositories.map((item) => item.nameWithOwner), ["upstream/alpha", "another/beta"]);
  assert.deepEqual(source.result.repositories[0], {
    nameWithOwner: "upstream/alpha",
    owner: "upstream",
    name: "alpha",
    url: "https://github.com/upstream/alpha",
    description: "alpha project",
    language: "TypeScript",
    topics: ["robotics"],
    stars: 7,
    forks: 2,
    fork: false,
    archived: false,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2026-08-20T00:00:00Z",
    commits: 4,
    pullRequests: 2,
    mergedPullRequests: 1,
    commitsTruncated: false,
    pullRequestsTruncated: false,
  });
  assert.equal(source.result.repositories[1].pullRequests, 1);
  assert.equal(source.result.repositories[1].pullRequestsTruncated, true);
  assert.deepEqual(source.result.diagnostics, {
    maxRepositories: 100,
    returnedRepositories: 2,
    truncatedRepositories: 1,
  });
});

test("external contribution fetch fails closed without a token and on GraphQL errors", async () => {
  await assert.rejects(() => fetchStaticContributions("example", undefined), /token is required/);
  await assert.rejects(
    () => fetchStaticContributions("example", "token", {
      fetchImpl: async () => Response.json({ errors: [{ message: "denied" }] }, { status: 200 }),
      nowMs: NOW,
    }),
    /query failed/,
  );
});
