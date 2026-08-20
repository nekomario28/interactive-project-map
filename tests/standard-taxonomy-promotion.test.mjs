import assert from "node:assert/strict";
import test from "node:test";
import { promoteStandardHierarchy as promoteScript } from "../scripts/standard-hierarchy.mjs";
import { promoteStandardHierarchy as promoteSource } from "../src/standard-hierarchy.ts";
import { sanitizeStaticGraph } from "../src/static-graph.ts";
import { STANDARD_TAXONOMY_ID } from "../scripts/standard-taxonomy.mjs";

const categories = [
  { id: "robotics-automation", label: "Robotics & Automation", description: "Robotics, autonomous systems, robot control, and physical automation projects.", aliases: ["robotics"] },
  { id: "visualization-knowledge", label: "Visualization & Knowledge", description: "Information visualization, knowledge organization, project maps, and exploratory graph interfaces.", aliases: ["project visualization"] },
];

function assignment(categoryId, categoryLabel) {
  return { categoryId, categoryLabel, secondaryTags: [], confidence: 0.95, method: "deterministic", evidence: [] };
}

function baseGraph() {
  return {
    owner: "example",
    generatedAt: "2026-08-20T00:00:00Z",
    repositoryCount: 3,
    groupCount: 2,
    nodes: [
      { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
      { id: "group:legacy-a", label: "Python", type: "group", repositoryCount: 2 },
      { id: "group:legacy-b", label: "JavaScript", type: "group", repositoryCount: 1 },
      {
        id: "repository:robot", label: "robot", type: "repository", url: "https://github.com/example/robot", description: "robot", language: "Python", topics: [], stars: 2, forks: 0, fork: false, archived: false, updatedAt: "2026-08-20T00:00:00Z", groupId: "legacy-a", groupLabel: "Python",
        taxonomyAssignment: assignment("robotics-automation", "Robotics & Automation"),
      },
      {
        id: "repository:atlas", label: "atlas", type: "repository", url: "https://github.com/example/atlas", description: "visualization", language: "JavaScript", topics: [], stars: 3, forks: 0, fork: false, archived: false, updatedAt: "2026-08-20T00:00:00Z", groupId: "legacy-b", groupLabel: "JavaScript",
        taxonomyAssignment: assignment("visualization-knowledge", "Visualization & Knowledge"),
      },
      {
        id: "repository:misc", label: "misc", type: "repository", url: "https://github.com/example/misc", description: "Reusable code.", language: "Python", topics: [], stars: 0, forks: 0, fork: false, archived: false, updatedAt: "2026-08-20T00:00:00Z", groupId: "legacy-a", groupLabel: "Python",
      },
    ],
    edges: [
      { source: "user:example", target: "group:legacy-a", type: "ownership" },
      { source: "group:legacy-a", target: "repository:robot", type: "membership" },
      { source: "group:legacy-a", target: "repository:misc", type: "membership" },
      { source: "user:example", target: "group:legacy-b", type: "ownership" },
      { source: "group:legacy-b", target: "repository:atlas", type: "membership" },
    ],
    semanticEdges: [{ source: "repository:atlas", target: "repository:robot", type: "semantic", score: 0.88 }],
    taxonomy: {
      schemaVersion: 1,
      corpusFingerprint: "0".repeat(64),
      repositories: [],
      categories,
      source: { providerId: "standard", model: STANDARD_TAXONOMY_ID },
    },
    taxonomyAssignmentVersion: 1,
  };
}

test("standard hierarchy promotion is deterministic, idempotent, and Action/hosted helpers stay equivalent", () => {
  const input = baseGraph();
  const action = promoteScript(structuredClone(input));
  const hosted = promoteSource(structuredClone(input));
  assert.deepEqual(hosted, action);
  assert.deepEqual(promoteScript(structuredClone(action)), action, "promotion must be idempotent");
  assert.equal(action.groupCount, 3);
  assert.deepEqual(
    new Set(action.nodes.filter((node) => node.type === "group").map((node) => node.id)),
    new Set(["group:robotics-automation", "group:visualization-knowledge", "group:uncategorized"]),
  );
  assert.equal(action.nodes.find((node) => node.label === "robot")?.groupId, "robotics-automation");
  assert.equal(action.nodes.find((node) => node.label === "atlas")?.groupId, "visualization-knowledge");
  assert.equal(action.nodes.find((node) => node.label === "misc")?.groupId, "uncategorized");
  assert.deepEqual(action.semanticEdges, input.semanticEdges, "semantic relations must remain a separate untouched layer");
  assert.equal(action.edges.some((edge) => edge.source.includes("legacy-") || edge.target.includes("legacy-")), false);
});

test("portfolio/custom taxonomies are not promoted by the standard hierarchy helper", () => {
  const graph = baseGraph();
  graph.taxonomy.source = { providerId: "override", model: "custom-v1" };
  assert.strictEqual(promoteScript(graph), graph);
  assert.strictEqual(promoteSource(graph), graph);
});

test("static graph sanitization rebuilds untrusted structure then restores only safe standard-v1 hierarchy", () => {
  const input = baseGraph();
  input.nodes.find((node) => node.type === "group").label = "spoofed group";
  input.nodes.find((node) => node.label === "robot").groupId = "spoofed";
  input.nodes.find((node) => node.label === "atlas").groupLabel = "spoofed";
  const safe = sanitizeStaticGraph(input, "example");
  assert.ok(safe);
  assert.equal(safe.taxonomy?.source.model, STANDARD_TAXONOMY_ID);
  assert.equal(safe.nodes.find((node) => node.label === "robot")?.groupId, "robotics-automation");
  assert.equal(safe.nodes.find((node) => node.label === "atlas")?.groupId, "visualization-knowledge");
  assert.equal(safe.nodes.find((node) => node.label === "misc")?.groupId, "uncategorized");
  assert.equal(safe.nodes.some((node) => node.type === "group" && node.label === "spoofed group"), false);
  assert.deepEqual(
    new Set(safe.nodes.filter((node) => node.type === "group").map((node) => node.id)),
    new Set(["group:robotics-automation", "group:visualization-knowledge", "group:uncategorized"]),
  );
});
