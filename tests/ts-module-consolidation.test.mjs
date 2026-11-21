import assert from "node:assert/strict";
import test from "node:test";
import { buildGraph } from "../src/graph.ts";
import { fetchPublicFollowerCount, fetchPublicRepos, enrichReposWithReadmes } from "../src/github.ts";
import { classifyRepository } from "../src/semantic.ts";
import { buildRepoSemanticDocument, buildRepoSemanticDocuments, canonicalSemanticDocument } from "../src/semantic-document.ts";
import { MemoryEmbeddingCache } from "../src/embedding.ts";
import { buildSparseSemanticEdges } from "../src/semantic-edges.ts";
import { attachContributedRepositories, contributedRepositoryId } from "../src/contributed-graph.ts";
import { promoteStandardHierarchy, usesStandardTaxonomy } from "../src/standard-hierarchy.ts";

test("shared graph and semantic entrypoints retain JavaScript input guards and creation dates", () => {
  const repo = { name: "project", stargazers_count: 0, updated_at: "2026-08-18T00:00:00Z", created_at: "2025-01-01T00:00:00Z" };
  assert.equal(buildGraph("example", [repo], true, true).nodes.at(-1).createdAt, repo.created_at);
  assert.equal(buildGraph("example", [{ ...repo, created_at: undefined }], true, true).nodes.at(-1).createdAt, repo.updated_at);
  assert.equal(buildGraph("example", [], true, true).repositoryCount, 0);
  assert.equal(classifyRepository(null).categoryId, "uncategorized");
  assert.equal(classifyRepository({ classification: "invalid" }).categoryId, "uncategorized");
  const cached = { categoryId: "cached" };
  assert.equal(classifyRepository({ classification: cached }), cached);
  assert.equal(buildRepoSemanticDocument(null).name, "");
  assert.deepEqual(buildRepoSemanticDocuments(null), []);
  assert.equal(JSON.parse(canonicalSemanticDocument(null)).repoId, 0);
  assert.equal(usesStandardTaxonomy(null), false);
  assert.equal(promoteStandardHierarchy(null), null);
});

test("embedding cache keeps private storage and defensive copies", async () => {
  const cache = new MemoryEmbeddingCache();
  assert.equal(await cache.get("missing"), null);
  const vector = [1, 2];
  await cache.set("key", vector);
  vector[0] = 99;
  const cached = await cache.get("key");
  cached[1] = 99;
  assert.deepEqual(await cache.get("key"), [1, 2]);
  assert.equal(cache.size, 1);
  assert.deepEqual(Object.keys(cache), []);
});

test("sparse semantic edges reject non-array vectors with the explicit validation error", () => {
  const documents = [{ name: "one" }, { name: "two" }];
  assert.throws(() => buildSparseSemanticEdges(documents, [null, [1]]), /Semantic vectors must have one consistent non-zero dimension/);
  assert.deepEqual(buildSparseSemanticEdges([], []).edges, []);
});

test("Contributed attachment retains malformed-record guards and metadata filtering", () => {
  const graph = buildGraph("example", [], true, true);
  const window = { from: "2025-08-22T00:00:00Z", to: "2026-08-22T00:00:00Z" };
  assert.throws(() => attachContributedRepositories(null, [], window), /requires an owner/);
  assert.throws(() => attachContributedRepositories(graph, [], null), /Invalid Contributed contribution window/);
  assert.equal(attachContributedRepositories(graph, null, window).contributedRepositoryCount, 0);
  const records = [null, {}, { owner: 42 }, {
    nameWithOwner: "Other/Core", owner: "Other", name: "Core", url: "https://github.com/Other/Core",
    description: 42, language: false, topics: [1, "robotics"], commits: 1, pullRequests: 0, mergedPullRequests: 9,
  }];
  const node = attachContributedRepositories(graph, records, window).nodes.at(-1);
  assert.equal(node.id, contributedRepositoryId("Other/Core"));
  assert.equal(node.description, "");
  assert.equal(node.language, null);
  assert.deepEqual(node.topics, ["robotics"]);
  assert.equal(node.contribution.mergedPullRequests, 0);
});

test("GitHub token and Worker adapters retain caller-specific headers and errors", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url, headers: new Headers(init.headers) });
    return Response.json([]);
  });
  for (const auth of ["fixture-token", { GITHUB_TOKEN: "fixture-token" }]) {
    assert.deepEqual(await fetchPublicRepos("example", auth, 10), []);
    await enrichReposWithReadmes("example", [{ name: "project" }], auth);
  }
  assert.deepEqual(calls.map(({ headers }) => headers.get("User-Agent")), [
    "interactive-project-map-pages", "interactive-project-map-pages", "github-project-galaxy-api", "github-project-galaxy-api",
  ]);
  assert.ok(calls.every(({ headers }) => headers.get("Authorization") === "Bearer fixture-token"));
  globalThis.fetch = async () => new Response("", { status: 404 });
  await assert.rejects(fetchPublicRepos("example", "token", 10), { message: "GitHub user not found: example" });
  await assert.rejects(fetchPublicRepos("example", {}, 10), { message: "GitHub user not found" });
  globalThis.fetch = async () => new Response("", { status: 429 });
  await assert.rejects(fetchPublicRepos("example", "token", 10), /Configure PROJECT_MAP_GITHUB_TOKEN if needed\./);
  await assert.rejects(fetchPublicRepos("example", {}, 10), /Configure GITHUB_TOKEN for production\./);
});

test("follower count accepts only matching public profiles and fails closed", async () => {
  const count = (profile) => fetchPublicFollowerCount("example", undefined, { fetchImpl: async () => Response.json(profile) });
  assert.equal(await count({ login: "Example", followers: 7 }), 7);
  assert.equal(await count({ login: "example", followers: 0 }), 0);
  for (const profile of [{}, { login: "other", followers: 7 }, { login: "example", followers: -1 }, { login: "example", followers: "7" }]) {
    assert.equal(await count(profile), null);
  }
  assert.equal(await fetchPublicFollowerCount("example", undefined, { fetchImpl: async () => { throw new Error("offline"); } }), null);
  assert.equal(await fetchPublicFollowerCount("example", undefined, { fetchImpl: async () => new Response("", { status: 404 }) }), null);
});
