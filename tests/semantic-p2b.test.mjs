import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateStaticMap } from "../scripts/action.mjs";
import { buildRepoSemanticDocument as buildScriptDocument } from "../scripts/semantic-document.mjs";
import {
  DEFAULT_SEMANTIC_MIN_SIMILARITY,
  DEFAULT_SEMANTIC_TOP_K,
  MAX_SEMANTIC_EDGES,
  buildSparseSemanticEdges as buildScriptEdges,
  generateSemanticEdges as generateScriptEdges,
} from "../scripts/semantic-edges.mjs";
import { buildRepoSemanticDocument as buildSourceDocument } from "../src/semantic-document.ts";
import {
  buildSparseSemanticEdges as buildSourceEdges,
  generateSemanticEdges as generateSourceEdges,
} from "../src/semantic-edges.ts";
import { buildGraph } from "../src/graph.ts";
import { sanitizeStaticGraph } from "../src/static-graph.ts";

function repo(id, name, overrides = {}) {
  return {
    id,
    name,
    html_url: `https://github.com/example/${name}`,
    description: null,
    language: "Python",
    topics: [],
    stargazers_count: 0,
    forks_count: 0,
    fork: false,
    archived: false,
    updated_at: "2026-08-20T00:00:00Z",
    ...overrides,
  };
}

function document(id, name) {
  return buildScriptDocument(repo(id, name));
}

function semanticProvider() {
  const state = { calls: 0 };
  return {
    id: "fixture-provider",
    model: "fixture-model-v1",
    state,
    async embed(texts) {
      state.calls += 1;
      return texts.map((text) => {
        if (text.includes("name: robot-alpha")) return [1, 0, 0];
        if (text.includes("name: robot-beta")) return [0.99, 0.1, 0];
        if (text.includes("name: web-gamma")) return [0, 1, 0];
        return [0, 0, 1];
      });
    },
  };
}

const smallDocuments = [
  document(1, "alpha"),
  document(2, "beta"),
  document(3, "charlie"),
  document(4, "delta"),
  document(5, "echo"),
];
const smallVectors = [
  [1, 0, 0],
  [0.99, 0.1, 0],
  [0, 1, 0],
  [0, 0.99, 0.1],
  [0, 0, 1],
];

test("sparse semantic edges retain top-k neighbors, threshold, symmetrize and deduplicate deterministically", () => {
  const script = buildScriptEdges(smallDocuments, smallVectors, { topK: 1, minSimilarity: 0.9 });
  const source = buildSourceEdges(smallDocuments.map((item, index) => buildSourceDocument(repo(index + 1, item.name))), smallVectors, { topK: 1, minSimilarity: 0.9 });
  assert.deepEqual(source, script);
  assert.deepEqual(script.edges, [
    { source: "repository:alpha", target: "repository:beta", type: "semantic", score: 0.994937 },
    { source: "repository:charlie", target: "repository:delta", type: "semantic", score: 0.994937 },
  ]);
  assert.equal(script.diagnostics.topK, 1);
  assert.equal(script.diagnostics.comparisons, 10);
  assert.ok(script.diagnostics.retainedCandidates <= smallDocuments.length);
  assert.equal(new Set(script.edges.map((edge) => `${edge.source}\u0000${edge.target}`)).size, script.edges.length);

  const strict = buildScriptEdges(smallDocuments, smallVectors, { topK: 1, minSimilarity: 0.9999 });
  assert.deepEqual(strict.edges, []);
});

test("semantic edge output is capped independently of pairwise comparison count", () => {
  const documents = Array.from({ length: 12 }, (_, index) => document(index + 1, `same-${index}`));
  const vectors = documents.map(() => [1, 0]);
  const limited = buildScriptEdges(documents, vectors, { topK: 4, minSimilarity: 0.5, maxEdges: 5 });
  assert.equal(limited.edges.length, 5);
  assert.equal(limited.diagnostics.maxEdges, 5);
  assert.equal(limited.diagnostics.comparisons, 66);
  assert.ok(limited.diagnostics.retainedCandidates <= 12 * 4);
});

test("300-repository semantic graph keeps retained/output state O(n*k)", () => {
  const count = 300;
  const topK = 4;
  const documents = Array.from({ length: count }, (_, index) => document(index + 1, `repo-${String(index).padStart(3, "0")}`));
  const vectors = Array.from({ length: count }, (_, index) => {
    const vector = Array(10).fill(0);
    vector[index % 10] = 1;
    return vector;
  });
  const result = buildScriptEdges(documents, vectors, { topK, minSimilarity: 0.9 });
  assert.equal(result.diagnostics.comparisons, count * (count - 1) / 2);
  assert.ok(result.diagnostics.retainedCandidates <= count * topK);
  assert.ok(result.edges.length > 0);
  assert.ok(result.edges.length <= Math.min(count * topK, MAX_SEMANTIC_EDGES));
  assert.equal(result.diagnostics.maxEdges, Math.min(count * topK, MAX_SEMANTIC_EDGES));
});

