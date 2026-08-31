import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-31T00:00:00Z",
  repositoryCount: 1,
  groupCount: 1,
  taxonomy: {
    schemaVersion: 1,
    corpusFingerprint: "bootstrap-order-fixture",
    source: { providerId: "standard", model: "ipm-standard-v1" },
    repositories: [],
    categories: [
      {
        id: "robotics-automation",
        label: "Robotics & Automation",
        description: "Robotics and autonomous systems",
        aliases: ["autonomous systems"],
      },
    ],
  },
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics-automation", label: "Robotics & Automation", type: "group", repositoryCount: 1 },
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
      updatedAt: "2026-08-30T00:00:00Z",
      groupId: "robotics-automation",
      groupLabel: "Robotics & Automation",
      taxonomyAssignment: {
        categoryId: "robotics-automation",
        categoryLabel: "Robotics & Automation",
        confidence: 0.97,
        method: "deterministic",
        evidence: [],
        secondaryTags: ["artifact:application", "topic:manipulation"],
      },
    },
  ],
  edges: [
    { source: "user:example", target: "group:robotics-automation", type: "ownership" },
    { source: "group:robotics-automation", target: "repository:robot-arm", type: "membership" },
  ],
};

test("2D graph fetch starts only after shared runtime patches are installed", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.__ipmGraphFetchRuntimeState = null;
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input?.url || String(input || "");
      if (url.includes("/project-map/graph.json")) {
        window.__ipmGraphFetchRuntimeState = {
          searchContext: typeof window.ProjectMapSearchContext?.snapshot === "function",
          viewModel: typeof window.ProjectMapViewModel?.projectSearchContext === "function",
        };
      }
      return nativeFetch(input, init);
    };
  });

  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });

  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();
  expect(await page.evaluate(() => window.__ipmGraphFetchRuntimeState)).toEqual({
    searchContext: true,
    viewModel: true,
  });

  await page.locator("#search").fill("autonomous systems");
  await expect.poll(() => page.evaluate(() => window.ProjectMapSearchContext?.snapshot())).toMatchObject({
    query: "autonomous systems",
    directCategoryIds: ["group:robotics-automation"],
    categoryMemberIds: ["repository:robot-arm"],
  });

  await page.locator("#search").fill("topic:manipulation");
  await expect.poll(() => page.evaluate(() => window.ProjectMapSearchContext?.snapshot())).toMatchObject({
    query: "topic:manipulation",
    directRepositoryIds: ["repository:robot-arm"],
    contextCategoryIds: ["group:robotics-automation"],
  });
});
