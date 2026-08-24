import { expect, test } from "@playwright/test";

const styles = ["radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"];
const contributedId = "repository:octocat/hello-world";

const graph = {
  owner: "example",
  generatedAt: "2026-08-22T00:00:00Z",
  repositoryCount: 4,
  contributedRepositoryCount: 1,
  groupCount: 3,
  externalContributions: {
    window: { from: "2026-02-22T00:00:00Z", to: "2026-08-22T00:00:00Z" },
    cap: 12,
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
      label: "octocat/Hello-World",
      type: "repository",
      relation: "contributed",
      repositoryOwner: "octocat",
      repositoryName: "Hello-World",
      url: "https://github.com/octocat/Hello-World",
      description: "External repository with public contribution evidence.",
      language: "JavaScript",
      topics: ["external"],
      stars: 42,
      forks: 7,
      fork: true,
      archived: true,
      createdAt: "2024-06-01T00:00:00Z",
      updatedAt: "2026-08-21T00:00:00Z",
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
    { source: "repository:beta", target: "repository:gamma", type: "semantic", score: 0.8 },
  ],
};

async function installFixture(page, value = graph) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(value) });
  });
}

async function projectedGraphShape(page) {
  return page.evaluate(async () => {
    const response = await fetch("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", { cache: "no-cache" });
    const value = await response.json();
    return {
      repositories: value.nodes.filter((node) => node.type === "repository").map((node) => node.id).sort(),
      groups: value.nodes.filter((node) => node.type === "group").map((node) => node.id).sort(),
      groupCount: value.groupCount,
    };
  });
}

async function projectedRepositoryIds(page) {
  return (await projectedGraphShape(page)).repositories;
}

function watchBrowserErrors(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
  return failures;
}

test("all dedicated viewers apply four-status projection and prune categories with zero visible repositories", async ({ browser }) => {
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
      await expect(page.getByRole("button", { name: /Contributed repositories: 1/ })).toHaveText("Contributed 1");
      await expect(page.locator("#resultCount")).toHaveText("2 / 5 repos");
      await expect.poll(() => page.evaluate(() => window.ProjectMapDedicatedViewState?.snapshot?.().statuses || [])).toEqual(["original"]);
      await expect.poll(() => projectedGraphShape(page)).toEqual({
        repositories: ["repository:alpha", "repository:delta"],
        groups: ["group:robotics", "group:web"],
        groupCount: 2,
      });
      expect(browserErrors).toEqual([]);
      await context.close();
    });
  }
});

test("all dedicated viewers retain strict external identity without owned category fabrication", async ({ browser }) => {
  for (const style of styles) {
    await test.step(style, async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      const browserErrors = watchBrowserErrors(page);
      await installFixture(page);
      await page.goto(`/${style}/?username=example&style=${style}`);
      await expect(page.locator("#status")).toBeHidden();
      await expect(page.getByRole("button", { name: /Contributed repositories: 1/ })).toHaveText("Contributed 1");
      await expect(page.locator("#resultCount")).toHaveText("5 / 5 repos");
      await expect.poll(() => page.evaluate(() => window.ProjectMapContributedDedicatedViewer?.snapshot?.())).toMatchObject({
        mode: style,
        contributedRepositories: [contributedId],
        contributedRepositoryCount: 1,
      });
      const sanitized = await page.evaluate(() => {
        const node = state.graph?.nodes?.find((item) => item?.relation === "contributed");
        return node ? {
          id: node.id,
          label: node.label,
          url: node.url,
          relation: node.relation,
          repositoryOwner: node.repositoryOwner,
          repositoryName: node.repositoryName,
          groupId: node.groupId || null,
          groupLabel: node.groupLabel || null,
          fork: node.fork,
          archived: node.archived,
        } : null;
      });
      expect(sanitized).toEqual({
        id: contributedId,
        label: "octocat/Hello-World",
        url: "https://github.com/octocat/Hello-World",
        relation: "contributed",
        repositoryOwner: "octocat",
        repositoryName: "Hello-World",
        groupId: null,
        groupLabel: null,
        fork: true,
        archived: true,
      });
      const projected = await page.evaluate(async () => {
        const response = await fetch("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", { cache: "no-cache" });
        const value = await response.json();
        return {
          contributed: value.nodes.filter((node) => node.relation === "contributed").map((node) => node.id),
          fabricatedEdges: (value.edges || []).filter((edge) => edge.target === "repository:octocat/hello-world" && ["ownership", "membership"].includes(edge.type)),
        };
      });
      expect(projected).toEqual({ contributed: [contributedId], fabricatedEdges: [] });
      expect(browserErrors).toEqual([]);
      await context.close();
    });
  }
});

