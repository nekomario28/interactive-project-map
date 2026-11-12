import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-11-13T00:00:00Z",
  repositoryCount: 1,
  groupCount: 1,
  nodes: [
    { id: "user:example", type: "owner", label: "example",
      profileStats: { ownedStars: 63, originalRepositories: 1, followers: 20,
        contributedRepositories: 1, mergedPullRequests: 2, commits: 7,
        limitedRepositories: false, limitedContributions: false } },
    { id: "group:apps", type: "group", label: "Apps", repositoryCount: 1 },
    { id: "repository:original", type: "repository", label: "original", url: "https://github.com/example/original",
      description: "", groupId: "apps", groupLabel: "Apps", language: "Rust", topics: [],
      stars: 63, forks: 0, fork: false, archived: false },
    { id: "repository:external/ruff", type: "repository", label: "external/ruff",
      relation: "contributed", repositoryOwner: "external", repositoryName: "ruff",
      url: "https://github.com/external/ruff", forkUrl: "https://github.com/example/ruff",
      language: "Rust", topics: [], stars: 150, forks: 1, fork: false, archived: false,
      contribution: { commits: 7, pullRequests: 3, mergedPullRequests: 2,
        commitsTruncated: false, pullRequestsTruncated: false } },
  ],
  edges: [
    { source: "user:example", target: "group:apps", type: "ownership" },
    { source: "group:apps", target: "repository:original", type: "membership" },
    { source: "user:example", target: "repository:external/ruff", type: "contribution" },
  ],
  contributedRepositoryCount: 1,
  externalContributions: {
    window: { from: "2025-11-13T00:00:00.000Z", to: "2026-11-13T00:00:00.000Z" },
    cap: 4, candidateRepositories: 1, includedRepositories: 1,
    omittedRepositories: 0, truncatedRepositories: 0,
  },
};

test("Galaxy owner planet exposes bounded star-based size and explicit portfolio statistics", async ({ page }) => {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) }));
  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();
  const scaleEvidence = await page.evaluate(() => {
    const owner = state.nodes.find((node) => node.type === "owner");
    return { ownedStars: owner.profileStats?.ownedStars, radius: nodeRadius(owner) };
  });
  expect(scaleEvidence.ownedStars).toBe(63);
  expect(scaleEvidence.radius).toBeGreaterThan(14);
  expect(scaleEvidence.radius).toBeLessThanOrEqual(14 * 1.4);
  await page.evaluate(() => updateDetails(state.nodes.find((node) => node.type === "owner")));
  await expect(page.locator("#detailsMeta")).toContainText("Stars (shown originals)");
  await expect(page.locator("#detailsMeta")).toContainText("Followers");
  await expect(page.locator("#detailsMeta")).toContainText("20");
  await expect(page.locator("#detailsMeta")).toContainText("Featured external projects (365d)");
  await expect(page.locator("#detailsMeta")).toContainText("Merged PRs (featured, 365d)");
});

test("Contributed upstream retains a safe clickable link to the verified personal fork", async ({ page }) => {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) }));
  await page.goto("/u/?username=example&style=galaxy-hybrid");
  await expect(page.locator("#status")).toBeHidden();
  await page.evaluate(() => updateDetails(state.nodes.find((node) => node.relation === "contributed")));
  await expect(page.locator('#detailsMeta a[href="https://github.com/example/ruff"]')).toHaveText("Open your fork");
  expect(await page.evaluate(() => state.nodes.filter((node) => node.type === "repository").length)).toBe(2);
});

test("Galaxy Classic and Hybrid preserve their renderer-local owner radius while scaling by stars", async ({ page }) => {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) }));
  const values = [];
  for (const style of ["galaxy-classic", "galaxy-hybrid", "obsidian"]) {
    await page.goto(`/u/?username=example&style=${style}`);
    await expect(page.locator("#status")).toBeHidden();
    values.push(await page.evaluate(() => {
      const owner = state.nodes.find((node) => node.type === "owner");
      return { radius: nodeRadius(owner), scale: ownerPlanetScale(owner.profileStats) };
    }));
  }
  expect(values[0].radius).toBeCloseTo(8.5 * values[0].scale, 4);
  expect(values[1].radius).toBeCloseTo(24 * values[1].scale, 4);
  expect(values[2].radius).toBeCloseTo(18 * values[2].scale, 4);
  expect(values[0].scale).toBeGreaterThan(1);
});