test("semantic edge defaults are explicit and bounded", () => {
  assert.equal(DEFAULT_SEMANTIC_TOP_K, 3);
  assert.equal(DEFAULT_SEMANTIC_MIN_SIMILARITY, 0.72);
  assert.equal(MAX_SEMANTIC_EDGES, 1200);
});

test("disabled provider produces no semantic edges and no error", async () => {
  const repos = [repo(1, "robot-alpha"), repo(2, "robot-beta")];
  for (const generate of [generateScriptEdges, generateSourceEdges]) {
    const result = await generate(repos);
    assert.deepEqual(result.edges, []);
    assert.equal(result.embedding.disabled, true);
    assert.equal(result.diagnostics.comparisons, 0);
    assert.equal(result.error, undefined);
  }
});

test("fake provider produces bounded semantic edges while provider failure degrades to deterministic-only graph", async () => {
  const repos = [
    repo(1, "robot-alpha", { description: "ROS2 robot" }),
    repo(2, "robot-beta", { description: "Gazebo robot" }),
    repo(3, "web-gamma", { description: "frontend app" }),
  ];
  const provider = semanticProvider();
  const result = await generateScriptEdges(repos, provider, undefined, { topK: 2, minSimilarity: 0.8 });
  assert.equal(provider.state.calls, 1);
  assert.deepEqual(result.edges, [
    { source: "repository:robot-alpha", target: "repository:robot-beta", type: "semantic", score: 0.994937 },
  ]);
  assert.equal(result.error, undefined);

  const failed = await generateScriptEdges(repos, {
    id: "failing-provider",
    model: "failing-model",
    async embed() { throw new Error("provider unavailable"); },
  });
  assert.deepEqual(failed.edges, []);
  assert.match(failed.error ?? "", /provider unavailable/);
  assert.equal(failed.diagnostics.emittedEdges, 0);
});

test("static map generation emits semanticEdges separately from ownership/membership only when a provider is enabled", async () => {
  const repos = [
    repo(1, "robot-alpha", { description: "ROS2 robot project" }),
    repo(2, "robot-beta", { description: "Gazebo robot project" }),
    repo(3, "web-gamma", { description: "frontend web project" }),
  ];
  const config = {
    username: "example",
    theme: "dark",
    style: "galaxy-systems",
    maxRepos: 10,
    includeForks: true,
    includeArchived: true,
    width: 740,
    height: 420,
    outputDir: "project-map",
  };

  const enabledDir = await mkdtemp(join(tmpdir(), "project-map-p2-enabled-"));
  const disabledDir = await mkdtemp(join(tmpdir(), "project-map-p2-disabled-"));
  try {
    const provider = semanticProvider();
    const enabled = await generateStaticMap(config, {
      cwd: enabledDir,
      fetchRepos: async () => repos,
      embeddingProvider: provider,
      semanticOptions: { topK: 2, minSimilarity: 0.8 },
    });
    assert.equal(enabled.graph.semanticEdges?.length, 1);
    assert.ok(enabled.graph.edges.every((edge) => edge.type === "ownership" || edge.type === "membership"));
    assert.equal(enabled.semantic.embedding.disabled, false);
    const persisted = JSON.parse(await readFile(join(enabledDir, "project-map", "graph.json"), "utf8"));
    assert.deepEqual(persisted.semanticEdges, enabled.graph.semanticEdges);
    assert.ok(persisted.edges.every((edge) => edge.type === "ownership" || edge.type === "membership"));

    const disabled = await generateStaticMap(config, {
      cwd: disabledDir,
      fetchRepos: async () => repos,
    });
    assert.equal(disabled.graph.semanticEdges, undefined);
    assert.equal(disabled.semantic.embedding.disabled, true);
  } finally {
    await rm(enabledDir, { recursive: true, force: true });
    await rm(disabledDir, { recursive: true, force: true });
  }
});

test("static graph sanitizer preserves only valid repository-to-repository semantic edges", () => {
  const repos = [
    repo(1, "alpha", { description: "web app", topics: ["web"] }),
    repo(2, "beta", { description: "web app", topics: ["web"] }),
    repo(3, "gamma", { description: "robot", topics: ["robotics"] }),
  ].map((item) => ({ ...item, html_url: item.html_url.replace("/example/", "/octocat/") }));
  const input = buildGraph("octocat", repos, true, true);
  input.semanticEdges = [
    { source: "repository:alpha", target: "repository:beta", type: "semantic", score: 0.91 },
    { source: "repository:beta", target: "repository:alpha", type: "semantic", score: 0.93 },
    { source: "repository:alpha", target: "group:web-apps", type: "semantic", score: 1 },
    { source: "repository:alpha", target: "repository:missing", type: "semantic", score: 0.99 },
    { source: "repository:alpha", target: "repository:gamma", type: "semantic", score: 2 },
  ];
  const graph = sanitizeStaticGraph(input, "octocat");
  assert.ok(graph);
  assert.deepEqual(graph.semanticEdges, [
    { source: "repository:alpha", target: "repository:beta", type: "semantic", score: 0.93 },
  ]);
});
