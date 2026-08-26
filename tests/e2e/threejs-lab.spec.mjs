import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-26T00:00:00Z",
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 2 },
    {
      id: "repository:alpha",
      label: "alpha",
      type: "repository",
      url: "https://github.com/example/alpha",
      description: "Owned fixture repository",
      language: "JavaScript",
      stars: 7,
      forks: 2,
      fork: false,
      archived: false,
      relation: "owned",
      repositoryName: "alpha",
      groupId: "robotics",
      groupLabel: "Robotics",
      topics: ["visualization"],
    },
    {
      id: "repository:outside/beta",
      label: "outside/beta",
      type: "repository",
      url: "https://github.com/outside/beta",
      description: "Contributed fixture repository",
      language: "Rust",
      stars: 12,
      forks: 3,
      fork: false,
      archived: false,
      relation: "contributed",
      repositoryOwner: "outside",
      repositoryName: "beta",
      topics: ["robotics"],
    },
  ],
  edges: [
    { source: "user:example", target: "group:robotics", type: "ownership" },
    { source: "group:robotics", target: "repository:alpha", type: "membership" },
    { source: "user:example", target: "repository:outside/beta", type: "contribution" },
  ],
};

test("isolated Three.js lab route fails closed without a username", async ({ page }) => {
  await page.goto("/three/");

  await expect(page.locator("body")).toHaveAttribute("data-map-style", "threejs-cosmic");
  await expect(page.locator("#error")).toHaveClass(/visible/);
  await expect(page.locator("#errorText")).toContainText("Add ?username=YOUR_GITHUB_USERNAME");
  await expect(page.locator("#fallbackLink")).toHaveAttribute("href", "../u/");
  await expect(page.locator("#twoDLink")).toHaveAttribute("href", "../u/");
  await expect(page.locator("[data-status-filter]")).toHaveCount(4);
});

test("isolated Three.js lab keeps the 2D fallback usable when the pinned engine is unavailable", async ({ page }) => {
  await page.route("https://cdn.jsdelivr.net/**", async (route) => route.abort());
  await page.goto("/three/?username=example");

  await expect(page.locator("#error")).toHaveClass(/visible/);
  await expect(page.locator("#errorText")).toContainText("pinned Three.js module could not be loaded");
  await expect(page.locator("#twoDLink")).toHaveAttribute("href", /\/u\/\?username=example$/);
  await expect(page.locator("#fallbackLink")).toHaveAttribute("href", /\/u\/\?username=example$/);
});

test("Three.js lab renders the happy-path scene and emits Chromium evidence", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "GPU render evidence is collected once in Chromium; WebKit keeps the fallback smoke above.");
  await mkdir(".tmp/playwright-visual", { recursive: true });
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });

  await page.goto("/three/?username=example");
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });
  await expect(page.locator("#galaxy3d")).toBeVisible();

  const snapshot = await page.evaluate(() => window.ProjectMapThreejsLab?.snapshot());
  expect(snapshot).toEqual({ username: "example", repositories: 2, groups: 1, renderer: "threejs-cosmic", experimental: true });
  const backingStore = await page.locator("#galaxy3d").evaluate((canvas) => ({ width: canvas.width, height: canvas.height }));
  expect(backingStore.width).toBeGreaterThan(0);
  expect(backingStore.height).toBeGreaterThan(0);

  await page.screenshot({ path: ".tmp/playwright-visual/threejs-lab-chromium.png", fullPage: true });
});
