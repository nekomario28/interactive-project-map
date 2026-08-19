import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGraph as buildScriptGraph,
  normalizeSearch as normalizeScriptSearch,
} from "../scripts/graph.mjs";
import {
  README_FETCH_CONCURRENCY,
  README_RAW_BYTE_LIMIT,
  README_TEXT_CHAR_LIMIT,
  cleanReadmeExcerpt as cleanScriptReadme,
  enrichReposWithReadmes as enrichScriptRepos,
} from "../scripts/github.mjs";
import {
  buildGraph as buildSourceGraph,
  normalizeSearch as normalizeSourceSearch,
} from "../src/graph.ts";
import {
  cleanReadmeExcerpt as cleanSourceReadme,
} from "../src/github.ts";
import {
  semanticP1AFixtures,
  unicodeNormalizationFixture,
} from "./fixtures/semantic-p1a-fixtures.mjs";

function repositoryNode(graph) {
  return graph.nodes.find((node) => node.type === "repository");
}

function codePointLength(value) {
  return Array.from(value).length;
}

test("Unicode-safe normalization preserves Japanese and technology tokens in source and static paths", () => {
  const { input, expected } = unicodeNormalizationFixture;
  assert.equal(normalizeScriptSearch(input), expected);
  assert.equal(normalizeSourceSearch(input), expected);
  assert.match(normalizeScriptSearch("日本語の説明：ロボット制御"), /日本語の説明 ロボット制御/);
});

test("README regression fixtures recover documented domains while language remains a separate facet", () => {
  for (const fixture of semanticP1AFixtures) {
    for (const [name, buildGraph] of [["scripts", buildScriptGraph], ["src", buildSourceGraph]]) {
      const readmeExcerpt = cleanScriptReadme(fixture.readme);
      const node = repositoryNode(buildGraph("fixture-user", [{ ...fixture.repo, readmeExcerpt }], true, true));
      assert.equal(node?.groupId, fixture.afterGroupId, `${name}/${fixture.id}: README evidence should recover the documented domain`);
      assert.equal(node?.language, fixture.repo.language, `${name}/${fixture.id}: language remains a separate technical facet`);
      assert.equal(Object.hasOwn(node ?? {}, "readmeExcerpt"), false, `${name}/${fixture.id}: raw README text must remain generation-only`);
      assert.ok(node?.classification?.evidence.some((item) => item.source === "readme"), `${name}/${fixture.id}: README evidence should be inspectable`);
    }
  }
});

test("README cleaning removes generated noise, preserves Unicode evidence, and obeys the character cap", () => {
  const raw = `# 日本語 Robotics Tool\n\n[![build](https://img.shields.io/badge/build-passing-green)](https://example.invalid)\n<!-- generated comment -->\nUse [Nav2](https://docs.nav2.org/) with ROS2 and Raspberry Pi.\n\n\`\`\`sh\necho generated-code-noise\n\`\`\`\n\n${"🙂センサー".repeat(200)}`;
  const scriptClean = cleanScriptReadme(raw, 96);
  const sourceClean = cleanSourceReadme(raw, 96);

  assert.equal(scriptClean, sourceClean);
  assert.match(scriptClean, /日本語 Robotics Tool/);
  assert.match(scriptClean, /Nav2/);
  assert.doesNotMatch(scriptClean, /img\.shields|https?:\/\/|generated-code-noise|generated comment/);
  assert.ok(codePointLength(scriptClean) <= 96);
});

test("bounded README enrichment uses canonical endpoints, bounded concurrency, byte/character caps, and tolerates missing README", async () => {
  const repos = [
    { ...semanticP1AFixtures[0].repo, name: "good-one" },
    { ...semanticP1AFixtures[1].repo, name: "good-two" },
    { ...semanticP1AFixtures[2].repo, name: "missing" },
  ];
  const calls = [];
  let active = 0;
  let maxActive = 0;
  const fetchImpl = async (url, init) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 4));
    active -= 1;
    calls.push({ url: String(url), headers: new Headers(init?.headers) });
    if (String(url).endsWith("/missing/readme")) return new Response("", { status: 404 });
    return new Response(`# README\n\nGazebo 日本語 ${"🙂".repeat(200)}`);
  };

  const enriched = await enrichScriptRepos("fixture-user", repos, "token-123", {
    fetchImpl,
    rawByteLimit: 67,
    textCharLimit: 24,
    concurrency: 2,
  });

  assert.equal(calls.length, 3);
  assert.ok(maxActive <= 2);
  assert.match(calls[0].url, /^https:\/\/api\.github\.com\/repos\/fixture-user\/[^/]+\/readme$/);
  assert.equal(calls[0].headers.get("Accept"), "application/vnd.github.raw+json");
  assert.equal(calls[0].headers.get("Authorization"), "Bearer token-123");
  assert.ok(enriched[0].readmeExcerpt);
  assert.ok(enriched[1].readmeExcerpt);
  assert.equal(enriched[2].readmeExcerpt, undefined);
  for (const repo of enriched.slice(0, 2)) {
    assert.ok(codePointLength(repo.readmeExcerpt) <= 24);
    assert.doesNotMatch(repo.readmeExcerpt, /\uFFFD/);
  }
});

test("README enrichment stops issuing new requests after upstream rate limiting", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response("rate limited", { status: 429 });
  };
  const repos = Array.from({ length: 6 }, (_, index) => ({
    ...semanticP1AFixtures[1].repo,
    id: 100 + index,
    name: `rate-${index}`,
  }));

  const enriched = await enrichScriptRepos("fixture-user", repos, undefined, { fetchImpl, concurrency: 1 });
  assert.equal(calls, 1);
  assert.ok(enriched.every((repo) => repo.readmeExcerpt === undefined));
});

test("P1A README defaults stay explicitly bounded", () => {
  assert.equal(README_RAW_BYTE_LIMIT, 32 * 1024);
  assert.equal(README_TEXT_CHAR_LIMIT, 12 * 1024);
  assert.equal(README_FETCH_CONCURRENCY, 4);
});
