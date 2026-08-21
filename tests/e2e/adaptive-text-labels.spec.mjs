import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

function fixtureGraph() {
  const owner = { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" };
  const groups = Array.from({ length: 4 }, (_, index) => ({
    id: `group:group-${index}`,
    label: `Project Group ${index + 1}`,
    type: "group",
    repositoryCount: 16,
  }));
  const repos = Array.from({ length: 64 }, (_, index) => {
    const groupIndex = Math.floor(index / 16);
    const suffix = String(index).padStart(3, "0");
    return {
      id: `repository:project-${suffix}`,
      label: `project-${suffix}-descriptive-name`,
      type: "repository",
      url: `https://github.com/example/project-${suffix}-descriptive-name`,
      description: `Repository ${suffix} used to exercise semantic label disclosure`,
      language: index % 2 === 0 ? "TypeScript" : "Python",
      topics: ["visualization", `group-${groupIndex}`],
      stars: 64 - index,
      forks: index % 5,
      fork: index % 7 === 0,
      archived: false,
      updatedAt: "2026-08-21T00:00:00Z",
      groupId: `group-${groupIndex}`,
      groupLabel: `Project Group ${groupIndex + 1}`,
    };
  });
  const edges = [
    ...groups.map((group) => ({ source: owner.id, target: group.id, type: "ownership" })),
    ...repos.map((repo) => ({ source: `group:${repo.groupId}`, target: repo.id, type: "membership" })),
  ];
  return {
    owner: "example",
    generatedAt: "2026-08-21T00:00:00Z",
    repositoryCount: repos.length,
    groupCount: groups.length,
    nodes: [owner, ...groups, ...repos],
    edges,
  };
}

async function installGraph(page) {
  const graph = fixtureGraph();
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function setZoomAndSettle(page, zoom) {
  await page.evaluate((nextZoom) => {
    state.zoom = nextZoom;
    draw();
  }, zoom);
  await page.waitForTimeout(220);
  await page.evaluate(() => draw());
}

async function nodeGeometry(page) {
  return page.evaluate(() => state.nodes.map((node) => [node.id, node.x, node.y]));
}

for (const style of ["galaxy-systems", "galaxy-hybrid"]) {
  test(`${style}: semantic label LOD preserves the graph while progressively disclosing text`, async ({ page }) => {
    await mkdir(resolve(".tmp/playwright-visual/adaptive-labels"), { recursive: true });
    await page.setViewportSize({ width: 960, height: 600 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installGraph(page);
    await page.goto(`/u/?username=example&style=${style}`);
    await expect(page.locator("#status")).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.ProjectMapAdaptiveLabels?.snapshot().active)).toBe(true);

    const geometry = await nodeGeometry(page);
    const initial = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
    expect(initial.style).toBe(style);
    expect(initial.mode).toBe("semantic-lod-motion");
    expect(initial.repoCount).toBe(64);
    expect(initial.repoBudget).toBeGreaterThanOrEqual(0);
    expect(initial.repoBudget).toBeLessThanOrEqual(64);
    if (initial.repoBudget === 0) expect(initial.repoLabels).toBe(0);
    else expect(initial.repoLabels).toBeLessThanOrEqual(initial.repoBudget);
    expect(initial.totalLabels).toBeGreaterThan(initial.repoLabels);
    expect(Object.values(initial.anchors).reduce((sum, value) => sum + value, 0)).toBe(initial.totalLabels);
    expect(initial.typography.categoryFontSize).toBeGreaterThan(initial.typography.repositoryFontSize * 1.3);
    expect(initial.typography.categoryFontSize).toBeLessThanOrEqual(21);
    expect(initial.typography.categoryToRepositoryRatio).toBeGreaterThan(1.3);
    if (style === "galaxy-systems") {
      expect(initial.typography.categoryCountFontSize).toBeLessThan(initial.typography.categoryFontSize);
    }
    expect(await nodeGeometry(page)).toEqual(geometry);

    await setZoomAndSettle(page, 0.80);
    const far = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
    expect(far.repoBudget).toBe(0);
    expect(far.repoLabels).toBe(0);
    expect(far.eligibleRepositoryIds).toHaveLength(0);
    expect(far.typography.categoryToRepositoryRatio).toBeGreaterThan(1.5);
    expect(await nodeGeometry(page)).toEqual(geometry);
    await page.locator("#galaxy").screenshot({ path: resolve(`.tmp/playwright-visual/adaptive-labels/${style}-overview.png`) });

    await setZoomAndSettle(page, 1.35);
    const middle = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
    expect(middle.repoBudget).toBeGreaterThan(0);
    expect(middle.repoLabels).toBeGreaterThan(0);
    expect(middle.repoLabels).toBeLessThanOrEqual(middle.repoBudget);
    expect(middle.eligibleRepositoryIds.length).toBeGreaterThan(0);
    expect(await nodeGeometry(page)).toEqual(geometry);
    await page.locator("#galaxy").screenshot({ path: resolve(`.tmp/playwright-visual/adaptive-labels/${style}-middle.png`) });

    await setZoomAndSettle(page, 2.10);
    const near = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
    expect(near.repoBudget).toBeGreaterThanOrEqual(middle.repoBudget);
    expect(near.eligibleRepositoryIds.length).toBeGreaterThan(0);
    if (style === "galaxy-systems") expect(near.repoLabels).toBeGreaterThan(0);
    expect(near.typography.categoryToRepositoryRatio).toBeLessThan(far.typography.categoryToRepositoryRatio);
    expect(near.typography.categoryToRepositoryRatio).toBeGreaterThan(1.3);
    expect(await nodeGeometry(page)).toEqual(geometry);

    const targetId = "repository:project-063";
    await page.locator("#search").fill("project-063-descriptive-name");
    await expect.poll(() => page.evaluate(() => window.ProjectMapSearchContext?.snapshot().directRepositoryIds)).toEqual([targetId]);
    await setZoomAndSettle(page, 0.80);
    const search = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
    expect(search.repoBudget).toBe(0);
    expect(search.placedRepositoryIds).toContain(targetId);
    expect(await nodeGeometry(page)).toEqual(geometry);
    await page.locator("#galaxy").screenshot({ path: resolve(`.tmp/playwright-visual/adaptive-labels/${style}-focus.png`) });
    await page.locator("#search").fill("");

    await setZoomAndSettle(page, 1.35);
    const beforeMotion = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
    expect(beforeMotion.cameraMoving).toBe(false);
    const moving = await page.evaluate(() => {
      state.pan.x += 0.3;
      draw();
      return window.ProjectMapAdaptiveLabels.snapshot();
    });
    expect(moving.cameraMoving).toBe(true);
    await page.locator("#galaxy").screenshot({ path: resolve(`.tmp/playwright-visual/adaptive-labels/${style}-moving.png`) });
    await page.waitForTimeout(220);
    await page.evaluate(() => draw());
    expect((await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot())).cameraMoving).toBe(false);
    expect(await nodeGeometry(page)).toEqual(geometry);

    await page.setViewportSize({ width: 520, height: 420 });
    await expect.poll(() => page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot().viewport.width)).toBe(520);
    const compact = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
    expect(compact.repoBudget).toBeLessThanOrEqual(beforeMotion.repoBudget);
    expect(compact.typography.categoryToRepositoryRatio).toBeGreaterThan(1.3);
    expect(await nodeGeometry(page)).toEqual(geometry);
  });
}

test("Galaxy Classic stays on its existing label renderer", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installGraph(page);
  await page.goto("/u/?username=example&style=galaxy-classic");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(window.ProjectMapAdaptiveLabels))).toBe(true);
  expect(await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot().active)).toBe(false);
});
