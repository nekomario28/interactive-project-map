import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-22T00:00:00.000Z",
  repositoryCount: 1,
  groupCount: 1,
  contributedRepositoryCount: 1,
  externalContributions: {
    window: { from: "2025-08-22T00:00:00.000Z", to: "2026-08-22T00:00:00.000Z" },
    cap: 4,
    candidateRepositories: 1,
    includedRepositories: 1,
    omittedRepositories: 0,
    truncatedRepositories: 0,
  },
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics-automation", label: "Robotics & Automation", type: "group", repositoryCount: 1 },
    {
      id: "repository:owned-project",
      label: "owned-project",
      type: "repository",
      url: "https://github.com/example/owned-project",
      description: "owned robotics project",
      language: "Python",
      topics: ["robotics"],
      stars: 2,
      forks: 0,
      fork: false,
      archived: false,
      updatedAt: "2026-08-20T00:00:00.000Z",
      groupId: "robotics-automation",
      groupLabel: "Robotics & Automation",
    },
    {
      id: "repository:outside/project",
      label: "outside/project",
      type: "repository",
      relation: "contributed",
      repositoryOwner: "outside",
      repositoryName: "project",
      url: "https://github.com/outside/project",
      description: "external robotics contribution",
      language: "Rust",
      topics: ["robotics", "contribution"],
      stars: 20,
      forks: 4,
      fork: true,
      archived: true,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2026-08-18T00:00:00.000Z",
      contribution: {
        commits: 2,
        pullRequests: 3,
        mergedPullRequests: 1,
        commitsTruncated: false,
        pullRequestsTruncated: false,
      },
    },
  ],
  edges: [
    { source: "user:example", target: "group:robotics-automation", type: "ownership" },
    { source: "group:robotics-automation", target: "repository:owned-project", type: "membership" },
    { source: "user:example", target: "repository:outside/project", type: "contribution" },
  ],
};

async function installGraph(page, value = graph) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(value) });
  });
}

function watchBrowserErrors(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
  return failures;
}

test("shared Galaxy keeps Contributed distinct from fork/archive through filter, search and details", async ({ page }) => {
  await installGraph(page);
  const browserErrors = watchBrowserErrors(page);
  await page.goto("/u/?username=example&style=galaxy-hybrid");
  await expect(page.locator("#status")).toBeHidden();

  const contributedButton = page.locator('[data-status-filter="contributed"]');
  await expect(contributedButton).toHaveText("Contributed 1");
  await expect(contributedButton).toHaveAttribute("aria-pressed", "true");

  const initial = await page.evaluate(() => ({
    view: window.ProjectMapViewState.snapshot(),
    contributed: window.ProjectMapContributedViewer.snapshot(),
  }));
  expect(initial.view.statusCounts).toMatchObject({ original: 1, fork: 0, archived: 0, contributed: 1 });
  expect(initial.view.statuses).toContain("contributed");
  expect(initial.contributed.contributedRepositories).toEqual(["repository:outside/project"]);
  expect(initial.contributed.contributionEdges).toEqual([
    { source: "user:example", target: "repository:outside/project", type: "contribution" },
  ]);

  await page.locator("#search").fill("outside/project");
  await page.locator("#search").press("ArrowDown");
  await expect(page.locator("#detailsTitle")).toHaveText("outside/project");
  await expect(page.locator("#detailsMeta")).toContainText("Contributed");
  await expect(page.locator("#detailsMeta")).toContainText("External owner");
  await expect(page.locator("#detailsMeta")).toContainText("outside");
  await expect(page.locator("#detailsMeta")).toContainText("Pull requests");
  await expect(page.locator("#detailsMeta")).toContainText("3");
  await expect(page.locator("#detailsMeta")).toContainText("Source flags");
  await expect(page.locator("#detailsMeta")).toContainText("fork · archived");

  const search = await page.evaluate(() => window.ProjectMapSearchContext.snapshot());
  expect(search.directRepositoryIds).toEqual(["repository:outside/project"]);

  await contributedButton.click();
  await expect(contributedButton).toHaveAttribute("aria-pressed", "false");
  const hidden = await page.evaluate(() => window.ProjectMapViewState.snapshot());
  expect(hidden.statuses).not.toContain("contributed");
  expect(hidden.statusCounts.contributed).toBe(1);
  await expect(page).toHaveURL(/status=original/);

  await contributedButton.click();
  await expect(contributedButton).toHaveAttribute("aria-pressed", "true");
  expect(browserErrors).toEqual([]);
});

test("shared viewer fails closed on malformed Contributed identity", async ({ page }) => {
  const malformed = structuredClone(graph);
  malformed.nodes.find((node) => node.relation === "contributed").url = "https://github.com/someone-else/project";
  await installGraph(page, malformed);
  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#error")).toHaveClass(/visible/);
  await expect(page.locator("#errorText")).toContainText("graph.json failed validation");
});
