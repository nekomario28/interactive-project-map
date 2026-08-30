import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-30T00:00:00Z",
  repositoryCount: 2,
  groupCount: 1,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:systems", label: "Systems", type: "group", repositoryCount: 2 },
    { id: "repository:alpha", label: "alpha", repositoryName: "alpha", type: "repository", url: "https://github.com/example/alpha", description: "alpha service", language: "JavaScript", topics: [], stars: 1, forks: 0, fork: false, archived: false, relation: "owned", updatedAt: "2026-08-29T00:00:00Z", groupId: "systems", groupLabel: "Systems" },
    { id: "repository:beta", label: "beta", repositoryName: "beta", type: "repository", url: "https://github.com/example/beta", description: "beta service", language: "Python", topics: [], stars: 2, forks: 0, fork: false, archived: false, relation: "owned", updatedAt: "2026-08-28T00:00:00Z", groupId: "systems", groupLabel: "Systems" },
  ],
  edges: [
    { source: "user:example", target: "group:systems", type: "ownership" },
    { source: "group:systems", target: "repository:alpha", type: "membership" },
    { source: "group:systems", target: "repository:beta", type: "membership" },
  ],
};

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function snapshot(page) {
  await expect.poll(() => page.evaluate(() => typeof window.ProjectMapRenderer?.snapshot === "function")).toBe(true);
  return page.evaluate(() => window.ProjectMapRenderer.snapshot());
}

test.describe("common renderer capability snapshot", () => {
  test.use({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 });

  test("2D and 3D expose the same evidence shape over the same semantic fixture", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Cross-renderer backing-store evidence is sampled once in Chromium.");
    await installGraph(page);

    await page.goto("/u/?username=example&style=galaxy-hybrid&motion=off");
    await expect(page.locator("#status")).toBeHidden({ timeout: 20_000 });
    const twoD = await snapshot(page);

    expect(twoD.version).toBe(1);
    expect(twoD.rendererId).toBe("canvas2d");
    expect(twoD.styleId).toBe("galaxy-hybrid");
    expect(twoD.experimental).toBe(false);
    expect(twoD.semantic).toEqual({ repositories: 2, groups: 1 });
    expect(twoD.selectedId).toBeNull();
    expect(twoD.capabilities.search).toBe(true);
    expect(twoD.capabilities.qualityEvidence).toBe(true);
    expect(twoD.backingStore.pixelRatio).toBeGreaterThan(1.9);

    await page.goto("/three/?username=example&motion=off&style3d=aurora");
    await expect(page.locator("#status")).toContainText("3D scene ready", { timeout: 20_000 });
    const threeD = await snapshot(page);

    expect(Object.keys(threeD)).toEqual(Object.keys(twoD));
    expect(threeD.version).toBe(1);
    expect(threeD.rendererId).toBe("threejs");
    expect(threeD.styleId).toBe("aurora");
    expect(threeD.experimental).toBe(true);
    expect(threeD.semantic).toEqual(twoD.semantic);
    expect(threeD.selectedId).toBeNull();
    expect(threeD.capabilities.search).toBe(true);
    expect(threeD.capabilities.qualityEvidence).toBe(false);
    expect(threeD.backingStore.pixelRatio).toBeGreaterThan(1.4);
    expect(threeD.backingStore.pixelRatio).toBeLessThan(1.46);
  });
});
