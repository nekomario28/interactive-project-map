import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const POLICIES = ["current", "overview-off", "semantic-lod", "semantic-motion"];

function fixtureGraph() {
  const owner = { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" };
  const groupNames = ["Robotics & Automation", "AI & ML", "Games & Simulation", "Web & Tools"];
  const groups = groupNames.map((label, index) => ({
    id: `group:group-${index}`,
    label,
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
      description: `Repository ${suffix} used to compare semantic label disclosure`,
      language: index % 2 === 0 ? "TypeScript" : "Python",
      topics: ["visualization", `group-${groupIndex}`],
      stars: Math.max(0, 90 - index),
      forks: index % 5,
      fork: index % 7 === 0,
      archived: false,
      updatedAt: "2026-08-21T00:00:00Z",
      groupId: `group-${groupIndex}`,
      groupLabel: groupNames[groupIndex],
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

function symmetricDifferenceSize(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  let count = 0;
  for (const value of left) if (!right.has(value)) count += 1;
  for (const value of right) if (!left.has(value)) count += 1;
  return count;
}

test("semantic label LOD policies preserve geometry and produce comparable disclosure evidence", async ({ page }) => {
  const outDir = resolve(".tmp/playwright-visual/label-lod-comparison");
  await mkdir(outDir, { recursive: true });
  await page.setViewportSize({ width: 960, height: 600 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installGraph(page);

  const evidence = {};
  for (const [index, policy] of POLICIES.entries()) {
    await page.goto(`/u/?username=example&style=galaxy-systems&labelPolicy=${policy}`);
    await expect(page.locator("#status")).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.ProjectMapAdaptiveLabels?.snapshot().active)).toBe(true);
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

    const targetId = "repository:project-063";
    await page.locator("#search").fill("project-063-descriptive-name");
    await expect.poll(() => page.evaluate(() => window.ProjectMapSearchContext?.snapshot().directRepositoryIds)).toEqual([targetId]);
    await setZoomAndSettle(page, 0.80);
    const search = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
    expect(search.placedRepositoryIds).toContain(targetId);
    await page.locator("#galaxy").screenshot({ path: resolve(outDir, `${index + 1}-${policy}-search.png`) });
    await page.locator("#search").fill("");

    const churnSamples = [];
    let previous = [];
    let totalChurn = 0;
    for (const zoom of [0.80, 0.90, 1.00, 1.10, 1.20, 1.35, 1.50, 1.70, 2.00]) {
      await setZoomAndSettle(page, zoom);
      const snapshot = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
      const churn = symmetricDifferenceSize(previous, snapshot.placedRepositoryIds);
      totalChurn += churn;
      churnSamples.push({ zoom, repoLabels: snapshot.repoLabels, repoBudget: snapshot.repoBudget, churn, ids: snapshot.placedRepositoryIds });
      previous = snapshot.placedRepositoryIds;
    }

    expect(await nodeGeometry(page)).toEqual(geometry);
    evidence[policy] = {
      overview: { repoLabels: overview.repoLabels, repoBudget: overview.repoBudget },
      middle: { repoLabels: middle.repoLabels, repoBudget: middle.repoBudget },
      near: { repoLabels: near.repoLabels, repoBudget: near.repoBudget },
      search: { repoLabels: search.repoLabels, targetVisible: search.placedRepositoryIds.includes(targetId) },
      totalChurn,
      churnSamples,
    };
  }

  expect(evidence.current.overview.repoLabels).toBeGreaterThan(0);
  expect(evidence["overview-off"].overview.repoLabels).toBe(0);
  expect(evidence["semantic-lod"].overview.repoLabels).toBeLessThan(evidence.current.overview.repoLabels);
  expect(evidence["semantic-motion"].overview.repoLabels).toBeLessThan(evidence.current.overview.repoLabels);
  expect(evidence["semantic-lod"].near.repoLabels).toBeGreaterThan(evidence["semantic-lod"].overview.repoLabels);
  expect(evidence["semantic-motion"].near.repoLabels).toBeGreaterThan(evidence["semantic-motion"].overview.repoLabels);

  await writeFile(resolve(outDir, "label-lod-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
});

test("semantic-motion marks camera movement and settles without changing nodes", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 600 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installGraph(page);
  await page.goto("/u/?username=example&style=galaxy-systems&labelPolicy=semantic-motion");
  await expect(page.locator("#status")).toBeHidden();
  await setZoomAndSettle(page, 1.50);
  const before = await nodeGeometry(page);

  const moving = await page.evaluate(() => {
    state.pan.x += 24;
    draw();
    return window.ProjectMapAdaptiveLabels.snapshot();
  });
  expect(moving.cameraMoving).toBe(true);

  await page.waitForTimeout(220);
  await page.evaluate(() => draw());
  const settled = await page.evaluate(() => window.ProjectMapAdaptiveLabels.snapshot());
  expect(settled.cameraMoving).toBe(false);
  expect(await nodeGeometry(page)).toEqual(before);
});
