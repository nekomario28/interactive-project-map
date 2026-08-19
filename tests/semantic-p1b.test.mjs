import assert from "node:assert/strict";
import test from "node:test";
import { buildGraph as buildScriptGraph } from "../scripts/graph.mjs";
import {
  MANIFEST_FETCH_CONCURRENCY,
  MANIFEST_FILE_LIMIT,
  MANIFEST_PROBE_CONFIDENCE_THRESHOLD,
  MANIFEST_RAW_BYTE_LIMIT,
  enrichReposWithManifests as enrichScriptManifests,
  shouldProbeManifests as shouldScriptProbeManifests,
} from "../scripts/github.mjs";
import { classifyRepository as classifyScriptRepository } from "../scripts/semantic.mjs";
import { buildGraph as buildSourceGraph } from "../src/graph.ts";
import { classifyRepository as classifySourceRepository } from "../src/semantic.ts";
import { shouldProbeManifests as shouldSourceProbeManifests } from "../src/github.ts";

function repo(name, language = "TypeScript", overrides = {}) {
  return {
    id: Math.floor(Math.random() * 1_000_000),
    name,
    html_url: `https://github.com/example/${name}`,
    description: null,
    language,
    topics: [],
    stargazers_count: 0,
    forks_count: 0,
    fork: false,
    archived: false,
    updated_at: "2026-08-20T00:00:00Z",
    ...overrides,
  };
}

function repositoryNode(graph) {
  return graph.nodes.find((node) => node.type === "repository");
}

test("source and static deterministic classifiers stay in exact parity", () => {
  const fixtures = [
    repo("unknown-cpp", "C++"),
    repo("jp-robot", "Python", { description: "ROS2でロボット制御と自律走行を行う" }),
    repo("ros-package", "C++", { manifests: ["package.xml"], frameworks: ["rclpy"] }),
    repo("mixed", "TypeScript", { topics: ["react"], frameworks: ["torch"] }),
  ];

  for (const fixture of fixtures) {
    assert.deepEqual(classifySourceRepository(fixture), classifyScriptRepository(fixture), fixture.name);
  }
});

test("unknown project becomes Uncategorized instead of its implementation language", () => {
  for (const buildGraph of [buildScriptGraph, buildSourceGraph]) {
    const node = repositoryNode(buildGraph("example", [repo("opaque-project", "C++")], true, true));
    assert.equal(node?.groupId, "uncategorized");
    assert.equal(node?.groupLabel, "Uncategorized");
    assert.equal(node?.language, "C++");
    assert.equal(node?.classification?.categoryId, "uncategorized");
    assert.equal(node?.classification?.confidence, 0);
    assert.deepEqual(node?.classification?.evidence, []);
  }
});

test("Japanese and ASCII aliases contribute structured description evidence without language evidence", () => {
  const classification = classifyScriptRepository(repo("jp-robot", "Python", {
    description: "ROS2でロボット制御と自律走行を行う",
  }));

  assert.equal(classification.categoryId, "robotics");
  assert.ok(classification.confidence > 0.7);
  assert.ok(classification.evidence.some((item) => item.source === "description" && item.value === "ros2"));
  assert.ok(classification.evidence.some((item) => item.source === "description" && item.value === "ロボット"));
  assert.equal(classification.evidence.some((item) => item.value === "Python"), false);
});

test("manifest identity and dependency hints are high-weight deterministic evidence", () => {
  const classification = classifyScriptRepository(repo("ros-package", "C++", {
    manifests: ["package.xml"],
    frameworks: ["rclpy"],
  }));

  assert.equal(classification.categoryId, "robotics");
  assert.ok(classification.confidence >= 0.9);
  assert.ok(classification.evidence.some((item) => item.source === "manifest" && item.value === "package.xml" && item.weight === 0.9));
  assert.ok(classification.evidence.some((item) => item.source === "dependency" && item.value === "rclpy" && item.weight === 0.9));
  assert.ok(classification.secondaryTags.includes("rclpy"));
});