test("dedicated status chips update the shareable URL and reload through the same four-status projection", async ({ page }) => {
  await installFixture(page);
  await page.goto("/tree/?username=example&style=tree");
  await expect(page.locator("#resultCount")).toHaveText("5 / 5 repos");

  await page.getByRole("button", { name: /Fork repositories: 1/ }).click();
  await page.waitForURL(/status=original%2Carchived%2Ccontributed/);
  await expect(page.locator("#resultCount")).toHaveText("4 / 5 repos");
  await expect.poll(() => projectedRepositoryIds(page)).toEqual([contributedId, "repository:alpha", "repository:delta", "repository:gamma"].sort());

  await page.getByRole("button", { name: /Fork repositories: 1/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.has("status")).toBe(false);
  await expect(page.locator("#resultCount")).toHaveText("5 / 5 repos");
});

test("dedicated status URL alias c selects only Contributed even when source flags are fork and archived", async ({ page }) => {
  await installFixture(page);
  await page.goto("/tree/?username=example&style=tree&status=c");
  await expect(page.locator("#resultCount")).toHaveText("1 / 5 repos");
  await expect.poll(() => page.evaluate(() => window.ProjectMapDedicatedViewState?.snapshot?.().statuses || [])).toEqual(["contributed"]);
  await expect.poll(() => projectedRepositoryIds(page)).toEqual([contributedId]);
  await expect.poll(() => page.evaluate(() => window.ProjectMapContributedDedicatedViewer?.snapshot?.().contributedRepositories || [])).toEqual([contributedId]);
});

test("dedicated viewers disable a status that is absent from the generated graph and do not retain its empty category", async ({ page }) => {
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
  await expect(page.getByRole("button", { name: /Contributed repositories: 1/ })).toHaveText("Contributed 1");
  await expect(page.locator("#resultCount")).toHaveText("4 / 4 repos");
  await expect.poll(() => projectedGraphShape(page)).toEqual({
    repositories: [contributedId, "repository:alpha", "repository:beta", "repository:delta"].sort(),
    groups: ["group:robotics", "group:web"],
    groupCount: 2,
  });
});

test("Radial and Tree render archived/fork Contributed repositories as the primary orange status", async ({ browser }) => {
  for (const style of ["radial", "tree"]) {
    await test.step(style, async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      const browserErrors = watchBrowserErrors(page);
      await installFixture(page);
      await page.goto(`/${style}/?username=example&style=${style}`);
      await expect(page.locator("#status")).toBeHidden();

      const sample = await expect.poll(async () => page.evaluate((id) => {
        const node = state.nodes.find((item) => item.id === id);
        if (!node) return null;
        const point = worldToScreen(node.x, node.y);
        const dpr = window.devicePixelRatio || 1;
        const pixel = ctx.getImageData(Math.round(point.x * dpr), Math.round(point.y * dpr), 1, 1).data;
        return {
          status: nodeStatus(node),
          palette: palette().contributed,
          pixel: Array.from(pixel),
        };
      }, contributedId), { timeout: 5_000 }).not.toBeNull();

      const rendered = await page.evaluate((id) => {
        const node = state.nodes.find((item) => item.id === id);
        const point = worldToScreen(node.x, node.y);
        const dpr = window.devicePixelRatio || 1;
        const pixel = ctx.getImageData(Math.round(point.x * dpr), Math.round(point.y * dpr), 1, 1).data;
        return { status: nodeStatus(node), palette: palette().contributed, pixel: Array.from(pixel) };
      }, contributedId);
      expect(rendered.status).toBe("contributed");
      expect(rendered.palette).toBe("#E69F00");
      expect(rendered.pixel[0]).toBeGreaterThan(190);
      expect(rendered.pixel[1]).toBeGreaterThan(110);
      expect(rendered.pixel[1]).toBeLessThan(190);
      expect(rendered.pixel[2]).toBeLessThan(70);
      expect(rendered.pixel[3]).toBe(255);
      expect(browserErrors).toEqual([]);
      await context.close();
    });
  }
});
