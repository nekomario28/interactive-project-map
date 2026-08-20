import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRepoSemanticDocument as buildScriptDocument,
  canonicalSemanticDocument as canonicalScriptDocument,
  semanticDocumentText as scriptDocumentText,
} from "../scripts/semantic-document.mjs";
import {
  DISABLED_EMBEDDING_PROVIDER as SCRIPT_DISABLED,
  MemoryEmbeddingCache as ScriptMemoryCache,
  embedSemanticDocuments as embedScriptDocuments,
  embeddingCacheKey as scriptCacheKey,
  semanticDocumentContentHash as scriptContentHash,
} from "../scripts/embedding.mjs";
import {
  buildRepoSemanticDocument as buildSourceDocument,
  canonicalSemanticDocument as canonicalSourceDocument,
  semanticDocumentText as sourceDocumentText,
} from "../src/semantic-document.ts";
import {
  DISABLED_EMBEDDING_PROVIDER as SOURCE_DISABLED,
  MemoryEmbeddingCache as SourceMemoryCache,
  embedSemanticDocuments as embedSourceDocuments,
  embeddingCacheKey as sourceCacheKey,
  semanticDocumentContentHash as sourceContentHash,
} from "../src/embedding.ts";

function repo(overrides = {}) {
  return {
    id: 42,
    name: "lime_tidyup",
    html_url: "https://github.com/example/lime_tidyup",
    description: "  日本語のロボット制御  \n  ROS2 navigation  ",
    language: "Python",
    topics: ["robotics", "ROS2", "robotics"],
    stargazers_count: 0,
    forks_count: 0,
    fork: false,
    archived: false,
    updated_at: "2026-08-20T00:00:00Z",
    readmeExcerpt: "# Lime\n\nGazebo と Nav2 を使う。",
    manifests: ["package.xml", "package.xml"],
    frameworks: ["nav2", "rclpy", "nav2"],
    ...overrides,
  };
}

function deterministicProvider(id = "fake", model = "fixture-v1") {
  const state = { calls: [] };
  return {
    id,
    model,
    state,
    async embed(texts) {
      state.calls.push([...texts]);
      return texts.map((text) => [
        text.length / 1000,
        (text.match(/robot/giu) ?? []).length,
        (text.match(/minecraft/giu) ?? []).length,
        (text.match(/ros2/giu) ?? []).length,
      ]);
    },
  };
}

test("RepoSemanticDocument is bounded, Unicode-safe, stable, and source/static implementations match", async () => {
  const script = buildScriptDocument(repo());
  const source = buildSourceDocument(repo());
  assert.deepEqual(source, script);
  assert.deepEqual(script.topics, ["robotics", "ROS2"]);
  assert.deepEqual(script.frameworks, ["nav2", "rclpy"]);
  assert.deepEqual(script.manifests, ["package.xml"]);
  assert.match(script.description, /日本語のロボット制御 ROS2 navigation/);
  assert.match(script.readmeExcerpt, /Gazebo と Nav2/);
  assert.equal(canonicalScriptDocument(script), canonicalSourceDocument(source));
  assert.equal(scriptDocumentText(script), sourceDocumentText(source));
  assert.match(scriptDocumentText(script), /^name: lime_tidyup/m);
  assert.match(scriptDocumentText(script), /^frameworks: nav2, rclpy/m);
  assert.equal(await scriptContentHash(script), await sourceContentHash(source));
});

test("semantic content hash ignores cosmetic whitespace/list ordering but changes for meaningful content", async () => {
  const first = buildScriptDocument(repo());
  const equivalent = buildScriptDocument(repo({
    description: "日本語のロボット制御 ROS2 navigation",
    topics: ["ROS2", "robotics"],
    frameworks: ["rclpy", "nav2"],
  }));
  const changed = buildScriptDocument(repo({ readmeExcerpt: "Gazebo と Nav2 と MoveIt2 を使う。" }));
  assert.equal(await scriptContentHash(first), await scriptContentHash(equivalent));
  assert.notEqual(await scriptContentHash(first), await scriptContentHash(changed));
});

