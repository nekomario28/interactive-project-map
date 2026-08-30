import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-26T00:00:00Z",
  repositoryCount: 1,
  groupCount: 1,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:systems", label: "Systems", type: "group", repositoryCount: 1 },
    { id: "repository:project", label: "project", repositoryName: "project", type: "repository", url: "https://github.com/example/project", description: "fixture", language: "JavaScript", topics: [], stars: 1, forks: 0, fork: false, archived: false, relation: "owned", updatedAt: "2026-08-25T00:00:00Z", groupId: "systems", groupLabel: "Systems" },
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

test.describe("Canvas uses native device density without a user quality mode", () => {
  test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 3 });

  test("legacy render query values no longer change Canvas backing density", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Backing-store density is checked once in Chromium.");
    await installGraph(page);

    await page.goto("/u/?username=example&style=galaxy-hybrid");
    await expect(page.locator("#status")).toBeHidden({ timeout: 20_000 });
    const baseline = await canvasMetrics(page);

    await page.goto("/u/?username=example&style=galaxy-hybrid&render=low");
    await expect(page.locator("#status")).toBeHidden({ timeout: 20_000 });
    const legacyLow = await canvasMetrics(page);

    expect(baseline.devicePixelRatio).toBe(3);
    expect(baseline.policy.mode).toBe("native");
    expect(baseline.policy.pixelRatio).toBe(3);
    expect(baseline.ratioX).toBeGreaterThan(2.9);
    expect(baseline.ratioY).toBeGreaterThan(2.9);
    expect(legacyLow.policy.mode).toBe("native");
    expect(legacyLow.policy.pixelRatio).toBe(3);
    expect(Math.abs(legacyLow.ratioX - baseline.ratioX)).toBeLessThan(0.02);
    expect(Math.abs(legacyLow.ratioY - baseline.ratioY)).toBeLessThan(0.02);
  });

  test("mobile Canvas also stays native instead of exposing Auto/High/Low modes", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Mobile backing-store density is checked once in Chromium.");
    await page.setViewportSize({ width: 390, height: 844 });
    await installGraph(page);
    await page.goto("/u/?username=example&style=galaxy-hybrid&render=auto");
    await expect(page.locator("#status")).toBeHidden({ timeout: 20_000 });
    const metrics = await canvasMetrics(page);
    expect(metrics.devicePixelRatio).toBe(3);
    expect(metrics.policy.mode).toBe("native");
    expect(metrics.policy.pixelRatio).toBe(3);
    expect(metrics.ratioX).toBeGreaterThan(2.9);
    expect(metrics.ratioY).toBeGreaterThan(2.9);
  });
});
