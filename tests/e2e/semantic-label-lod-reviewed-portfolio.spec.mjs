import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

async function reviewedPortfolioGraph() {
  const assignments = JSON.parse(await readFile(resolve("docs/semantic-evaluation-nekomario28.standard-v1.json"), "utf8"));
  const taxonomy = JSON.parse(await readFile(resolve("data/standard-taxonomy.v1.json"), "utf8"));
  const categoryLabels = new Map(taxonomy.categories.map((category) => [category.id, category.label]));
  const repositoryEntries = Object.entries(assignments.repositories);
  const categoryIds = [...new Set(repositoryEntries.map(([, assignment]) => assignment.categoryId))];
  const owner = {
    id: "user:nekomario28",
    label: "nekomario28",
    type: "owner",
    url: "https://github.com/nekomario28",
  };
  const groups = categoryIds.map((categoryId) => ({
    id: `group:${categoryId}`,
    label: categoryLabels.get(categoryId) || categoryId,
    type: "group",
    repositoryCount: repositoryEntries.filter(([, assignment]) => assignment.categoryId === categoryId).length,
  }));
  const repos = repositoryEntries.map(([name, assignment]) => ({
    id: `repository:${name}`,
    label: name,
    type: "repository",
    url: `https://github.com/nekomario28/${name}`,
    description: `${name} reviewed public portfolio repository`,
    language: null,
    topics: assignment.secondaryTags || [],
    stars: 0,
    forks: 0,
    fork: false,
    archived: false,
    updatedAt: assignments.reviewedAt || "2026-08-20",
    groupId: assignment.categoryId,
    groupLabel: categoryLabels.get(assignment.categoryId) || assignment.categoryId,
    searchFacets: assignment.secondaryTags || [],
  }));
  return {
    owner: "nekomario28",
    generatedAt: `${assignments.reviewedAt || "2026-08-20"}T00:00:00Z`,
    repositoryCount: repos.length,
    groupCount: groups.length,
    nodes: [owner, ...groups, ...repos],
    edges: [
      ...groups.map((group) => ({ source: owner.id, target: group.id, type: "ownership" })),
      ...repos.map((repo) => ({ source: `group:${repo.groupId}`, target: repo.id, type: "membership" })),
    ],
  };
}

async function installReviewedGraph(page) {
  const graph = await reviewedPortfolioGraph();
  await page.route("https://raw.githubusercontent.com/nekomario28/nekomario28/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
  return graph;
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

test("reviewed portfolio keeps repository text out of overview and reveals it on demand", async ({ page }) => {
  const outDir = resolve(".tmp/playwright-visual/semantic-label-lod-reviewed-portfolio");
  await mkdir(outDir, { recursive: true });
  await page.setViewportSize({ width: 960, height: 600 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const graph = await installReviewedGraph(page);
  await page.goto("/u/?username=nekomario28&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ProjectMapAdaptiveLabels?.snapshot().mode)).toBe("semantic-lod-motion");
  const geometry = await nodeGeometry(page);

  await setZoomAndSettle(page, 0.80);
  const overview = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
  expect(overview.repoCount).toBe(graph.repositoryCount);
  expect(overview.repoBudget).toBe(0);
  expect(overview.repoLabels).toBe(0);
  expect(overview.totalLabels).toBeGreaterThan(0);
  await page.locator("#galaxy").screenshot({ path: resolve(outDir, "overview.png") });

  await setZoomAndSettle(page, 1.35);
  const middle = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
  expect(middle.repoBudget).toBeGreaterThan(0);
  expect(middle.repoLabels).toBeGreaterThan(0);
  expect(middle.repoLabels).toBeLessThan(graph.repositoryCount);
  await page.locator("#galaxy").screenshot({ path: resolve(outDir, "middle.png") });

  await page.locator("#search").fill("FTBPublicClaims");
  await expect.poll(() => page.evaluate(() => window.ProjectMapSearchContext?.snapshot().directRepositoryIds)).toContain("repository:FTBPublicClaims");
  await setZoomAndSettle(page, 0.80);
  const search = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
  expect(search.repoBudget).toBe(0);
  expect(search.placedRepositoryIds).toContain("repository:FTBPublicClaims");
  await page.locator("#galaxy").screenshot({ path: resolve(outDir, "search-FTBPublicClaims.png") });
  await page.locator("#search").fill("");

  await setZoomAndSettle(page, 1.35);
  const settled = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
  expect(settled.cameraMoving).toBe(false);
  await page.locator("#galaxy").screenshot({ path: resolve(outDir, "motion-settled.png") });

  const moving = await page.evaluate(() => {
    state.pan.x += 0.3;
    draw();
    return window.ProjectMapAdaptiveLabels.snapshot();
  });
  expect(moving.cameraMoving).toBe(true);
  await page.locator("#galaxy").screenshot({ path: resolve(outDir, "motion-moving.png") });
  await page.waitForTimeout(220);
  await page.evaluate(() => draw());
  expect((await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot())).cameraMoving).toBe(false);
  expect(await nodeGeometry(page)).toEqual(geometry);

  await writeFile(resolve(outDir, "evidence.json"), `${JSON.stringify({
    repositoryCount: graph.repositoryCount,
    overview: { repoBudget: overview.repoBudget, repoLabels: overview.repoLabels },
    middle: { repoBudget: middle.repoBudget, repoLabels: middle.repoLabels },
    search: { repoBudget: search.repoBudget, repoLabels: search.repoLabels, targetVisible: search.placedRepositoryIds.includes("repository:FTBPublicClaims") },
  }, null, 2)}\n`, "utf8");
});
