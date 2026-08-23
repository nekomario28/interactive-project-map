import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-22T00:00:00Z",
  repositoryCount: 4,
  groupCount: 2,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 3 },
    { id: "group:web", label: "Web", type: "group", repositoryCount: 1 },
    { id: "repository:alpha", label: "alpha", type: "repository", url: "https://github.com/example/alpha", description: "root robot", language: "Python", topics: ["robotics"], stars: 4, forks: 0, fork: false, archived: false, updatedAt: "2026-08-20T00:00:00Z", groupId: "robotics", groupLabel: "Robotics" },
    { id: "repository:beta", label: "beta", type: "repository", url: "https://github.com/example/beta", description: "fork neighbor", language: "C++", topics: ["robotics"], stars: 2, forks: 1, fork: true, archived: false, updatedAt: "2026-06-01T00:00:00Z", groupId: "robotics", groupLabel: "Robotics" },
    { id: "repository:gamma", label: "gamma", type: "repository", url: "https://github.com/example/gamma", description: "archived second hop", language: "Rust", topics: ["robotics"], stars: 1, forks: 0, fork: false, archived: true, updatedAt: "2025-01-01T00:00:00Z", groupId: "robotics", groupLabel: "Robotics" },
    { id: "repository:delta", label: "delta", type: "repository", url: "https://github.com/example/delta", description: "unrelated web", language: "TypeScript", topics: ["web"], stars: 1, forks: 0, fork: false, archived: false, updatedAt: "2026-08-10T00:00:00Z", groupId: "web", groupLabel: "Web" },
  ],
  edges: [
    { source: "user:example", target: "group:robotics", type: "ownership" },
    { source: "user:example", target: "group:web", type: "ownership" },
    { source: "group:robotics", target: "repository:alpha", type: "membership" },
    { source: "group:robotics", target: "repository:beta", type: "membership" },
    { source: "group:robotics", target: "repository:gamma", type: "membership" },
    { source: "group:web", target: "repository:delta", type: "membership" },
  ],
};

const externalGraph = {
  ...graph,
  contributedRepositoryCount: 1,
  externalContributions: {
    window: { from: "2025-08-22T00:00:00Z", to: "2026-08-22T00:00:00Z" },
    cap: 4,
    candidateRepositories: 1,
    includedRepositories: 1,
    omittedRepositories: 0,
    truncatedRepositories: 0,
  },
  nodes: [
    ...graph.nodes,
    {
      id: "repository:other/ext",
      label: "other/ext",
      type: "repository",
      relation: "contributed",
      repositoryOwner: "other",
      repositoryName: "ext",
      url: "https://github.com/other/ext",
      description: "accepted external work",
      language: "Python",
      topics: ["robotics"],
      stars: 2,
      forks: 0,
      fork: false,
      archived: false,
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
      contribution: { commits: 0, pullRequests: 1, mergedPullRequests: 1, commitsTruncated: false, pullRequestsTruncated: false },
    },
  ],
};

async function installFixture(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function installExternalFixture(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(externalGraph) });
  });
}

async function openNavigator(page) {
  const toggle = page.getByRole("button", { name: "Categories" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  return page.getByRole("complementary", { name: "Category navigator" });
}

test("category launcher aligns left and selection toggles independently from disclosure", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 760 });
  await installFixture(page);
  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();

  const navigator = await openNavigator(page);
  await expect(navigator).toBeVisible();
  await expect(page.locator("#categoryNavigatorSummary")).toHaveText("2 categories · 4 repos");

  const toggleBox = await page.getByRole("button", { name: "Categories" }).boundingBox();
  const titleBox = await page.locator("#title").boundingBox();
  const panelBox = await navigator.boundingBox();
  expect(toggleBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  expect(toggleBox.x).toBeLessThan(titleBox.x);
  expect(toggleBox.x).toBeLessThan(80);
  expect(panelBox.x).toBeLessThan(40);

  const roboticsFocus = navigator.locator('[data-category-id="group:robotics"]');
  const roboticsSection = roboticsFocus.locator("xpath=ancestor::section[1]");
  const disclosure = roboticsSection.locator(".category-nav-disclosure");
  const repositories = roboticsSection.locator(".category-nav-repositories");

  await expect(repositories).toBeHidden();
  await disclosure.click();
  await expect(repositories).toBeVisible();
  expect(await page.evaluate(() => state.selected?.id || null)).toBeNull();

  await roboticsFocus.click();
  await expect(roboticsFocus).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => state.selected?.id || null)).toBe("group:robotics");
  await expect(repositories).toBeVisible();

  await roboticsFocus.click();
  await expect(roboticsFocus).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => state.selected?.id || null)).toBeNull();
  await expect(repositories).toBeVisible();

  await roboticsFocus.click();
  const alpha = navigator.locator('[data-repository-id="repository:alpha"]');
  await alpha.click();
  await expect(alpha).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => state.selected?.id || null)).toBe("repository:alpha");
  await expect(page.locator("#detailsTitle")).toHaveText("alpha");

  await alpha.click();
  await expect(alpha).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => state.selected?.id || null)).toBeNull();
  await expect(repositories).toBeVisible();

  await alpha.click();
  await navigator.getByRole("button", { name: "Clear focus" }).click();
  expect(await page.evaluate(() => state.selected?.id || null)).toBeNull();
  await expect(repositories).toBeVisible();
});

