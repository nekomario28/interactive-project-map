import { expect, test } from "@playwright/test";

const sharedStyles = ["galaxy-classic", "galaxy-systems", "galaxy-hybrid", "obsidian"];
const dedicatedStyles = ["radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"];

const contributedId = "repository:gazebosim/gz-sim";
const graph = {
  owner: "example",
  generatedAt: "2026-08-22T00:00:00Z",
  repositoryCount: 4,
  contributedRepositoryCount: 1,
  groupCount: 3,
  externalContributions: {
    window: { from: "2025-08-22T00:00:00Z", to: "2026-08-22T00:00:00Z" },
    cap: 4,
    candidateRepositories: 1,
    includedRepositories: 1,
    omittedRepositories: 0,
    truncatedRepositories: 0,
  },
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 2 },
    { id: "group:web", label: "Web", type: "group", repositoryCount: 1 },
    { id: "group:legacy", label: "Legacy", type: "group", repositoryCount: 1 },
    { id: "repository:alpha", label: "alpha", type: "repository", url: "https://github.com/example/alpha", language: "Python", fork: false, archived: false, createdAt: "2025-01-01T00:00:00Z", updatedAt: "2026-08-20T00:00:00Z", groupId: "robotics", groupLabel: "Robotics" },
    { id: "repository:beta", label: "beta", type: "repository", url: "https://github.com/example/beta", language: "C++", fork: true, archived: false, createdAt: "2025-02-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z", groupId: "robotics", groupLabel: "Robotics" },
    { id: "repository:gamma", label: "gamma", type: "repository", url: "https://github.com/example/gamma", language: "Rust", fork: false, archived: true, createdAt: "2025-03-01T00:00:00Z", updatedAt: "2025-03-01T00:00:00Z", groupId: "legacy", groupLabel: "Legacy" },
    { id: "repository:delta", label: "delta", type: "repository", url: "https://github.com/example/delta", language: "TypeScript", fork: false, archived: false, createdAt: "2025-04-01T00:00:00Z", updatedAt: "2026-08-10T00:00:00Z", groupId: "web", groupLabel: "Web" },
    {
      id: contributedId,
      label: "gazebosim/gz-sim",
      type: "repository",
      relation: "contributed",
      repositoryOwner: "gazebosim",
      repositoryName: "gz-sim",
      url: "https://github.com/gazebosim/gz-sim",
      description: "Gazebo simulation contribution",
      language: "C++",
      topics: ["robotics", "simulation"],
      stars: 1000,
      forks: 200,
      fork: false,
      archived: false,
      createdAt: "2020-01-01T00:00:00Z",
      updatedAt: "2026-08-21T00:00:00Z",
      contribution: { commits: 3, pullRequests: 2, mergedPullRequests: 1, commitsTruncated: false, pullRequestsTruncated: false },
    },
  ],
  edges: [
    { source: "user:example", target: "group:robotics", type: "ownership" },
    { source: "user:example", target: "group:web", type: "ownership" },
    { source: "user:example", target: "group:legacy", type: "ownership" },
    { source: "group:robotics", target: "repository:alpha", type: "membership" },
    { source: "group:robotics", target: "repository:beta", type: "membership" },
    { source: "group:legacy", target: "repository:gamma", type: "membership" },
    { source: "group:web", target: "repository:delta", type: "membership" },
    { source: "user:example", target: contributedId, type: "contribution" },
  ],
  semanticEdges: [
    { source: "repository:alpha", target: "repository:beta", type: "semantic", score: 0.9 },
  ],
};

async function installFixture(page, value = graph) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(value) });
  });
}

function routeFor(style) {
  return sharedStyles.includes(style) ? `/u/?username=example&style=${style}` : `/${style}/?username=example&style=${style}`;
}

function browserErrors(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
  return failures;
}

async function canvasSignature(page) {
  return page.locator("#galaxy").evaluate((canvas) => canvas.toDataURL());
}

for (const style of [...sharedStyles, ...dedicatedStyles]) {
  test(`${style} renders and filters Contributed independently`, async ({ page }) => {
    const failures = browserErrors(page);
    await installFixture(page);
    await page.goto(routeFor(style));
    await expect(page.locator("#status")).toBeHidden();
    const contributed = page.getByRole("button", { name: /Contributed repositories: 1/ });
    await expect(contributed).toHaveText("Contributed 1");
    await expect(page.locator("#resultCount")).toHaveText("5 / 5 repos");
    await expect(page.locator(".legend .contributed")).toBeVisible();

    if (dedicatedStyles.includes(style)) {
      await expect.poll(async () => page.evaluate(async () => {
        const response = await fetch("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", { cache: "no-cache" });
        const value = await response.json();
        return value.nodes.some((node) => node.id === "group:__contributed_view__" && node.label === "Contributed");
      })).toBe(true);
    }

    const before = await canvasSignature(page);
    await contributed.click();
    if (dedicatedStyles.includes(style)) await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("#resultCount")).toHaveText("4 / 5 repos");
    await expect.poll(async () => (await canvasSignature(page)) !== before).toBe(true);
    expect(failures).toEqual([]);
  });
}

test("shared viewer restores full external identity for Search and details", async ({ page }) => {
  await installFixture(page);
  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();
  await page.locator("#search").fill("gazebosim/gz-sim");
  await expect(page.locator("#resultCount")).toContainText("1 matches");
  await page.evaluate((id) => {
    const repo = state.byId.get(id);
    updateDetails(repo);
  }, contributedId);
  await expect(page.locator("#detailsTitle")).toHaveText("gazebosim/gz-sim");
  await expect(page.locator("#detailsLink")).toHaveAttribute("href", "https://github.com/gazebosim/gz-sim");
  await expect(page.locator("#detailsMeta")).toContainText("Contributed");
  await expect(page.locator("#detailsMeta")).toContainText("Commits");
  await expect(page.locator("#detailsMeta")).toContainText("Pull requests");
  await expect(page.locator("#detailsMeta")).toContainText("Merged PRs");
});

test("browser compatibility layer drops invalid external identity before legacy viewer sanitizers", async ({ page }) => {
  const invalid = structuredClone(graph);
  invalid.nodes = invalid.nodes.map((node) => node.id === contributedId
    ? { ...node, repositoryOwner: "private-org", repositoryName: "secret", label: "private-org/secret", url: "https://github.com/other-owner/secret" }
    : node);
  invalid.edges = invalid.edges.map((edge) => edge.target === contributedId ? { ...edge, target: contributedId } : edge);
  await installFixture(page, invalid);
  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.getByRole("button", { name: /Contributed repositories: 0/ })).toBeDisabled();
  await expect(page.locator("#resultCount")).toHaveText("4 / 4 repos");
  await expect.poll(() => page.evaluate(() => window.ProjectMapContributedCompat?.snapshot?.().acceptedIds || [])).toEqual([]);
});
