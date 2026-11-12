import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-11-01T00:00:00Z",
  repositoryCount: 1,
  groupCount: 1,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:apps", label: "Apps", type: "group", repositoryCount: 1 },
    { id: "repository:alpha", label: "alpha", type: "repository",
      url: "https://github.com/example/alpha", groupId: "apps", groupLabel: "Apps",
      stars: 0, forks: 0, fork: false, archived: false, topics: [] },
  ],
  edges: [
    { source: "user:example", target: "group:apps", type: "ownership" },
    { source: "group:apps", target: "repository:alpha", type: "membership" },
  ],
};

test("shared and dedicated 2D controls keep Fit and Reset in View options", async ({ page }) => {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) }));
  for (const route of ["u", "radial"]) {
    await page.goto(`/${route}/?username=example&style=${route === "u" ? "galaxy-systems" : route}`);
    const menu = page.locator(".view-options-menu");
    await expect(menu.locator("summary")).toBeVisible();
    await expect(menu.locator("#fit")).toBeHidden();
    await menu.locator("summary").click();
    await expect(menu.locator("#fit")).toBeVisible();
    await expect(menu.locator("#reset")).toBeVisible();
    await menu.locator("#fit").click();
    await menu.locator("summary").click();
    await expect(menu.locator("#fit")).toBeHidden();
  }
});

test("dedicated Copy link preserves route and current URL state", async ({ page }) => {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) }));
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", {
    configurable: true, value: { writeText: async text => { window.__copiedViewUrl = text; } },
  }));
  await page.goto("/matrix/?username=example&style=matrix&status=original");
  const menu = page.locator(".view-options-menu");
  await menu.locator("summary").click();
  await menu.locator("#shareView").click();
  await expect(menu.locator("#shareView")).toHaveText("Copied");
  const copied = await page.evaluate(() => window.__copiedViewUrl);
  expect(copied).toContain("/matrix/");
  expect(copied).toContain("username=example");
  expect(copied).toContain("status=original");
});

test("leaving View options hides its overlay so project Focus stays clickable", async ({ page }) => {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) }));
  await page.goto("/u/?username=example&style=galaxy-systems&motion=off");
  await expect(page.locator("#status")).toBeHidden();
  const menu = page.locator(".view-options-menu");
  await menu.locator("summary").click();
  await expect(menu.locator("#shareView")).toBeVisible();
  await page.locator("#search").fill("alpha");
  await expect(menu).not.toHaveAttribute("open", "");
  await expect(menu.locator("#shareView")).toBeHidden();
  await page.evaluate(() => updateDetails(state.byId.get("repository:alpha")));
  await expect(page.locator("#focusButton")).toBeVisible();
  await page.locator("#focusButton").click();
  await expect(page.locator("#focusButton")).toHaveText("Exit focus");
});
