import { expect, test } from "@playwright/test";

const repositories = Array.from({ length: 8 }, (_, index) => ({
  id: `repository:repo-${index}`,
  label: `repo-${index}`,
  type: "repository",
  url: `https://github.com/example/repo-${index}`,
  description: `repository ${index}`,
  language: index % 2 ? "Rust" : "JavaScript",
  topics: [],
  stars: index,
  forks: 0,
  fork: false,
  archived: false,
  updatedAt: "2026-08-21T00:00:00Z",
  groupId: "research",
  groupLabel: "Research",
}));

const graph = {
  owner: "example",
  generatedAt: "2026-08-21T00:00:00Z",
  repositoryCount: repositories.length,
  groupCount: 1,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:research", label: "Research", type: "group", repositoryCount: repositories.length },
    ...repositories,
  ],
  edges: [
    { source: "user:example", target: "group:research", type: "ownership" },
    ...repositories.map((repo) => ({ source: "group:research", target: repo.id, type: "membership" })),
    { source: "repository:repo-0", target: "repository:repo-1", type: "relation" },
    { source: "repository:repo-0", target: "repository:repo-2", type: "relation" },
  ],
};

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function camera(page) {
  return page.evaluate(() => ({
    style: state.style,
    zoom: state.zoom,
    pan: { ...state.pan },
    fitted: state.fitted,
  }));
}

async function geometry(page) {
  return page.evaluate(() => state.nodes.map((node) => ({ id: node.id, x: node.x, y: node.y })));
}

test("Obsidian opens at neutral camera, explicit Fit still works, and Galaxy keeps auto-fit", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installGraph(page);
  await page.goto("/u/?username=example&style=obsidian");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ProjectMapObsidianRuntime?.snapshot().active)).toBe(true);

  const opened = await camera(page);
  expect(opened.style).toBe("obsidian");
  expect(opened.zoom).toBe(1);
  expect(opened.pan).toEqual({ x: 0, y: 0 });
  expect(opened.fitted).toBe(true);

  await page.waitForTimeout(120);
  expect(await camera(page)).toEqual(opened);

  await page.evaluate(() => {
    for (const node of state.nodes) {
      node.x *= 4;
      node.y *= 4;
    }
    draw();
  });
  const spreadGeometry = await geometry(page);
  await page.locator("#fit").click();
  const fitted = await camera(page);
  expect(fitted.style).toBe("obsidian");
  expect(fitted.zoom).toBeLessThan(0.8);
  expect(await geometry(page)).toEqual(spreadGeometry);

  await page.locator("#reset").click();
  await expect.poll(() => camera(page)).toMatchObject({
    style: "obsidian",
    zoom: 1,
    pan: { x: 0, y: 0 },
    fitted: true,
  });

  await page.locator("#style").selectOption("galaxy-classic");
  await expect.poll(() => page.evaluate(() => state.style)).toBe("galaxy-classic");
  const galaxy = await camera(page);
  expect(Math.abs(galaxy.zoom - 1) > 0.05 || Math.abs(galaxy.pan.x) > 1 || Math.abs(galaxy.pan.y) > 1).toBe(true);
});
