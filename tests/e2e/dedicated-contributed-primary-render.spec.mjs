import { expect, test } from "@playwright/test";

const contributedId = "repository:octocat/hello-world";
const styles = ["treemap", "timeline", "cluster", "sunburst"];

const graph = {
  owner: "example",
  generatedAt: "2026-08-24T00:00:00Z",
  repositoryCount: 2,
  contributedRepositoryCount: 1,
  groupCount: 2,
  externalContributions: {
    window: { from: "2026-02-24T00:00:00Z", to: "2026-08-24T00:00:00Z" },
    cap: 12,
    candidateRepositories: 1,
    includedRepositories: 1,
    omittedRepositories: 0,
    truncatedRepositories: 0,
  },
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 1 },
    { id: "group:web", label: "Web", type: "group", repositoryCount: 1 },
    {
      id: "repository:alpha",
      label: "alpha",
      type: "repository",
      url: "https://github.com/example/alpha",
      language: "Python",
      stars: 1,
      forks: 0,
      fork: false,
      archived: false,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2026-08-20T00:00:00Z",
      groupId: "robotics",
      groupLabel: "Robotics",
    },
    {
      id: "repository:beta",
      label: "beta",
      type: "repository",
      url: "https://github.com/example/beta",
      language: "TypeScript",
      stars: 0,
      forks: 0,
      fork: false,
      archived: false,
      createdAt: "2025-06-01T00:00:00Z",
      updatedAt: "2026-08-10T00:00:00Z",
      groupId: "web",
      groupLabel: "Web",
    },
    {
      id: contributedId,
      label: "octocat/Hello-World",
      type: "repository",
      relation: "contributed",
      repositoryOwner: "octocat",
      repositoryName: "Hello-World",
      url: "https://github.com/octocat/Hello-World",
      description: "External repository with contribution evidence.",
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
    { source: "group:robotics", target: "repository:alpha", type: "membership" },
    { source: "group:web", target: "repository:beta", type: "membership" },
    { source: "user:example", target: contributedId, type: "contribution" },
  ],
  semanticEdges: [],
};

async function installFixture(page) {
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

async function sampleContributed(page, style) {
  return page.evaluate(({ id, styleName }) => {
    let repo;
    let point;
    if (styleName === "treemap") {
      repo = state.repos.find((item) => item.id === id);
      if (!repo) return null;
      const box = screenBox(repo.box);
      point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    } else if (styleName === "timeline" || styleName === "cluster") {
      repo = state.nodes.find((item) => item.id === id);
      if (!repo) return null;
      point = worldToScreen(repo.x, repo.y);
    } else if (styleName === "sunburst") {
      repo = state.segments.find((item) => item.id === id);
      if (!repo) return null;
      const origin = center();
      // Repository labels are centered on the segment midpoint. Sample well inside the
      // same wedge but off that text axis so glyph antialiasing cannot mask the fill.
      const angle = repo.start + (repo.end - repo.start) * 0.72;
      const radius = 118 * state.zoom;
      point = { x: origin.x + Math.cos(angle) * radius, y: origin.y + Math.sin(angle) * radius };
    } else {
      return null;
    }
    draw();
    const dpr = window.devicePixelRatio || 1;
    const pixel = ctx.getImageData(Math.round(point.x * dpr), Math.round(point.y * dpr), 1, 1).data;
    return {
      status: statusOf(repo),
      palette: palette().contributed,
      pixel: Array.from(pixel),
    };
  }, { id: contributedId, styleName: style });
}

test("dedicated viewers render archived/fork Contributed repositories as primary orange", async ({ browser }) => {
  for (const style of styles) {
    await test.step(style, async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      const browserErrors = watchBrowserErrors(page);
      await installFixture(page);
      await page.goto(`/${style}/?username=example&style=${style}`);
      await expect(page.locator("#status")).toBeHidden();

      await expect.poll(() => sampleContributed(page, style), { timeout: 5_000 }).not.toBeNull();
      const rendered = await sampleContributed(page, style);
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
