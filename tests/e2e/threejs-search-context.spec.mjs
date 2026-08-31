import { expect, test } from "@playwright/test";

import { ProjectMapViewModel } from "../../packages/project-map-view-model/src/index.js";
import { ProjectMapSearchContext } from "../../packages/project-map-view-model/src/search-context.js";

const graph = {
  owner: "example",
  generatedAt: "2026-08-26T00:00:00Z",
  repositoryCount: 3,
  groupCount: 2,
  taxonomy: {
    schemaVersion: 1,
    corpusFingerprint: "three-search-fixture",
    repositories: [],
    source: { providerId: "standard", model: "ipm-standard-v1" },
    categories: [
      {
        id: "robotics-automation",
        label: "Robotics & Automation",
        description: "Robotics and autonomous systems",
        aliases: ["robots", "autonomous systems", "ros robotics"],
      },
      {
        id: "ai-ml",
        label: "AI & Machine Learning",
        description: "AI systems",
        aliases: ["artificial intelligence", "deep learning"],
      },
    ],
  },
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics-automation", label: "Robotics & Automation", type: "group", repositoryCount: 2 },
    { id: "group:ai-ml", label: "AI & Machine Learning", type: "group", repositoryCount: 1 },
    {
      id: "repository:robot-nav",
      label: "robot-nav",
      repositoryName: "robot-nav",
      type: "repository",
      url: "https://github.com/example/robot-nav",
      description: "Autonomous navigation stack",
      language: "Python",
      topics: ["navigation"],
      stars: 5,
      forks: 0,
      fork: false,
      archived: false,
      relation: "owned",
      updatedAt: "2026-08-25T00:00:00Z",
      groupId: "robotics-automation",
      groupLabel: "Robotics & Automation",
      taxonomyAssignment: {
        categoryId: "robotics-automation",
        categoryLabel: "Robotics & Automation",
        confidence: 0.98,
        method: "deterministic",
        evidence: [],
        secondaryTags: ["artifact:application", "ecosystem:ros2", "topic:slam"],
      },
    },
    {
      id: "repository:robot-arm",
      label: "robot-arm",
      repositoryName: "robot-arm",
      type: "repository",
      url: "https://github.com/example/robot-arm",
      description: "Manipulator controller",
      language: "C++",
      topics: ["moveit"],
      stars: 2,
      forks: 0,
      fork: false,
      archived: false,
      relation: "owned",
      updatedAt: "2026-08-24T00:00:00Z",
      groupId: "robotics-automation",
      groupLabel: "Robotics & Automation",
      taxonomyAssignment: {
        categoryId: "robotics-automation",
        categoryLabel: "Robotics & Automation",
        confidence: 0.97,
        method: "deterministic",
        evidence: [],
        secondaryTags: ["artifact:application", "ecosystem:ros2", "topic:manipulation"],
      },
    },
    {
      id: "repository:model-train",
      label: "model-train",
      repositoryName: "model-train",
      type: "repository",
      url: "https://github.com/example/model-train",
      description: "Neural network model training",
      language: "Python",
      topics: ["machine-learning"],
      stars: 4,
      forks: 0,
      fork: false,
      archived: false,
      relation: "owned",
      updatedAt: "2026-08-23T00:00:00Z",
      groupId: "ai-ml",
      groupLabel: "AI & Machine Learning",
      taxonomyAssignment: {
        categoryId: "ai-ml",
        categoryLabel: "AI & Machine Learning",
        confidence: 0.96,
        method: "deterministic",
        evidence: [],
        secondaryTags: ["artifact:model", "topic:training"],
      },
    },
  ],
  edges: [
    { source: "user:example", target: "group:robotics-automation", type: "ownership" },
    { source: "user:example", target: "group:ai-ml", type: "ownership" },
    { source: "group:robotics-automation", target: "repository:robot-nav", type: "membership" },
    { source: "group:robotics-automation", target: "repository:robot-arm", type: "membership" },
    { source: "group:ai-ml", target: "repository:model-train", type: "membership" },
  ],
};

