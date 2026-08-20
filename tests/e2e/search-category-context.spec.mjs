import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-20T00:00:00Z",
  repositoryCount: 4,
  groupCount: 2,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics-automation", label: "Robotics & Automation", type: "group", repositoryCount: 2 },
    { id: "group:ai-ml", label: "AI & Machine Learning", type: "group", repositoryCount: 2 },
    {
      id: "repository:robot-nav", label: "robot-nav", type: "repository", url: "https://github.com/example/robot-nav",
      description: "Autonomous robot navigation with ROS2", language: "Python", topics: ["ros2", "navigation"],
      stars: 5, forks: 0, fork: false, archived: false, updatedAt: "2026-08-20T00:00:00Z",
      groupId: "robotics-automation", groupLabel: "Robotics & Automation",
    },
    {
      id: "repository:robot-arm", label: "robot-arm", type: "repository", url: "https://github.com/example/robot-arm",
      description: "Manipulator controller", language: "C++", topics: ["moveit"],
      stars: 2, forks: 0, fork: false, archived: false, updatedAt: "2026-08-20T00:00:00Z",
      groupId: "robotics-automation", groupLabel: "Robotics & Automation",
    },
    {
      id: "repository:model-train", label: "model-train", type: "repository", url: "https://github.com/example/model-train",
      description: "Neural network model training", language: "Python", topics: ["machine-learning"],
      stars: 4, forks: 0, fork: false, archived: false, updatedAt: "2026-08-20T00:00:00Z",
      groupId: "ai-ml", groupLabel: "AI & Machine Learning",
    },
    {
      id: "repository:vision-infer", label: "vision-infer", type: "repository", url: "https://github.com/example/vision-infer",
      description: "Computer vision inference", language: "Rust", topics: ["computer-vision"],
      stars: 1, forks: 0, fork: false, archived: false, updatedAt: "2026-08-20T00:00:00Z",
      groupId: "ai-ml", groupLabel: "AI & Machine Learning",
    },
  ],
  edges: [
    { source: "user:example", target: "group:robotics-automation", type: "ownership" },
    { source: "user:example", target: "group:ai-ml", type: "ownership" },
    { source: "group:robotics-automation", target: "repository:robot-nav", type: "membership" },
    { source: "group:robotics-automation", target: "repository:robot-arm", type: "membership" },
    { source: "group:ai-ml", target: "repository:model-train", type: "membership" },
    { source: "group:ai-ml", target: "repository:vision-infer", type: "membership" },
  ],
};

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

function geometrySnapshot() {
  return () => ({
    zoom: state.zoom,
    pan: { ...state.pan },
    positions: Object.fromEntries(state.nodes.map((node) => [node.id, { x: node.x, y: node.y }])),
  });
}

test("repository search keeps its standard category in context without relayout", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installGraph(page);
  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();

  const before = await page.evaluate(geometrySnapshot());
  await page.locator("#search").fill("robot-nav");
  await expect.poll(() => page.evaluate(() => window.ProjectMapSearchContext?.snapshot().query)).toBe("robot-nav");

  const searched = await page.evaluate(() => ({
    context: window.ProjectMapSearchContext.snapshot(),
    levels: {
      repo: window.ProjectMapSearchContext.level("repository:robot-nav"),
      category: window.ProjectMapSearchContext.level("group:robotics-automation"),
      unrelatedCategory: window.ProjectMapSearchContext.level("group:ai-ml"),
    },
    matches: {
      repo: matchesQuery(state.byId.get("repository:robot-nav")),
      category: matchesQuery(state.byId.get("group:robotics-automation")),
      unrelatedCategory: matchesQuery(state.byId.get("group:ai-ml")),
    },
    opacity: {
      repo: nodeOpacity(state.byId.get("repository:robot-nav")),
      category: nodeOpacity(state.byId.get("group:robotics-automation")),
      unrelatedCategory: nodeOpacity(state.byId.get("group:ai-ml")),
    },
  }));

  expect(searched.context.directRepositoryIds).toEqual(["repository:robot-nav"]);
  expect(searched.context.contextCategoryIds).toEqual(["group:robotics-automation"]);
  expect(searched.levels).toEqual({ repo: "direct", category: "category-context", unrelatedCategory: "none" });
  expect(searched.matches).toEqual({ repo: true, category: true, unrelatedCategory: false });
  expect(searched.opacity.repo).toBeGreaterThan(searched.opacity.category);
  expect(searched.opacity.category).toBeGreaterThan(searched.opacity.unrelatedCategory);

  const afterSearch = await page.evaluate(geometrySnapshot());
  expect(afterSearch).toEqual(before);

  const selectedPrecedence = await page.evaluate(() => {
    updateDetails(state.byId.get("repository:model-train"));
    return {
      matches: matchesQuery(state.byId.get("repository:model-train")),
      opacity: nodeOpacity(state.byId.get("repository:model-train")),
    };
  });
  expect(selectedPrecedence.matches).toBe(true);
  expect(selectedPrecedence.opacity).toBeGreaterThan(0.5);

  await page.evaluate(() => updateDetails(null));
  await page.locator("#search").fill("Robotics & Automation");
  await expect.poll(() => page.evaluate(() => window.ProjectMapSearchContext.snapshot().query)).toBe("robotics & automation");
  const categorySearch = await page.evaluate(() => window.ProjectMapSearchContext.snapshot());
  expect(categorySearch.directCategoryIds).toEqual(["group:robotics-automation"]);
  expect(categorySearch.categoryMemberIds).toEqual(["repository:robot-arm", "repository:robot-nav"]);

  await page.locator("#search").fill("");
  await expect.poll(() => page.evaluate(() => window.ProjectMapSearchContext.snapshot().query)).toBe("");
  const cleared = await page.evaluate(() => window.ProjectMapSearchContext.snapshot());
  expect(cleared.directRepositoryIds).toEqual([]);
  expect(cleared.contextCategoryIds).toEqual([]);
  expect(cleared.categoryMemberIds).toEqual([]);
  expect(await page.evaluate(geometrySnapshot())).toEqual(before);
});
