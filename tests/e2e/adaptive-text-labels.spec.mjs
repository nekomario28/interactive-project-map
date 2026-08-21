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
      description: `Repository ${suffix} used to exercise adaptive label placement`,
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

function geometrySnapshot() {
  return () => ({
    zoom: state.zoom,
    pan: { ...state.pan },
    nodes: state.nodes.map((node) => [node.id, node.x, node.y]),
  });
}

for (const style of ["galaxy-systems", "galaxy-hybrid"]) {
  test(`${style}: adaptive text uses live density while layout remains unchanged`, async ({ page }) => {
    await mkdir(resolve(".tmp/playwright-visual/adaptive-labels"), { recursive: true });
    await page.setViewportSize({ width: 960, height: 600 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installGraph(page);
    await page.goto(`/u/?username=example&style=${style}`);
    await expect(page.locator("#status")).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.ProjectMapAdaptiveLabels?.snapshot().active)).toBe(true);

    const before = await page.evaluate(geometrySnapshot());
    const initial = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
    expect(initial.style).toBe(style);
    expect(initial.repoCount).toBe(64);
    expect(initial.repoBudget).toBeGreaterThan(0);
    expect(initial.repoBudget).toBeLessThanOrEqual(64);
    expect(initial.repoLabels).toBeGreaterThan(0);
    expect(initial.repoLabels).toBeLessThanOrEqual(64);
    expect(initial.totalLabels).toBeGreaterThan(initial.repoLabels);
    expect(Object.values(initial.anchors).reduce((sum, value) => sum + value, 0)).toBe(initial.totalLabels);
    expect(await page.evaluate(geometrySnapshot())).toEqual(before);

    await page.locator("#galaxy").screenshot({ path: resolve(`.tmp/playwright-visual/adaptive-labels/${style}-overview.png`) });

    const targetId = "repository:project-063";
    await page.locator("#search").fill("project-063-descriptive-name");
    await expect.poll(() => page.evaluate(() => window.ProjectMapSearchContext?.snapshot().directRepositoryIds)).toEqual([targetId]);
    await expect.poll(() => page.evaluate((id) => window.ProjectMapAdaptiveLabels.snapshot().placedRepositoryIds.includes(id), targetId)).toBe(true);
    expect(await page.evaluate(geometrySnapshot())).toEqual(before);
    await page.locator("#galaxy").screenshot({ path: resolve(`.tmp/playwright-visual/adaptive-labels/${style}-focus.png`) });

    await page.locator("#search").fill("");
    await page.setViewportSize({ width: 520, height: 420 });
    await expect.poll(() => page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot().viewport.width)).toBe(520);
    const compact = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
    expect(compact.repoBudget).toBeLessThanOrEqual(initial.repoBudget);
    expect((await page.evaluate(geometrySnapshot())).nodes).toEqual(before.nodes);
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