const sanitizedGraph = ProjectMapViewModel.sanitizeGraph(graph, "example");
if (!sanitizedGraph) throw new Error("threejs-search-context fixture must sanitize");

function canonicalSearchSnapshot(query) {
  return ProjectMapSearchContext.project(sanitizedGraph, query).snapshot();
}

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function waitForSearchSnapshot(page, expected) {
  await expect.poll(
    () => page.evaluate(() => window.ProjectMapSearchContext?.snapshot() || null),
    { timeout: 10_000 },
  ).toEqual(expected);
  return page.evaluate(() => window.ProjectMapSearchContext.snapshot());
}

async function twoDSnapshot(page, query, expected) {
  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();
  await page.locator("#search").fill(query);
  return waitForSearchSnapshot(page, expected);
}

async function threeSnapshot(page, query, expected) {
  const params = new URLSearchParams({ username: "example", q: query });
  await page.goto(`/three/?${params}`);
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });
  return waitForSearchSnapshot(page, expected);
}

test("2D and Three.js return identical renderer-neutral search IDs and reasons", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Real Three.js search parity is exercised once in Chromium.");
  await installGraph(page);

  for (const query of ["ecosystem:ros2", "autonomous systems", "topic:manipulation"]) {
    const canonical = canonicalSearchSnapshot(query);
    const twoD = await twoDSnapshot(page, query, canonical);
    const threeD = await threeSnapshot(page, query, canonical);
    expect(twoD).toEqual(canonical);
    expect(threeD).toEqual(canonical);
  }
});

test("Three.js keyboard search navigation selects direct hits without mutating Local Graph scope", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Real Three.js keyboard navigation is exercised once in Chromium.");
  await installGraph(page);
  await page.goto("/three/?username=example&q=ecosystem%3Aros2");
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });
  await expect(page.locator("#resultCount")).toHaveText("2 / 3 projects");

  const search = page.locator("#search");
  const scopeBefore = await page.evaluate(() => window.ProjectMapThreejsLocalGraph.snapshot());
  const semantic = await page.evaluate(() => window.ProjectMapSearchContext.snapshot());
  expect(semantic.directRepositoryIds).toEqual(["repository:robot-arm", "repository:robot-nav"]);
  expect(semantic.matchReasons["repository:robot-nav"]).toEqual(["ecosystem:ros2"]);

  await search.press("ArrowDown");
  await expect(page.locator("#detailsTitle")).toHaveText("robot-nav");
  await expect(page.locator("#detailsMeta")).toContainText("Match");
  await expect(page.locator("#detailsMeta")).toContainText("ecosystem:ros2");

  await search.press("ArrowDown");
  await expect(page.locator("#detailsTitle")).toHaveText("robot-arm");
  await search.press("ArrowUp");
  await expect(page.locator("#detailsTitle")).toHaveText("robot-nav");

  await page.evaluate(() => {
    window.__threeSearchOpen = null;
    window.open = (...args) => { window.__threeSearchOpen = args; return null; };
  });
  await search.press("Enter");
  expect(await page.evaluate(() => window.__threeSearchOpen)).toEqual([
    "https://github.com/example/robot-nav",
    "_blank",
    "noopener",
  ]);

  await search.fill("autonomous systems");
  await expect(page.locator("#resultCount")).toHaveText("2 / 3 projects");
  const alias = await page.evaluate(() => window.ProjectMapSearchContext.snapshot());
  expect(alias.directCategoryIds).toEqual(["group:robotics-automation"]);
  expect(alias.categoryMemberIds).toEqual(["repository:robot-arm", "repository:robot-nav"]);

  const scopeAfter = await page.evaluate(() => window.ProjectMapThreejsLocalGraph.snapshot());
  expect(scopeAfter.nodeIds).toEqual(scopeBefore.nodeIds);
  expect(scopeAfter.edgeIds).toEqual(scopeBefore.edgeIds);
});
