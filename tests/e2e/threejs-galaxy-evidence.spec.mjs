import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

function makeGalaxyGraph() {
  const categories = ["ai", "robotics", "systems", "games", "science", "tools"];
  const nodes = [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
  ];
  const edges = [];

  for (const [categoryIndex, category] of categories.entries()) {
    const label = category[0].toUpperCase() + category.slice(1);
    const groupId = `group:${category}`;
    nodes.push({ id: groupId, label, type: "group", repositoryCount: 2 });
    edges.push({ source: "user:example", target: groupId, type: "ownership" });

    for (let repoIndex = 1; repoIndex <= 2; repoIndex += 1) {
      const repositoryName = `${category}-${repoIndex}`;
      const id = `repository:${repositoryName}`;
      nodes.push({
        id,
        label: repositoryName,
        type: "repository",
        url: `https://github.com/example/${repositoryName}`,
        description: `${label} Galaxy evidence repository ${repoIndex}`,
        language: categoryIndex % 2 === 0 ? "TypeScript" : "Rust",
        stars: 3 + categoryIndex * 4 + repoIndex,
        forks: repoIndex - 1,
        fork: false,
        archived: false,
        relation: "owned",
        repositoryName,
        groupId: category,
        groupLabel: label,
        topics: [category, "galaxy-evidence"],
        updatedAt: `2026-08-${String(20 + categoryIndex).padStart(2, "0")}T00:00:00Z`,
      });
      edges.push({ source: groupId, target: id, type: "membership" });
    }
  }

  for (const [index, owner] of ["outside-one", "outside-two"].entries()) {
    const repositoryName = `shared-${index + 1}`;
    const id = `repository:${owner}/${repositoryName}`;
    nodes.push({
      id,
      label: `${owner}/${repositoryName}`,
      type: "repository",
      url: `https://github.com/${owner}/${repositoryName}`,
      description: "External contributed Galaxy evidence repository",
      language: "Python",
      stars: 20 + index,
      forks: 2,
      fork: false,
      archived: false,
      relation: "contributed",
      repositoryOwner: owner,
      repositoryName,
      topics: ["external", "galaxy-evidence"],
      updatedAt: "2026-08-26T00:00:00Z",
      contribution: {
        commits: 3 + index,
        pullRequests: 2,
        mergedPullRequests: 1,
        commitsTruncated: false,
        pullRequestsTruncated: false,
      },
    });
    edges.push({ source: "user:example", target: id, type: "contribution" });
  }

  return {
    owner: "example",
    generatedAt: "2026-08-26T00:00:00Z",
    nodes,
    edges,
    externalContributions: {
      window: { from: "2026-07-01T00:00:00Z", to: "2026-08-26T00:00:00Z" },
      cap: 12,
      candidateRepositories: 2,
      includedRepositories: 2,
      omittedRepositories: 0,
      truncatedRepositories: 0,
    },
  };
}

test("Galaxy 3D emits rich multi-category rendered evidence", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "One deterministic Chromium render is enough; WebKit keeps the broader smoke suite.");
  await mkdir(".tmp/playwright-visual", { recursive: true });
  const graph = makeGalaxyGraph();
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });

  await page.goto("/three/?username=example&style3d=galaxy&motion=off");
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });
  await expect(page.locator("#threeStyle")).toHaveValue("galaxy");
  await expect(page.locator('body[data-map-style="threejs-galaxy"]')).toHaveCount(1);
  await expect(page.locator('body[data-galaxy-central-structure="bulge"]')).toHaveCount(1);
  await expect(page.locator('body[data-galaxy-disc-texture="procedural-haze-v2"]')).toHaveCount(1);
  await expect(page.locator("#resultCount")).toHaveText("14 / 14 projects");
  await expect(page.locator('[data-status-filter="original"]')).toHaveText("Original 12");
  await expect(page.locator('[data-status-filter="contributed"]')).toHaveText("Contributed 2");
  await expect(page.locator("#threeLabels .three-label-group")).toHaveCount(6);

  const snapshot = await page.evaluate(() => window.ProjectMapThreejsLab?.snapshot());
  expect(snapshot).toEqual({
    username: "example",
    repositories: 14,
    groups: 6,
    renderer: "threejs-galaxy",
    style: "galaxy",
    experimental: true,
  });

  const canvas = await page.locator("#galaxy3d").screenshot();
  expect(canvas.byteLength).toBeGreaterThan(10_000);
  await page.screenshot({
    path: ".tmp/playwright-visual/threejs-galaxy-rich-chromium.png",
    fullPage: true,
  });
});
