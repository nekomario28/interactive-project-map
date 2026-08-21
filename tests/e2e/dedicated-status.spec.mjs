import { expect, test } from "@playwright/test";

const styles = ["radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"];

const graph = {
  owner: "example",
  generatedAt: "2026-08-22T00:00:00Z",
  repositoryCount: 4,
  groupCount: 2,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 3 },
    { id: "group:web", label: "Web", type: "group", repositoryCount: 1 },
    { id: "repository:alpha", label: "alpha", type: "repository", url: "https://github.com/example/alpha", language: "Python", fork: false, archived: false, createdAt: "2025-01-01T00:00:00Z", updatedAt: "2026-08-20T00:00:00Z", groupId: "robotics", groupLabel: "Robotics" },
    { id: "repository:beta", label: "beta", type: "repository", url: "https://github.com/example/beta", language: "C++", fork: true, archived: false, createdAt: "2025-02-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z", groupId: "robotics", groupLabel: "Robotics" },
    { id: "repository:gamma", label: "gamma", type: "repository", url: "https://github.com/example/gamma", language: "Rust", fork: false, archived: true, createdAt: "2025-03-01T00:00:00Z", updatedAt: "2025-03-01T00:00:00Z", groupId: "robotics", groupLabel: "Robotics" },
    { id: "repository:delta", label: "delta", type: "repository", url: "https://github.com/example/delta", language: "TypeScript", fork: false, archived: false, createdAt: "2025-04-01T00:00:00Z", updatedAt: "2026-08-10T00:00:00Z", groupId: "web", groupLabel: "Web" },
  ],
  edges: [
    { source: "user:example", target: "group:robotics", type: "ownership" },
    { source: "user:example", target: "group:web", type: "ownership" },
    { source: "group:robotics", target: "repository:alpha", type: "membership" },
    { source: "group:robotics", target: "repository:beta", type: "membership" },
    { source: "group:robotics", target: "repository:gamma", type: "membership" },
    { source: "group:web", target: "repository:delta", type: "membership" },
  ],
  semanticEdges: [
    { source: "repository:alpha", target: "repository:beta", type: "semantic", score: 0.9 },
    { source: "repository:beta", target: "repository:gamma", type: "semantic", score: 0.8 },
  ],
};

async function installFixture(page, value = graph) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(value) });
  });
}

async function projectedRepositoryIds(page) {
  return page.evaluate(async () => {
    const response = await fetch("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", { cache: "no-cache" });
    const value = await response.json();
    return value.nodes.filter((node) => node.type === "repository").map((node) => node.id).sort();
  });
}

function watchBrowserErrors(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
  return failures;
}

test("all dedicated viewers apply the same repository-status projection before their existing layout", async ({ browser }) => {
  for (const style of styles) {
    await test.step(style, async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      const browserErrors = watchBrowserErrors(page);
      await installFixture(page);
      await page.goto(`/${style}/?username=example&style=${style}&status=original`);
      await expect(page.locator("#status")).toBeHidden();
      await expect(page.getByRole("button", { name: /Original repositories: 2/ })).toHaveText("Original 2");
      await expect(page.getByRole("button", { name: /Fork repositories: 1/ })).toHaveText("Fork 1");
      await expect(page.getByRole("button", { name: /Archived repositories: 1/ })).toHaveText("Archived 1");
      await expect(page.locator("#resultCount")).toHaveText("2 / 4 repos");
      await expect.poll(() => page.evaluate(() => window.ProjectMapDedicatedViewState?.snapshot?.().statuses || [])).toEqual(["original"]);
      await expect.poll(() => projectedRepositoryIds(page)).toEqual(["repository:alpha", "repository:delta"]);
      expect(browserErrors).toEqual([]);
      await context.close();
    });
  }
});

test("dedicated status chips update the shareable URL and reload through the same projection", async ({ page }) => {
  await installFixture(page);
  await page.goto("/tree/?username=example&style=tree");
  await expect(page.locator("#resultCount")).toHaveText("4 / 4 repos");

  await page.getByRole("button", { name: /Fork repositories: 1/ }).click();
  await page.waitForURL(/status=original%2Carchived/);
  await expect(page.locator("#resultCount")).toHaveText("3 / 4 repos");
  await expect.poll(() => projectedRepositoryIds(page)).toEqual(["repository:alpha", "repository:delta", "repository:gamma"]);

  await page.getByRole("button", { name: /Fork repositories: 1/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.has("status")).toBe(false);
  await expect(page.locator("#resultCount")).toHaveText("4 / 4 repos");
});

test("dedicated viewers disable a status that is absent from the generated graph", async ({ page }) => {
  const noArchived = {
    ...graph,
    repositoryCount: 3,
    nodes: graph.nodes.filter((node) => node.id !== "repository:gamma"),
    edges: graph.edges.filter((edge) => edge.source !== "repository:gamma" && edge.target !== "repository:gamma"),
    semanticEdges: [],
  };
  await installFixture(page, noArchived);
  await page.goto("/matrix/?username=example&style=matrix");
  const archived = page.getByRole("button", { name: /Archived repositories: 0/ });
  await expect(archived).toBeDisabled();
  await expect(archived).toHaveText("Archived 0");
  await expect(page.locator("#resultCount")).toHaveText("3 / 3 repos");
});
