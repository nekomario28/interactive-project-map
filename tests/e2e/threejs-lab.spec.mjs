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

function querySnapshot(href) {
  const url = new URL(href);
  return Object.fromEntries([...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

test("isolated Three.js lab route fails closed without a username and exposes no quality switch", async ({ page }) => {
  await page.goto("/three/");

  await expect(page.locator("body")).toHaveAttribute("data-map-style", "threejs-cosmic");
  await expect(page.locator("#error")).toHaveClass(/visible/);
  await expect(page.locator("#errorText")).toContainText("Add ?username=YOUR_GITHUB_USERNAME");
  await expect(page.locator("#fallbackLink")).toHaveAttribute("href", "../u/");
  await expect(page.locator("#twoDLink")).toHaveAttribute("href", "../u/");
  await expect(page.locator("[data-status-filter]")).toHaveCount(4);
  await expect(page.locator("#renderDensityToggle")).toHaveCount(0);
  await expect(page.locator("#qualityToggle")).toHaveCount(0);
});

test("engine failure preserves transferable state in the 2D fallback", async ({ page }) => {
  await page.route("**/vendor/three-0.185.1.module.min.js", async (route) => route.abort());
  await page.goto("/three/?username=example&q=rust&status=c&motion=off&activity=1&focus=repository%3Aalpha&depth=2&quality=1");

  await expect(page.locator("#error")).toHaveClass(/visible/);
  await expect(page.locator("#errorText")).toContainText("pinned Three.js module could not be loaded");
  const hrefs = await page.evaluate(() => ({
    twoD: document.getElementById("twoDLink").href,
    fallback: document.getElementById("fallbackLink").href,
  }));
  const expected = {
    activity: "1",
    depth: "2",
    focus: "repository:alpha",
    motion: "off",
    q: "rust",
    quality: "1",
    status: "contributed",
    username: "example",
  };
  expect(querySnapshot(hrefs.twoD)).toEqual(expected);
  expect(querySnapshot(hrefs.fallback)).toEqual(expected);
});

test("Three.js lab renders the happy-path scene and emits Chromium evidence", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "GPU render evidence is collected once in Chromium; WebKit keeps the fallback smoke above.");
  await mkdir(".tmp/playwright-visual", { recursive: true });
  await installGraph(page);

  await page.goto("/three/?username=example");
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });
  await expect(page.locator("#subtitle")).toContainText("2 projects · 1 category · depth-aware experimental renderer");
  await expect(page.locator("#galaxy3d")).toBeVisible();
  await expect(page.locator("#renderDensityToggle")).toHaveCount(0);
  await expect(page.locator('[data-status-filter="original"]')).toHaveText("Original 1");
  await expect(page.locator('[data-status-filter="contributed"]')).toHaveText("Contributed 1");
  await expect(page.locator('[data-status-filter="fork"]')).toHaveText("Fork 0");
  await expect(page.locator('[data-status-filter="fork"]')).toBeDisabled();
  await expect(page.locator('[data-status-filter="archived"]')).toHaveText("Archived 0");
  await expect(page.locator('[data-status-filter="archived"]')).toBeDisabled();

  const snapshot = await page.evaluate(() => window.ProjectMapThreejsLab?.snapshot());
  expect(snapshot).toEqual({ username: "example", repositories: 2, groups: 1, renderer: "threejs-cosmic", style: "cosmic", experimental: true });
  const backingStore = await page.locator("#galaxy3d").evaluate((canvas) => ({
    width: canvas.width,
    height: canvas.height,
    cssWidth: canvas.getBoundingClientRect().width,
    cssHeight: canvas.getBoundingClientRect().height,
  }));
  expect(backingStore.width).toBeGreaterThan(0);
  expect(backingStore.height).toBeGreaterThan(0);
  expect(backingStore.width).toBeLessThanOrEqual(Math.ceil(backingStore.cssWidth * 1.46));
  expect(backingStore.height).toBeLessThanOrEqual(Math.ceil(backingStore.cssHeight * 1.46));

  const [statusBox, canvasBox] = await Promise.all([
    page.locator("#status").boundingBox(),
    page.locator("#galaxy3d").boundingBox(),
  ]);
  expect(statusBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  expect(statusBox.y).toBeGreaterThan(canvasBox.y + canvasBox.height * 0.7);

  await page.screenshot({ path: ".tmp/playwright-visual/threejs-lab-chromium.png", fullPage: true });
});

test("legacy render query is discarded and transferable state remains intact", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Real Three.js state transfer is exercised in Chromium.");
  await installGraph(page);
  await page.goto("/three/?username=example&q=rust&status=c&motion=off&activity=1&focus=repository%3Aoutside%2Fbeta&depth=2&quality=1&render=low");
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });

  await expect(page.locator("#search")).toHaveValue("rust");
  await expect(page.locator('[data-status-filter="original"]')).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator('[data-status-filter="contributed"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-status-filter="fork"]')).toBeDisabled();
  await expect(page.locator('[data-status-filter="archived"]')).toBeDisabled();
  await expect(page.locator("#motionToggle")).toHaveText("Motion Off");
  await expect(page.locator("#renderDensityToggle")).toHaveCount(0);
  await expect(page.locator("#resultCount")).toHaveText("1 / 2 projects");

  const state = await page.evaluate(() => ({
    current: location.href,
    twoD: document.getElementById("twoDLink").href,
  }));
  expect(querySnapshot(state.current)).toEqual({
    activity: "1",
    depth: "2",
    focus: "repository:outside/beta",
    motion: "off",
    q: "rust",
    quality: "1",
    status: "contributed",
    username: "example",
  });
  expect(querySnapshot(state.twoD)).toEqual({
    activity: "1",
    depth: "2",
    focus: "repository:outside/beta",
    motion: "off",
    q: "rust",
    quality: "1",
    status: "contributed",
    username: "example",
  });
});

test("Three.js status filtering uses structural projection and prunes an empty owned category", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Real Three.js state projection is exercised once in Chromium.");
  await installGraph(page);
  await page.goto("/three/?username=example");
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });

  const roboticsLabel = page.locator("#threeLabels .three-label", { hasText: "Robotics" });
  await expect(roboticsLabel).toBeVisible();
  await page.locator('[data-status-filter="original"]').click();
  await expect(page.locator("#resultCount")).toHaveText("1 / 2 projects");
  await expect(roboticsLabel).toBeHidden();
  const current = new URL(page.url());
  expect(current.searchParams.get("status")).toBe("contributed");
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

  test("Three.js lab automatically bounds backing-store density at a phone viewport", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Mobile GPU evidence is kept deterministic in Chromium; WebKit remains fallback-only in CI.");
    await mkdir(".tmp/playwright-visual", { recursive: true });
    await installGraph(page);

    await page.goto("/three/?username=example");
    await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });
    await expect(page.locator("#galaxy3d")).toBeVisible();
    await expect(page.locator("#renderDensityToggle")).toHaveCount(0);

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
