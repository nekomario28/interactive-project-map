import assert from "node:assert/strict";
import test from "node:test";

import { ProjectMapViewModel } from "../packages/project-map-view-model/src/index.js";
import { ProjectMapSearchContext } from "../packages/project-map-view-model/src/search-context.js";

const graph = {
  owner: "example",
  searchTaxonomy: {
    categories: [
      { id: "robotics-automation", label: "Robotics & Automation", aliases: ["robots", "autonomous systems", "ros robotics"] },
      { id: "ai-ml", label: "AI & Machine Learning", aliases: ["artificial intelligence", "deep learning"] },
    ],
  },
  nodes: [
    { id: "user:example", label: "example", type: "owner" },
    { id: "group:robotics-automation", label: "Robotics & Automation", type: "group" },
    { id: "group:ai-ml", label: "AI & Machine Learning", type: "group" },
    {
      id: "repository:robot-nav",
      label: "robot-nav",
      type: "repository",
      description: "Autonomous navigation stack",
      language: "Python",
      topics: ["navigation"],
      searchFacets: ["artifact:application", "ecosystem:ros2", "topic:slam"],
      relation: "owned",
      fork: false,
      archived: false,
      groupId: "robotics-automation",
    },
    {
      id: "repository:robot-arm",
      label: "robot-arm",
      type: "repository",
      description: "Manipulator controller",
      language: "C++",
      topics: ["moveit"],
      searchFacets: ["artifact:application", "ecosystem:ros2", "topic:manipulation"],
      relation: "owned",
      fork: false,
      archived: false,
      groupId: "robotics-automation",
    },
    {
      id: "repository:model-train",
      label: "model-train",
      type: "repository",
      description: "Neural network model training",
      language: "Python",
      topics: ["machine-learning"],
      searchFacets: ["artifact:model", "topic:training"],
      relation: "owned",
      fork: true,
      archived: false,
      groupId: "ai-ml",
    },
  ],
  edges: [
    { source: "user:example", target: "group:robotics-automation", type: "ownership" },
    { source: "user:example", target: "group:ai-ml", type: "ownership" },
    { source: "group:robotics-automation", target: "repository:robot-nav", type: "membership" },
    { source: "group:robotics-automation", target: "repository:robot-arm", type: "membership" },
    { source: "group:ai-ml", target: "repository:model-train", type: "membership" },
  ],
  semanticEdges: [],
};

test("facet search preserves direct repository reasons and repository order", () => {
  const context = ProjectMapSearchContext.project(graph, "ＥＣＯＳＹＳＴＥＭ：ＲＯＳ２");
  assert.equal(context.query, "ecosystem:ros2");
  assert.deepEqual(context.directRepositories(), ["repository:robot-nav", "repository:robot-arm"]);
  assert.deepEqual(context.reasons("repository:robot-nav"), ["ecosystem:ros2"]);
  assert.equal(context.level("repository:robot-nav"), "direct");
  assert.equal(context.level("group:robotics-automation"), "category-context");
  assert.equal(context.level("repository:model-train"), "none");
  assert.equal(context.matches("repository:robot-arm"), true);
  assert.equal(context.matches("repository:model-train"), false);
});

test("category aliases keep only the matched category members in context", () => {
  const context = ProjectMapSearchContext.project(graph, "autonomous systems");
  assert.deepEqual(context.snapshot(), {
    query: "autonomous systems",
    directRepositoryIds: [],
    directCategoryIds: ["group:robotics-automation"],
    contextCategoryIds: ["group:robotics-automation"],
    categoryMemberIds: ["repository:robot-arm", "repository:robot-nav"],
    matchReasons: { "group:robotics-automation": ["category"] },
  });
  assert.equal(context.level("group:robotics-automation"), "direct-category");
  assert.equal(context.level("repository:robot-nav"), "category-member");
  assert.equal(context.level("group:ai-ml"), "none");
});

test("topic and language queries expose the same match reason vocabulary as the 2D donor", () => {
  const topic = ProjectMapSearchContext.project(graph, "topic:manipulation");
  assert.deepEqual(topic.reasons("repository:robot-arm"), ["topic:manipulation"]);
  const language = ProjectMapSearchContext.project(graph, "python");
  assert.deepEqual(language.reasons("repository:robot-nav"), ["language:Python"]);
  assert.deepEqual(language.reasons("repository:model-train"), ["language:Python"]);
});

test("membership edges recover category context when repository.groupId is absent", () => {
  const fallback = structuredClone(graph);
  delete fallback.nodes.find((node) => node.id === "repository:robot-nav").groupId;
  const context = ProjectMapSearchContext.project(fallback, "robot-nav");
  assert.equal(context.level("repository:robot-nav"), "direct");
  assert.equal(context.level("group:robotics-automation"), "category-context");
});

test("status projection composes before search so excluded repositories cannot become direct hits", () => {
  const originalOnly = ProjectMapViewModel.projectByStatuses(graph, ["original"]);
  const context = ProjectMapSearchContext.project(originalOnly, "python");
  assert.deepEqual(context.snapshot().directRepositoryIds, ["repository:robot-nav"]);
  assert.equal(context.level("repository:model-train"), "none");
});

test("an empty query matches the current scope without inventing direct hits", () => {
  const context = ProjectMapSearchContext.project(graph, "   ");
  assert.equal(context.query, "");
  assert.equal(context.level("repository:robot-nav"), "all");
  assert.equal(context.matches("repository:robot-nav"), true);
  assert.deepEqual(context.snapshot().directRepositoryIds, []);
  assert.deepEqual(context.snapshot().matchReasons, {});
});
