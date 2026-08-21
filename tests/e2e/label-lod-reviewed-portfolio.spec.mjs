import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const POLICIES = ["current", "overview-off", "semantic-lod", "semantic-motion"];

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

test("reviewed portfolio keeps overview visual hierarchy while disclosing repository labels progressively", async ({ page }) => {
  const outDir = resolve(".tmp/playwright-visual/label-lod-reviewed-portfolio");
  await mkdir(outDir, { recursive: true });
  await page.setViewportSize({ width: 960, height: 600 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const graph = await installReviewedGraph(page);
  expect(graph.repositoryCount).toBeGreaterThan(0);

  const evidence = { repositoryCount: graph.repositoryCount, policies: {} };
  for (const [index, policy] of POLICIES.entries()) {
    await page.goto(`/u/?username=nekomario28&style=galaxy-systems&labelPolicy=${policy}`);
    await expect(page.locator("#status")).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.ProjectMapAdaptiveLabels?.snapshot().policy)).toBe(policy);
    const geometry = await nodeGeometry(page);

    await setZoomAndSettle(page, 0.80);
    const overview = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
    await page.locator("#galaxy").screenshot({ path: resolve(outDir, `${index + 1}-${policy}-overview.png`) });

    await setZoomAndSettle(page, 1.35);
    const middle = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
    await page.locator("#galaxy").screenshot({ path: resolve(outDir, `${index + 1}-${policy}-middle.png`) });

    await setZoomAndSettle(page, 2.10);
    const near = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
    await page.locator("#galaxy").screenshot({ path: resolve(outDir, `${index + 1}-${policy}-near.png`) });

    await page.locator("#search").fill("FTBPublicClaims");
    await expect.poll(() => page.evaluate(() => window.ProjectMapSearchContext?.snapshot().directRepositoryIds)).toContain("repository:FTBPublicClaims");
    await setZoomAndSettle(page, 0.80);
    const search = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
    expect(search.placedRepositoryIds).toContain("repository:FTBPublicClaims");
    await page.locator("#galaxy").screenshot({ path: resolve(outDir, `${index + 1}-${policy}-search-FTBPublicClaims.png`) });
    await page.locator("#search").fill("");

    evidence.policies[policy] = {
      overview: { repoLabels: overview.repoLabels, repoBudget: overview.repoBudget },
      middle: { repoLabels: middle.repoLabels, repoBudget: middle.repoBudget },
      near: { repoLabels: near.repoLabels, repoBudget: near.repoBudget },
      search: { repoLabels: search.repoLabels, targetVisible: search.placedRepositoryIds.includes("repository:FTBPublicClaims") },
    };
    expect(await nodeGeometry(page)).toEqual(geometry);
  }

  expect(evidence.policies.current.overview.repoLabels).toBeGreaterThan(0);
  expect(evidence.policies["overview-off"].overview.repoLabels).toBe(0);
  expect(evidence.policies["semantic-lod"].overview.repoLabels).toBeLessThan(evidence.policies.current.overview.repoLabels);
  expect(evidence.policies["semantic-motion"].overview.repoLabels).toBeLessThan(evidence.policies.current.overview.repoLabels);
  expect(evidence.policies["semantic-lod"].middle.repoLabels).toBeGreaterThanOrEqual(evidence.policies["semantic-lod"].overview.repoLabels);

  await writeFile(resolve(outDir, "reviewed-portfolio-label-lod-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
});

test("semantic-motion visibly suppresses ordinary text only while camera is moving", async ({ page }) => {
  const outDir = resolve(".tmp/playwright-visual/label-lod-reviewed-portfolio");
  await mkdir(outDir, { recursive: true });
  await page.setViewportSize({ width: 960, height: 600 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installReviewedGraph(page);
  await page.goto("/u/?username=nekomario28&style=galaxy-systems&labelPolicy=semantic-motion");
  await expect(page.locator("#status")).toBeHidden();
  await setZoomAndSettle(page, 1.35);
  const before = await nodeGeometry(page);
  const settled = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
  expect(settled.cameraMoving).toBe(false);
  expect(settled.repoLabels).toBeGreaterThan(0);
  await page.locator("#galaxy").screenshot({ path: resolve(outDir, "semantic-motion-settled.png") });

  const moving = await page.evaluate(() => {
    state.pan.x += 0.3;
    draw();
    return window.ProjectMapAdaptiveLabels.snapshot();
  });
  expect(moving.cameraMoving).toBe(true);
  await page.locator("#galaxy").screenshot({ path: resolve(outDir, "semantic-motion-moving.png") });

  await page.waitForTimeout(220);
  await page.evaluate(() => draw());
  const after = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
  expect(after.cameraMoving).toBe(false);
  expect(await nodeGeometry(page)).toEqual(before);
});
