import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-26T00:00:00Z",
  repositoryCount: 1,
  groupCount: 1,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:systems", label: "Systems", type: "group", repositoryCount: 1 },
    { id: "repository:project", label: "project", type: "repository", url: "https://github.com/example/project", description: "fixture", language: "JavaScript", topics: [], stars: 1, forks: 0, fork: false, archived: false, updatedAt: "2026-08-25T00:00:00Z", groupId: "systems", groupLabel: "Systems" },
  ],
  edges: [
    { source: "user:example", target: "group:systems", type: "ownership" },
    { source: "group:systems", target: "repository:project", type: "membership" },
  ],
};

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function canvasMetrics(page) {
  return page.locator("#galaxy").evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    return {
      cssWidth: rect.width,
      cssHeight: rect.height,
      backingWidth: canvas.width,
      backingHeight: canvas.height,
      ratioX: canvas.width / Math.max(1, rect.width),
      ratioY: canvas.height / Math.max(1, rect.height),
      devicePixelRatio: window.devicePixelRatio,
      policy: window.ProjectMapRenderDensity?.snapshot?.({ width: rect.width, devicePixelRatio: window.devicePixelRatio }),
    };
  });
}

test.describe("DPR3 Canvas render density evidence", () => {
  test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 3 });

  test("shared 2D viewer preserves native DPR by default and bounds explicit Auto", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Backing-store density evidence is collected once in Chromium.");
    await installGraph(page);

    await page.goto("/u/?username=example&style=galaxy-hybrid");
    await expect(page.locator("#status")).toBeHidden({ timeout: 20_000 });
    const native = await canvasMetrics(page);
    expect(native.devicePixelRatio).toBe(3);
    expect(native.policy.mode).toBe("native");
    expect(native.policy.pixelRatio).toBe(3);
    expect(native.ratioX).toBeGreaterThan(2.9);
    expect(native.ratioY).toBeGreaterThan(2.9);

    await page.goto("/u/?username=example&style=galaxy-hybrid&render=auto");
    await expect(page.locator("#status")).toBeHidden({ timeout: 20_000 });
    const auto = await canvasMetrics(page);
    expect(auto.policy.mode).toBe("auto");
    expect(auto.policy.pixelRatio).toBe(1.45);
    expect(auto.ratioX).toBeLessThanOrEqual(1.46);
    expect(auto.ratioY).toBeLessThanOrEqual(1.46);
    expect(Math.abs(auto.cssWidth - native.cssWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(auto.cssHeight - native.cssHeight)).toBeLessThanOrEqual(1);
    expect(auto.backingWidth * auto.backingHeight).toBeLessThan(native.backingWidth * native.backingHeight * 0.25);
  });

  test("dedicated Radial consumes the same opt-in Canvas policy", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Dedicated Canvas density evidence is collected once in Chromium.");
    await installGraph(page);
    await page.goto("/radial/?username=example&style=radial&render=auto");
    await expect(page.locator("#status")).toBeHidden({ timeout: 20_000 });
    const metrics = await canvasMetrics(page);
    expect(metrics.devicePixelRatio).toBe(3);
    expect(metrics.policy.mode).toBe("auto");
    expect(metrics.ratioX).toBeLessThanOrEqual(1.46);
    expect(metrics.ratioY).toBeLessThanOrEqual(1.46);
  });

  test("mobile Auto caps Canvas backing store at one CSS pixel per axis", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Mobile Canvas density evidence is collected once in Chromium.");
    await page.setViewportSize({ width: 390, height: 844 });
    await installGraph(page);
    await page.goto("/u/?username=example&style=galaxy-hybrid&render=auto");
    await expect(page.locator("#status")).toBeHidden({ timeout: 20_000 });
    const metrics = await canvasMetrics(page);
    expect(metrics.devicePixelRatio).toBe(3);
    expect(metrics.policy.mode).toBe("auto");
    expect(metrics.policy.pixelRatio).toBe(1);
    expect(metrics.ratioX).toBeLessThanOrEqual(1.01);
    expect(metrics.ratioY).toBeLessThanOrEqual(1.01);
    const width = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }));
    expect(width.scroll).toBeLessThanOrEqual(width.viewport);
  });
});