test("ambiguous evidence preserves the losing category and lowers confidence", () => {
  const ambiguous = classifyScriptRepository(repo("mixed", "TypeScript", {
    topics: ["react"],
    frameworks: ["torch"],
  }));
  const clear = classifyScriptRepository(repo("clear-web", "TypeScript", {
    topics: ["react"],
    description: "web frontend react application",
  }));

  assert.equal(ambiguous.categoryId, "web-apps");
  assert.ok(ambiguous.evidence.some((item) => item.categoryId === "ai-ml" && item.source === "dependency"));
  assert.ok(ambiguous.confidence < clear.confidence);
  assert.ok(ambiguous.confidence < 0.6);
});

test("graph emits classificationVersion and compatibility group fields while preserving language", () => {
  for (const buildGraph of [buildScriptGraph, buildSourceGraph]) {
    const graph = buildGraph("example", [repo("robot", "Python", { topics: ["robotics"] })], true, true);
    const node = repositoryNode(graph);
    assert.equal(graph.classificationVersion, 1);
    assert.equal(node?.groupId, node?.classification?.categoryId);
    assert.equal(node?.groupLabel, node?.classification?.categoryLabel);
    assert.equal(node?.language, "Python");
  }
});

test("bounded manifest enrichment probes only root candidates and reads at most the file cap", async () => {
  const calls = [];
  let active = 0;
  let maxActive = 0;
  const fetchImpl = async (url, init) => {
    const target = String(url);
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 3));
    active -= 1;
    calls.push({ target, headers: new Headers(init?.headers) });
    if (target.endsWith("/contents")) {
      return Response.json([
        { type: "file", path: "README.md" },
        { type: "file", path: "requirements.txt" },
        { type: "file", path: "package.json" },
        { type: "file", path: "package.xml" },
        { type: "file", path: "pyproject.toml" },
        { type: "dir", path: "nested" },
      ]);
    }
    if (target.endsWith("/contents/package.xml")) return new Response("<package><depend>rclpy</depend></package>");
    if (target.endsWith("/contents/package.json")) return new Response('{"dependencies":{"react":"latest"}}');
    throw new Error(`unexpected raw manifest: ${target}`);
  };

  const [enriched] = await enrichScriptManifests("example", [repo("bounded")], "token-456", {
    fetchImpl,
    fileLimit: 2,
    rawByteLimit: 128,
    concurrency: 1,
  });

  assert.equal(calls.length, 3);
  assert.ok(maxActive <= 1);
  assert.deepEqual(enriched.manifests, ["package.xml", "package.json", "pyproject.toml", "requirements.txt"]);
  assert.deepEqual(enriched.frameworks, ["rclpy", "react"]);
  assert.equal(calls[0].headers.get("Accept"), "application/vnd.github+json");
  assert.equal(calls[0].headers.get("Authorization"), "Bearer token-456");
  assert.equal(calls[1].headers.get("Accept"), "application/vnd.github.raw+json");
  assert.equal(classifyScriptRepository(enriched).categoryId, "robotics");
});

test("manifest enrichment stops issuing new requests after upstream rate limiting", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response("rate limited", { status: 429 });
  };
  const repos = Array.from({ length: 5 }, (_, index) => repo(`rate-${index}`));
  const enriched = await enrichScriptManifests("example", repos, undefined, { fetchImpl, concurrency: 1 });
  assert.equal(calls, 1);
  assert.ok(enriched.every((item) => item.manifests === undefined && item.frameworks === undefined));
});

test("manifest probing is adaptive and skips already high-confidence deterministic classifications", () => {
  const unknown = repo("opaque");
  const strong = repo("strong-robot", "Python", {
    topics: ["robotics"],
    description: "ROS2 Gazebo robot navigation with Nav2 and MoveIt2",
  });
  assert.equal(shouldScriptProbeManifests(unknown), true);
  assert.equal(shouldSourceProbeManifests(unknown), true);
  assert.equal(shouldScriptProbeManifests(strong), false);
  assert.equal(shouldSourceProbeManifests(strong), false);
  assert.equal(MANIFEST_PROBE_CONFIDENCE_THRESHOLD, 0.8);
});

test("P1B manifest defaults stay explicitly bounded", () => {
  assert.equal(MANIFEST_RAW_BYTE_LIMIT, 16 * 1024);
  assert.equal(MANIFEST_FILE_LIMIT, 3);
  assert.equal(MANIFEST_FETCH_CONCURRENCY, 4);
});
