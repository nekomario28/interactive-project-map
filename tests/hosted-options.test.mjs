import assert from "node:assert/strict";
import test from "node:test";
import { graphCacheRequest, normalizeUsername } from "../src/hosted-options.ts";

test("normalizeUsername canonicalizes GitHub usernames for shared caching", () => {
  assert.equal(normalizeUsername("  Octo-Cat  "), "octo-cat");
});

test("normalizeUsername rejects malformed usernames", () => {
  assert.throws(() => normalizeUsername("-bad"), /Invalid GitHub username/);
  assert.throws(() => normalizeUsername("bad-"), /Invalid GitHub username/);
  assert.throws(() => normalizeUsername("bad/name"), /Invalid GitHub username/);
});

test("graph cache keys are canonical and contain only graph-affecting options", () => {
  const options = {
    username: "Octo-Cat",
    maxRepos: 100,
    includeForks: true,
    includeArchived: false,
  };
  const dynamic = graphCacheRequest("https://maps.example", options);
  const profile = graphCacheRequest("https://maps.example", options, "profile");

  assert.equal(
    dynamic.url,
    "https://maps.example/__cache/graph?source=dynamic&username=octo-cat&max_repos=100&forks=true&archived=false",
  );
  assert.equal(
    profile.url,
    "https://maps.example/__cache/graph?source=profile&username=octo-cat&max_repos=100&forks=true&archived=false",
  );
  assert.notEqual(dynamic.url, profile.url);
  assert.equal(dynamic.method, "GET");
  assert.equal(new URL(dynamic.url).searchParams.has("theme"), false);
  assert.equal(new URL(dynamic.url).searchParams.has("width"), false);
  assert.equal(new URL(dynamic.url).searchParams.has("height"), false);
});