test("search expands matching categories and status filters remove hidden repositories", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 760 });
  await installFixture(page);
  await page.goto("/u/?username=example&style=obsidian");
  await expect(page.locator("#status")).toBeHidden();

  const navigator = await openNavigator(page);
  const robotics = navigator.locator('[data-category-id="group:robotics"]').locator("xpath=ancestor::section[1]");
  const web = navigator.locator('[data-category-id="group:web"]').locator("xpath=ancestor::section[1]");
  await expect(robotics.locator(".category-nav-repositories")).toBeHidden();
  await expect(web.locator(".category-nav-repositories")).toBeHidden();

  await page.locator("#search").fill("delta");
  await expect(web.locator(".category-nav-repositories")).toBeVisible();
  await expect(web.locator('[data-repository-id="repository:delta"]')).toHaveClass(/is-search-match/);
  await expect(robotics.locator(".category-nav-repositories")).toBeHidden();

  await page.locator("#search").fill("");
  await expect(web.locator(".category-nav-repositories")).toBeHidden();

  const gamma = navigator.locator('[data-repository-id="repository:gamma"]');
  await expect(gamma).toHaveCount(1);
  await expect(gamma).toBeHidden();
  await robotics.locator(".category-nav-disclosure").click();
  await expect(gamma).toBeVisible();

  await page.getByRole("button", { name: /^Archived repositories: 1/ }).click();
  await expect(navigator.locator('[data-repository-id="repository:gamma"]')).toHaveCount(0);
  await expect(page.locator("#categoryNavigatorSummary")).toHaveText("2 categories · 3 repos");
});

test("aggregate viewers use search dimming as a safe category and repository focus fallback", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 760 });
  await installFixture(page);
  await page.goto("/treemap/?username=example&style=treemap");
  await expect(page.locator("#status")).toBeHidden();

  const navigator = await openNavigator(page);
  const robotics = navigator.locator('[data-category-id="group:robotics"]');
  await robotics.click();

  await expect(robotics).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#categoryNavigatorSummary")).toHaveText("2 categories · Focus: Robotics");
  expect(await page.evaluate(() => window.ProjectMapCategoryNavigator.snapshot().focus?.id)).toBe("group:robotics");
  expect(await page.evaluate(() => state.query)).toBe("robotics");
  await expect(page.locator("#detailsTitle")).toHaveText("Project treemap");

  await robotics.click();
  await expect(robotics).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => window.ProjectMapCategoryNavigator.snapshot().focus)).toBeNull();
  expect(await page.evaluate(() => state.query)).toBe("");

  await robotics.click();
  const alpha = navigator.locator('[data-repository-id="repository:alpha"]');
  await alpha.click();
  await expect(alpha).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#categoryNavigatorSummary")).toHaveText("2 categories · Focus: alpha");
  expect(await page.evaluate(() => window.ProjectMapCategoryNavigator.snapshot().focus?.id)).toBe("repository:alpha");
  expect(await page.evaluate(() => state.query)).toBe("alpha");
  await expect(page.locator("#detailsTitle")).toHaveText("Project treemap");

  await alpha.click();
  expect(await page.evaluate(() => state.query)).toBe("");
  expect(await page.evaluate(() => window.ProjectMapCategoryNavigator.snapshot().focus)).toBeNull();
});

test("Contributed appears in a separate non-owned navigator section", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 760 });
  await installExternalFixture(page);
  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();

  const navigator = await openNavigator(page);
  await expect(page.locator("#categoryNavigatorSummary")).toHaveText("2 categories · 4 owned · 1 external");
  const external = navigator.locator('[data-external-contributions="true"]');
  await expect(external).toHaveCount(1);
  await expect(external).toContainText("External contributions");
  await expect(external).toContainText("not owned");
  await expect(external.locator(".category-nav-repositories")).toBeHidden();

  await external.locator(".category-nav-disclosure").click();
  const repo = external.locator('[data-repository-id="repository:other/ext"]');
  await expect(repo).toBeVisible();
  await repo.click();
  await expect(repo).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#detailsTitle")).toHaveText("other/ext");
  await expect(page.locator("#detailsMeta")).toContainText("Contributed");

  await page.getByRole("button", { name: /^Contributed repositories: 1/ }).click();
  await expect(navigator.locator('[data-external-contributions="true"]')).toHaveCount(0);
  await expect(page.locator("#categoryNavigatorSummary")).toHaveText("2 categories · 4 repos");
});
