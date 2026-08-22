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

async function installFixture(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

test("category disclosure is independent from category and repository focus", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 760 });
  await installFixture(page);
  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();

  const navigator = page.getByRole("complementary", { name: "Category navigator" });
  await expect(navigator).toBeVisible();
  await expect(page.locator("#categoryNavigatorSummary")).toHaveText("2 categories · 4 repos");

  const roboticsFocus = navigator.locator('[data-category-id="group:robotics"]');
  const roboticsSection = roboticsFocus.locator("xpath=ancestor::section");
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

  const alpha = navigator.locator('[data-repository-id="repository:alpha"]');
  await alpha.click();
  await expect(alpha).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => state.selected?.id || null)).toBe("repository:alpha");
  await expect(page.locator("#detailsTitle")).toHaveText("alpha");

  await navigator.getByRole("button", { name: "Clear focus" }).click();
  expect(await page.evaluate(() => state.selected?.id || null)).toBeNull();
  await expect(repositories).toBeVisible();
});

test("search expands matching categories and status filters remove hidden repositories", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 760 });
  await installFixture(page);
  await page.goto("/u/?username=example&style=obsidian");
  await expect(page.locator("#status")).toBeHidden();

  const navigator = page.getByRole("complementary", { name: "Category navigator" });
  const robotics = navigator.locator('[data-category-id="group:robotics"]').locator("xpath=ancestor::section");
  const web = navigator.locator('[data-category-id="group:web"]').locator("xpath=ancestor::section");
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

  const navigator = page.getByRole("complementary", { name: "Category navigator" });
  const robotics = navigator.locator('[data-category-id="group:robotics"]');
  await robotics.click();

  await expect(robotics).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#categoryNavigatorSummary")).toHaveText("2 categories · Focus: Robotics");
  expect(await page.evaluate(() => window.ProjectMapCategoryNavigator.snapshot().focus?.id)).toBe("group:robotics");
  expect(await page.evaluate(() => state.query)).toBe("robotics");
  await expect(page.locator("#detailsTitle")).toHaveText("Project treemap");

  const alpha = navigator.locator('[data-repository-id="repository:alpha"]');
  await alpha.click();
  await expect(alpha).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#categoryNavigatorSummary")).toHaveText("2 categories · Focus: alpha");
  expect(await page.evaluate(() => window.ProjectMapCategoryNavigator.snapshot().focus?.id)).toBe("repository:alpha");
  expect(await page.evaluate(() => state.query)).toBe("alpha");
  await expect(page.locator("#detailsTitle")).toHaveText("Project treemap");

  await navigator.getByRole("button", { name: "Clear focus" }).click();
  expect(await page.evaluate(() => state.query)).toBe("");
  expect(await page.evaluate(() => window.ProjectMapCategoryNavigator.snapshot().focus)).toBeNull();
});
