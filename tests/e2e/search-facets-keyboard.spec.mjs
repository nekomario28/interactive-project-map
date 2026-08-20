import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-20T00:00:00Z",
  repositoryCount: 3,
  groupCount: 2,
  taxonomy: {
    schemaVersion: 1,
    corpusFingerprint: "fixture",
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
      id: "repository:robot-nav", label: "robot-nav", type: "repository", url: "https://github.com/example/robot-nav",
      description: "Autonomous navigation stack", language: "Python", topics: ["navigation"],
      stars: 5, forks: 0, fork: false, archived: false, updatedAt: "2026-08-20T00:00:00Z",
      groupId: "robotics-automation", groupLabel: "Robotics & Automation",
      taxonomyAssignment: {
        categoryId: "robotics-automation", categoryLabel: "Robotics & Automation", confidence: 0.98,
        method: "deterministic", evidence: [], secondaryTags: ["artifact:application", "ecosystem:ros2", "topic:slam"],
      },
    },
    {
      id: "repository:robot-arm", label: "robot-arm", type: "repository", url: "https://github.com/example/robot-arm",
      description: "Manipulator controller", language: "C++", topics: ["moveit"],
      stars: 2, forks: 0, fork: false, archived: false, updatedAt: "2026-08-20T00:00:00Z",
      groupId: "robotics-automation", groupLabel: "Robotics & Automation",
      taxonomyAssignment: {
        categoryId: "robotics-automation", categoryLabel: "Robotics & Automation", confidence: 0.97,
        method: "deterministic", evidence: [], secondaryTags: ["artifact:application", "ecosystem:ros2", "topic:manipulation"],
      },
    },
    {
      id: "repository:model-train", label: "model-train", type: "repository", url: "https://github.com/example/model-train",
      description: "Neural network model training", language: "Python", topics: ["machine-learning"],
      stars: 4, forks: 0, fork: false, archived: false, updatedAt: "2026-08-20T00:00:00Z",
      groupId: "ai-ml", groupLabel: "AI & Machine Learning",
      taxonomyAssignment: {
        categoryId: "ai-ml", categoryLabel: "AI & Machine Learning", confidence: 0.96,
        method: "deterministic", evidence: [], secondaryTags: ["artifact:model", "topic:training"],
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

test("facet and alias search exposes reasons and keyboard navigation without relayout", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installGraph(page);
  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();

  const before = await page.evaluate(geometrySnapshot());
  const search = page.locator("#search");

  await search.fill("ecosystem:ros2");
  await expect.poll(() => page.evaluate(() => window.ProjectMapSearchContext?.snapshot().query)).toBe("ecosystem:ros2");
  const facet = await page.evaluate(() => ({
    snapshot: window.ProjectMapSearchContext.snapshot(),
    reasons: window.ProjectMapSearchContext.reasons("repository:robot-nav"),
    direct: window.ProjectMapSearchContext.directRepositories(),
  }));
  expect(facet.snapshot.directRepositoryIds).toEqual(["repository:robot-arm", "repository:robot-nav"]);
  expect(facet.reasons).toEqual(["ecosystem:ros2"]);
  expect(facet.direct).toHaveLength(2);

  await search.press("ArrowDown");
  const first = await page.evaluate(() => ({
    selected: state.selected?.id,
    first: window.ProjectMapSearchContext.directRepositories()[0],
    meta: document.getElementById("detailsMeta")?.textContent || "",
  }));
  expect(first.selected).toBe(first.first);
  expect(first.meta).toContain("Match: ecosystem:ros2");

  await search.press("ArrowDown");
  const second = await page.evaluate(() => ({
    selected: state.selected?.id,
    second: window.ProjectMapSearchContext.directRepositories()[1],
  }));
  expect(second.selected).toBe(second.second);

  await search.press("ArrowUp");
  expect(await page.evaluate(() => state.selected?.id)).toBe(first.first);

  await page.evaluate(() => {
    window.__searchOpen = null;
    window.open = (...args) => { window.__searchOpen = args; return null; };
  });
  await search.press("Enter");
  const opened = await page.evaluate(() => window.__searchOpen);
  expect(opened?.[0]).toBe(`https://github.com/example/${first.first.replace("repository:", "")}`);
  expect(opened?.[1]).toBe("_blank");
  expect(opened?.[2]).toBe("noopener");

  await search.fill("autonomous systems");
  const alias = await page.evaluate(() => ({
    snapshot: window.ProjectMapSearchContext.snapshot(),
    reasons: window.ProjectMapSearchContext.reasons("group:robotics-automation"),
  }));
  expect(alias.snapshot.directCategoryIds).toEqual(["group:robotics-automation"]);
  expect(alias.snapshot.categoryMemberIds).toEqual(["repository:robot-arm", "repository:robot-nav"]);
  expect(alias.reasons).toEqual(["category"]);

  await search.fill("topic:manipulation");
  expect(await page.evaluate(() => window.ProjectMapSearchContext.reasons("repository:robot-arm"))).toEqual(["topic:manipulation"]);

  expect(await page.evaluate(geometrySnapshot())).toEqual(before);
});
