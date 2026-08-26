import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-26T00:00:00Z",
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 1 },
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
      taxonomyAssignment: { secondaryTags: ["rendering"] },
      updatedAt: "2026-08-25T00:00:00Z",
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
      updatedAt: "2026-08-24T00:00:00Z",
      contribution: {
        commits: 4,
        pullRequests: 2,
        mergedPullRequests: 1,
        commitsTruncated: false,
        pullRequestsTruncated: false,
      },
    },
  ],
  edges: [
    { source: "user:example", target: "group:robotics", type: "ownership" },
    { source: "group:robotics", target: "repository:alpha", type: "membership" },
    { source: "user:example", target: "repository:outside/beta", type: "contribution" },
  ],
  externalContributions: {
    window: { from: "2026-07-01T00:00:00Z", to: "2026-08-26T00:00:00Z" },
    cap: 12,
    candidateRepositories: 1,
    includedRepositories: 1,
    omittedRepositories: 0,
    truncatedRepositories: 0,
  },
};

async function installGraph(page, value = graph) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(value) });
  });
}

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
  await installGraph(page);

  await page.goto("/three/?username=example");
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });
  await expect(page.locator("#subtitle")).toContainText("2 projects · 1 category · depth-aware experimental renderer");
  await expect(page.locator("#galaxy3d")).toBeVisible();

  const snapshot = await page.evaluate(() => window.ProjectMapThreejsLab?.snapshot());
  expect(snapshot).toEqual({ username: "example", repositories: 2, groups: 1, renderer: "threejs-cosmic", experimental: true });
  const backingStore = await page.locator("#galaxy3d").evaluate((canvas) => ({ width: canvas.width, height: canvas.height }));
  expect(backingStore.width).toBeGreaterThan(0);
  expect(backingStore.height).toBeGreaterThan(0);

  const [statusBox, canvasBox] = await Promise.all([
    page.locator("#status").boundingBox(),
    page.locator("#galaxy3d").boundingBox(),
  ]);
  expect(statusBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  expect(statusBox.y).toBeGreaterThan(canvasBox.y + canvasBox.height * 0.7);

  await page.screenshot({ path: ".tmp/playwright-visual/threejs-lab-chromium.png", fullPage: true });
});

test("Three.js status filtering uses structural projection and prunes an empty owned category", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Real Three.js state projection is exercised in Chromium.");
  await installGraph(page);
  await page.goto("/three/?username=example");
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });

  const roboticsLabel = page.locator("#threeLabels .three-label", { hasText: "Robotics" });
  await expect(roboticsLabel).toBeVisible();
  await page.getByRole("button", { name: "Original" }).click();
  await expect(page.locator("#resultCount")).toHaveText("1 / 2 projects");
  await expect(roboticsLabel).toBeHidden();
});

test("Three.js shared admission fails closed on incomplete Contributed provenance", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Shared graph admission is exercised once in Chromium.");
  const malformed = structuredClone(graph);
  delete malformed.externalContributions;
  await installGraph(page, malformed);
  await page.goto("/three/?username=example");
  await expect(page.locator("#error")).toHaveClass(/visible/, { timeout: 20_000 });
  await expect(page.locator("#errorText")).toContainText("static project graph is missing or did not pass validation");
});

test.describe("mobile Three.js happy-path evidence", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });

  test("Three.js lab renders at a phone viewport with bounded backing-store density", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Mobile GPU evidence is kept deterministic in Chromium; WebKit remains fallback-only in CI.");
    await mkdir(".tmp/playwright-visual", { recursive: true });
    await installGraph(page);

    await page.goto("/three/?username=example");
    await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });
    await expect(page.locator("#galaxy3d")).toBeVisible();

    const metrics = await page.locator("#galaxy3d").evaluate((canvas) => {
      const rect = canvas.getBoundingClientRect();
      return {
        cssWidth: rect.width,
        cssHeight: rect.height,
        backingWidth: canvas.width,
        backingHeight: canvas.height,
        devicePixelRatio: window.devicePixelRatio,
        viewportWidth: window.innerWidth,
        pageScrollWidth: document.documentElement.scrollWidth,
      };
    });

    expect(metrics.devicePixelRatio).toBe(3);
    expect(metrics.viewportWidth).toBe(390);
    expect(metrics.cssWidth).toBeGreaterThan(0);
    expect(metrics.cssHeight).toBeGreaterThan(0);
    expect(metrics.backingWidth).toBeGreaterThan(0);
    expect(metrics.backingHeight).toBeGreaterThan(0);
    expect(metrics.backingWidth).toBeLessThanOrEqual(Math.ceil(metrics.cssWidth * 1.05));
    expect(metrics.backingHeight).toBeLessThanOrEqual(Math.ceil(metrics.cssHeight * 1.05));
    expect(metrics.pageScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);

    const [statusBox, canvasBox] = await Promise.all([
      page.locator("#status").boundingBox(),
      page.locator("#galaxy3d").boundingBox(),
    ]);
    expect(statusBox).not.toBeNull();
    expect(canvasBox).not.toBeNull();
    expect(statusBox.y).toBeGreaterThan(canvasBox.y + canvasBox.height * 0.7);

    await page.screenshot({ path: ".tmp/playwright-visual/threejs-lab-mobile-chromium.png", fullPage: true });
  });
});
