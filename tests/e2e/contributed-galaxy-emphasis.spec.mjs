import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-24T00:00:00.000Z",
  repositoryCount: 1,
  groupCount: 1,
  contributedRepositoryCount: 1,
  externalContributions: {
    window: { from: "2025-08-24T00:00:00.000Z", to: "2026-08-24T00:00:00.000Z" },
    cap: 4,
    candidateRepositories: 1,
    includedRepositories: 1,
    omittedRepositories: 0,
    truncatedRepositories: 0,
  },
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 1 },
    {
      id: "repository:owned-project",
      label: "owned-project",
      type: "repository",
      url: "https://github.com/example/owned-project",
      stars: 2,
      forks: 0,
      fork: false,
      archived: false,
      groupId: "robotics",
      groupLabel: "Robotics",
    },
    {
      id: "repository:outside/project",
      label: "outside/project",
      type: "repository",
      relation: "contributed",
      repositoryOwner: "outside",
      repositoryName: "project",
      url: "https://github.com/outside/project",
      description: "accepted external contribution",
      language: "Rust",
      topics: ["robotics"],
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
    { source: "user:example", target: "group:robotics", type: "ownership" },
    { source: "group:robotics", target: "repository:owned-project", type: "membership" },
    { source: "user:example", target: "repository:outside/project", type: "contribution" },
  ],
};

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

function watchBrowserErrors(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
  return failures;
}

for (const style of ["galaxy-classic", "galaxy-systems", "galaxy-hybrid"]) {
  test(`${style} keeps Contributed in the same galaxy as a safe external halo orbit`, async ({ page }) => {
    await installGraph(page);
    const browserErrors = watchBrowserErrors(page);
    await page.goto(`/u/?username=example&style=${style}`);

    await expect.poll(async () => page.evaluate(() => window.ProjectMapContributedEmphasis?.snapshot()?.repositories?.length ?? 0)).toBe(1);

    const initial = await page.evaluate(() => {
      const emphasis = window.ProjectMapContributedEmphasis.snapshot();
      const graphNode = state.graph.nodes.find((node) => node.id === "repository:outside/project");
      const renderNode = state.nodes.find((node) => node.id === "repository:outside/project");
      draw();
      const screen = worldToScreen(renderNode.x, renderNode.y);
      const dpr = window.devicePixelRatio || 1;
      const pixelX = Math.max(0, Math.min(canvas.width - 1, Math.round(screen.x * dpr)));
      const pixelY = Math.max(0, Math.min(canvas.height - 1, Math.round(screen.y * dpr)));
      const renderedPixel = Array.from(ctx.getImageData(pixelX, pixelY, 1, 1).data);
      return {
        emphasis,
        paletteColor: palette().contributed,
        renderedPixel,
        graphGroupId: graphNode?.groupId ?? null,
        fakeMembership: state.graph.edges.some((edge) => ["membership", "member"].includes(edge.type) && (edge.source === graphNode?.id || edge.target === graphNode?.id)),
      };
    });

    expect(initial.emphasis.color).toBe("#E69F00");
    expect(initial.emphasis.style).toBe(style);
    expect(initial.emphasis.sweepRadius).toBeGreaterThanOrEqual(220);
    expect(initial.emphasis.placement).toBe("external-halo-orbit");
    expect(initial.paletteColor).toBe("#E69F00");
    expect(initial.renderedPixel[0]).toBeGreaterThan(190);
    expect(initial.renderedPixel[1]).toBeGreaterThan(110);
    expect(initial.renderedPixel[2]).toBeLessThan(50);
    expect(initial.renderedPixel[0]).toBeGreaterThan(initial.renderedPixel[1]);
    expect(initial.graphGroupId).toBeNull();
    expect(initial.fakeMembership).toBe(false);

    const first = initial.emphasis.repositories[0];
    expect(first.placement).toBe("external-halo-orbit");
    expect(first.clearance).toBeGreaterThan(100);

    await page.waitForTimeout(650);
    const second = await page.evaluate(() => window.ProjectMapContributedEmphasis.snapshot().repositories[0]);
    const displacement = Math.hypot(second.x - first.x, second.y - first.y);
    expect(displacement).toBeGreaterThan(0.20);
    expect(second.clearance).toBeGreaterThan(100);

    await expect(page.locator('[data-status-filter="contributed"]')).toContainText("Contributed");
    expect(browserErrors).toEqual([]);
  });
}
