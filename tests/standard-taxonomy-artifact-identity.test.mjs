import assert from "node:assert/strict";
import test from "node:test";

import { standardizeRepositoryClassification as classifyAction } from "../scripts/standard-taxonomy-runtime.mjs";
import { standardizeRepositoryClassification as classifyHosted } from "../src/standard-taxonomy-runtime.ts";

function complete(raw) {
  return {
    id: 1,
    name: raw.name,
    html_url: `https://github.com/example/${encodeURIComponent(raw.name)}`,
    description: raw.description ?? null,
    language: raw.language ?? "Python",
    topics: raw.topics ?? [],
    stargazers_count: 0,
    forks_count: 0,
    fork: false,
    archived: false,
    updated_at: "2026-08-25T00:00:00Z",
    readmeExcerpt: raw.readmeExcerpt ?? "",
    manifests: raw.manifests ?? [],
    frameworks: raw.frameworks ?? [],
    classification: raw.classification ?? {
      categoryId: "robotics",
      categoryLabel: "Robotics / ROS 2",
      secondaryTags: [],
      confidence: 0.8,
      method: "deterministic",
      evidence: [],
    },
  };
}

function assertRuntimeParity(repo) {
  const action = classifyAction(repo).classification;
  const hosted = classifyHosted(repo).classification;
  assert.deepEqual(hosted, action);
  return action;
}

test("README documentation sections do not turn an executable robotics app into a documentation artifact", () => {
  const classification = assertRuntimeParity(complete({
    name: "robot-demo",
    description: "ROS 2 robot demo application for Gazebo simulation",
    readmeExcerpt: "Install with Docker, launch Gazebo, run the Behavior Tree, then read the mechanism documentation for details.",
  }));

  assert.equal(classification?.categoryId, "robotics-automation");
  assert.ok(classification.secondaryTags.includes("artifact:application"));
  assert.equal(classification.secondaryTags.includes("artifact:documentation"), false);
  assert.ok(classification.secondaryTags.includes("ecosystem:ros2"));
  assert.ok(classification.secondaryTags.includes("topic:gazebo"));
});

test("documentation remains an artifact when repository identity explicitly says it is documentation", () => {
  const classification = assertRuntimeParity(complete({
    name: "robot-reference-docs",
    description: "Documentation site for ROS 2 robot integration",
    readmeExcerpt: "Reference pages include setup examples and runnable snippets.",
  }));

  assert.equal(classification?.categoryId, "robotics-automation");
  assert.ok(classification.secondaryTags.includes("artifact:documentation"));
  assert.equal(classification.secondaryTags.includes("artifact:application"), false);
});