test("embedding cache identity includes provider id/model and normalized semantic document content", async () => {
  const document = buildScriptDocument(repo());
  const providerA = deterministicProvider("provider-a", "model-1");
  const providerB = deterministicProvider("provider-b", "model-1");
  const providerC = deterministicProvider("provider-a", "model-2");
  const keyA = await scriptCacheKey(document, providerA);
  assert.match(keyA, /^embedding:semantic-v1:provider-a:model-1:[0-9a-f]{64}$/);
  assert.notEqual(keyA, await scriptCacheKey(document, providerB));
  assert.notEqual(keyA, await scriptCacheKey(document, providerC));
  assert.equal(keyA, await sourceCacheKey(buildSourceDocument(repo()), providerA));
});

test("explicit disabled embedding path performs no provider/cache work", async () => {
  const documents = [buildScriptDocument(repo())];
  const script = await embedScriptDocuments(documents, SCRIPT_DISABLED, new ScriptMemoryCache());
  const source = await embedSourceDocuments(documents, SOURCE_DISABLED, new SourceMemoryCache());
  for (const result of [script, source]) {
    assert.deepEqual(result.vectors, []);
    assert.deepEqual(result.cacheKeys, []);
    assert.equal(result.diagnostics.disabled, true);
    assert.equal(result.diagnostics.documents, 1);
    assert.equal(result.diagnostics.embedded, 0);
  }
});

test("embedding provider is batched, cached by content identity, and unchanged repos are not re-embedded", async () => {
  const documents = [
    buildScriptDocument(repo({ id: 1, name: "robot-one" })),
    buildScriptDocument(repo({ id: 2, name: "robot-two" })),
    buildScriptDocument(repo({ id: 3, name: "robot-three" })),
  ];
  const provider = deterministicProvider();
  const cache = new ScriptMemoryCache();
  const first = await embedScriptDocuments(documents, provider, cache, { batchSize: 2 });
  assert.equal(provider.state.calls.length, 2);
  assert.equal(first.diagnostics.embedded, 3);
  assert.equal(first.diagnostics.cacheHits, 0);
  assert.equal(first.diagnostics.dimension, 4);
  assert.equal(cache.size, 3);

  const second = await embedScriptDocuments(documents, provider, cache, { batchSize: 2 });
  assert.equal(provider.state.calls.length, 2, "cache hits must avoid additional provider calls");
  assert.equal(second.diagnostics.embedded, 0);
  assert.equal(second.diagnostics.cacheHits, 3);
  assert.deepEqual(second.vectors, first.vectors);
});

test("invalid cached vectors degrade to provider misses instead of poisoning a run", async () => {
  const document = buildScriptDocument(repo());
  const provider = deterministicProvider();
  const key = await scriptCacheKey(document, provider);
  const cache = {
    async get(requested) {
      assert.equal(requested, key);
      return [1, Number.NaN];
    },
    async set() {},
  };
  const result = await embedScriptDocuments([document], provider, cache);
  assert.equal(result.diagnostics.cacheHits, 0);
  assert.equal(result.diagnostics.embedded, 1);
  assert.equal(provider.state.calls.length, 1);
});

test("provider output cardinality and vector dimensions are strictly validated", async () => {
  const documents = [
    buildScriptDocument(repo({ id: 1, name: "one" })),
    buildScriptDocument(repo({ id: 2, name: "two" })),
  ];
  await assert.rejects(
    embedScriptDocuments(documents, { id: "bad", model: "count", async embed() { return [[1, 2]]; } }),
    /returned 1 vectors for 2 documents/,
  );
  await assert.rejects(
    embedScriptDocuments(documents, { id: "bad", model: "dims", async embed() { return [[1, 2], [1, 2, 3]]; } }),
    /inconsistent vector dimensions/,
  );
  await assert.rejects(
    embedScriptDocuments([documents[0]], { id: "bad", model: "nan", async embed() { return [[1, Number.NaN]]; } }),
    /invalid vector/,
  );
});
