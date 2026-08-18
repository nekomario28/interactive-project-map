import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

function largeGraph(repositoryCount = 300, groupCount = 10) {
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    id: `group:stress-${index}`,
    label: `Stress Category ${index + 1}`,
    type: "group",
    repositoryCount: Math.ceil(repositoryCount / groupCount),
  }));
  const repos = Array.from({ length: repositoryCount }, (_, index) => {
    const groupIndex = index % groups.length;
    const name = `stress-repo-${String(index).padStart(3, "0")}`;
    return {
      id: `repository:${name}`,
      label: name,
      type: "repository",
      url: `https://github.com/example/${name}`,
      description: `Synthetic browser stress repository ${index}`,
      language: ["Python", "TypeScript", "Rust", "C++", "Java", "Shell"][index % 6],
      topics: ["stress", `group-${groupIndex}`],
      stars: (index * 13) % 37,
      forks: index % 7,
      fork: index % 11 === 0,
      archived: index % 19 === 0,
      createdAt: new Date(Date.UTC(2020 + (index % 7), index % 12, 1 + (index % 27))).toISOString(),
      updatedAt: "2026-08-18T00:00:00Z",
      groupId: `stress-${groupIndex}`,
      groupLabel: groups[groupIndex].label,
    };
  });
  return {
    owner: "example",
    generatedAt: "2026-08-18T00:00:00Z",
    repositoryCount,
    groupCount: groups.length,
    nodes: [{ id: "user:example", label: "example", type: "owner", url: "https://github.com/example" }, ...groups, ...repos],
    edges: [
      ...groups.map((group) => ({ source: "user:example", target: group.id, type: "ownership" })),
      ...repos.map((repo) => ({ source: `group:${repo.groupId}`, target: repo.id, type: "membership" })),
    ],
  };
}

async function installGraph(page, graph) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

function browserErrors(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  return failures;
}

test.beforeAll(async () => {
  await mkdir(".tmp/playwright-visual/stress", { recursive: true });
});

test("expensive interactive presets initialize at the 300-repository limit", async ({ browser }) => {
  const normalGraph = largeGraph();
  const concentratedGalaxy = largeGraph(300, 1);
  const targets = [
    ["galaxy", "/u/", concentratedGalaxy],
    ["obsidian", "/u/", normalGraph],
    ["cluster", "/cluster/", normalGraph],
    ["sunburst", "/sunburst/", normalGraph],
    ["sankey", "/sankey/", normalGraph],
  ];

  for (const [style, path, graph] of targets) {
    await test.step(style, async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await installGraph(page, graph);
      const failures = browserErrors(page);
      const started = Date.now();
      await page.goto(`${path}?username=example&style=${style}`);
      await expect(page.locator("#status")).toBeHidden({ timeout: 10_000 });
      await expect(page.locator("#error")).not.toHaveClass(/visible/);
      expect(Date.now() - started).toBeLessThan(10_000);
      await page.getByRole("button", { name: "Fit" }).click();

      if (style === "galaxy") {
        const fitted = await page.evaluate(() => {
          const size = canvasSize();
          const points = state.nodes.map((node) => worldToScreen(node.x, node.y));
          return {
            zoom: state.zoom,
            width: size.width,
            height: size.height,
            minX: Math.min(...points.map((point) => point.x)),
            maxX: Math.max(...points.map((point) => point.x)),
            minY: Math.min(...points.map((point) => point.y)),
            maxY: Math.max(...points.map((point) => point.y)),
            repositories: state.nodes.filter((node) => node.type === "repository").length,
          };
        });
        expect(fitted.repositories).toBe(300);
        expect(fitted.zoom).toBeLessThan(0.25);
        expect(fitted.minX).toBeGreaterThanOrEqual(0);
        expect(fitted.maxX).toBeLessThanOrEqual(fitted.width);
        expect(fitted.minY).toBeGreaterThanOrEqual(0);
        expect(fitted.maxY).toBeLessThanOrEqual(fitted.height);
      }

      await page.screenshot({ path: `.tmp/playwright-visual/stress/${style}.png`, fullPage: true });
      expect(failures).toEqual([]);
      await context.close();
    });
  }
});
