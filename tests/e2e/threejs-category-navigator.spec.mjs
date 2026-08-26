import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-26T00:00:00Z",
  repositoryCount: 4,
  groupCount: 2,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 2 },
    { id: "group:ai", label: "AI", type: "group", repositoryCount: 1 },
    {
      id: "repository:alpha",
      label: "alpha",
      repositoryName: "alpha",
      type: "repository",
      url: "https://github.com/example/alpha",
      description: "Robot navigation application",
      language: "JavaScript",
      topics: ["navigation"],
      stars: 8,
      forks: 0,
      fork: false,
      archived: false,
      relation: "owned",
      updatedAt: "2026-08-25T00:00:00Z",
      groupId: "robotics",
      groupLabel: "Robotics",
    },
    {
      id: "repository:gamma",
      label: "gamma",
      repositoryName: "gamma",
      type: "repository",
      url: "https://github.com/example/gamma",
      description: "Forked robot controller",
      language: "Rust",
      topics: ["control"],
      stars: 3,
      forks: 1,
      fork: true,
      archived: false,
      relation: "owned",
      updatedAt: "2026-08-24T00:00:00Z",
      groupId: "robotics",
      groupLabel: "Robotics",
    },
    {
      id: "repository:delta",
      label: "delta",
      repositoryName: "delta",
      type: "repository",
      url: "https://github.com/example/delta",
      description: "Archived model experiment",
      language: "Python",
      topics: ["machine-learning"],
      stars: 2,
      forks: 0,
      fork: false,
      archived: true,
      relation: "owned",
      updatedAt: "2026-08-23T00:00:00Z",
      groupId: "ai",
      groupLabel: "AI",
    },
    {
      id: "repository:outside/beta",
      label: "outside/beta",
      repositoryName: "beta",
      repositoryOwner: "outside",
      type: "repository",
      url: "https://github.com/outside/beta",
      description: "External contribution",
      language: "Go",
      topics: ["networking"],
      stars: 5,
      forks: 0,
      fork: false,
      archived: false,
      relation: "contributed",
      updatedAt: "2026-08-22T00:00:00Z",
      contribution: {
        commits: 3,
        pullRequests: 2,
        mergedPullRequests: 1,
        commitsTruncated: false,
        pullRequestsTruncated: false,
      },
    },
  ],
  edges: [
    { source: "user:example", target: "group:robotics", type: "ownership" },
    { source: "user:example", target: "group:ai", type: "ownership" },
    { source: "group:robotics", target: "repository:alpha", type: "membership" },
    { source: "group:robotics", target: "repository:gamma", type: "membership" },
    { source: "group:ai", target: "repository:delta", type: "membership" },
    { source: "user:example", target: "repository:outside/beta", type: "contribution" },
  ],
  externalContributions: {
    window: { from: "2026-07-01T00:00:00Z", to: "2026-08-26T00:00:00Z" },
    cap: 12,
    candidateRepositories: 1,
    includedRepositories: 1,
    omittedRepositories: 0,
    truncatedRepositories: 0,
  },
};

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function openNavigator(page) {
  await expect(page.locator("#categoryNavigatorToggle")).toBeVisible({ timeout: 20_000 });
  await page.locator("#categoryNavigatorToggle").click();
  await expect(page.locator("#categoryNavigator")).toHaveClass(/is-open/);
}

test("Three.js Category Navigator provides accessible selection without mutating Local Graph scope", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Real Three.js navigator selection is exercised once in Chromium.");
  await installGraph(page);
  await page.goto("/three/?username=example");
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });
  await openNavigator(page);

  await expect(page.locator("#categoryNavigatorSummary")).toHaveText("2 categories · 3 owned · 1 external");
  await expect(page.locator('[data-external-contributions="true"]')).toContainText("External contributions");
  await expect(page.locator('[data-external-contributions="true"]')).toContainText("not owned");

  await page.getByRole("button", { name: "Expand Robotics repositories" }).click();
  const alpha = page.locator('[data-repository-id="repository:alpha"]');
  await expect(alpha).toBeVisible();

  const scopeBefore = await page.evaluate(() => window.ProjectMapThreejsLocalGraph.snapshot());
  await alpha.click();
  await expect(page.locator("#detailsTitle")).toHaveText("alpha");
  await expect.poll(() => page.evaluate(() => window.ProjectMapThreejsNavigatorAdapter.snapshot().selectedId)).toBe("repository:alpha");
  const scopeAfter = await page.evaluate(() => window.ProjectMapThreejsLocalGraph.snapshot());
  expect(scopeAfter.nodeIds).toEqual(scopeBefore.nodeIds);
  expect(scopeAfter.edgeIds).toEqual(scopeBefore.edgeIds);

  await page.locator('[data-repository-id="repository:alpha"]').click();
  await expect(page.locator("#detailsTitle")).toHaveText("Project map");
  await expect.poll(() => page.evaluate(() => window.ProjectMapThreejsNavigatorAdapter.snapshot().selectedId)).toBe("");

  await page.getByRole("button", { name: "Robotics", exact: true }).click();
  await expect(page.locator("#detailsTitle")).toHaveText("Robotics");
  await expect.poll(() => page.evaluate(() => window.ProjectMapThreejsNavigatorAdapter.snapshot().selectedId)).toBe("group:robotics");
});

test("Three.js navigator follows shared search/status visibility and keeps Contributed outside owned categories", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Real Three.js navigator search/filter semantics are exercised once in Chromium.");
  await installGraph(page);
  await page.goto("/three/?username=example");
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });
  await openNavigator(page);

  await page.locator("#search").fill("alpha");
  await expect(page.locator('[data-repository-id="repository:alpha"]')).toBeVisible();
  await expect(page.locator('[data-repository-id="repository:alpha"]')).toHaveClass(/is-search-match/);
  await expect(page.getByRole("button", { name: "Collapse Robotics repositories" })).toBeVisible();
  await expect(page.getByRole("button", { name: "AI", exact: true })).toHaveCount(0);
  await expect(page.locator('[data-external-contributions="true"]')).toHaveCount(0);

  await page.locator("#search").fill("");
  await expect(page.locator("#categoryNavigatorSummary")).toHaveText("2 categories · 3 owned · 1 external");
  await page.locator('[data-status-filter="archived"]').click();
  await expect(page.getByRole("button", { name: "AI", exact: true })).toHaveCount(0);
  await expect(page.locator("#categoryNavigatorSummary")).toHaveText("1 categories · 2 owned · 1 external");

  await page.locator("#search").fill("outside");
  const external = page.locator('[data-external-contributions="true"]');
  await expect(external).toBeVisible();
  await expect(external.locator('[data-repository-id="repository:outside/beta"]')).toBeVisible();
  await expect(external.locator('[data-repository-id="repository:outside/beta"]')).toHaveClass(/is-search-match/);
  await expect(page.locator('.category-nav-group:not([data-external-contributions="true"])')).toHaveCount(0);

  const snapshot = await page.evaluate(() => window.ProjectMapThreejsCategoryNavigator.snapshot());
  expect(snapshot.externalRepositoryIds).toEqual(["repository:outside/beta"]);
});
