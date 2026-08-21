import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-21T00:00:00Z",
  repositoryCount: 4,
  groupCount: 1,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:research", label: "Research", type: "group", repositoryCount: 4 },
    { id: "repository:hub", label: "hub", type: "repository", url: "https://github.com/example/hub", description: "linked hub", language: "JavaScript", topics: [], stars: 0, forks: 0, fork: false, archived: false, updatedAt: "2026-08-21T00:00:00Z", groupId: "research", groupLabel: "Research" },
    { id: "repository:leaf-one", label: "leaf-one", type: "repository", url: "https://github.com/example/leaf-one", description: "leaf", language: "JavaScript", topics: [], stars: 0, forks: 0, fork: false, archived: false, updatedAt: "2026-08-21T00:00:00Z", groupId: "research", groupLabel: "Research" },
    { id: "repository:leaf-two", label: "leaf-two", type: "repository", url: "https://github.com/example/leaf-two", description: "leaf", language: "JavaScript", topics: [], stars: 0, forks: 0, fork: false, archived: false, updatedAt: "2026-08-21T00:00:00Z", groupId: "research", groupLabel: "Research" },
    { id: "repository:popular", label: "popular", type: "repository", url: "https://github.com/example/popular", description: "high stars but few links", language: "JavaScript", topics: [], stars: 1024, forks: 0, fork: false, archived: false, updatedAt: "2026-08-21T00:00:00Z", groupId: "research", groupLabel: "Research" },
  ],
  edges: [
    { source: "user:example", target: "group:research", type: "ownership" },
    { source: "group:research", target: "repository:hub", type: "membership" },
    { source: "group:research", target: "repository:leaf-one", type: "membership" },
    { source: "group:research", target: "repository:leaf-two", type: "membership" },
    { source: "group:research", target: "repository:popular", type: "membership" },
    { source: "repository:hub", target: "repository:leaf-one", type: "relation" },
    { source: "repository:hub", target: "repository:leaf-two", type: "relation" },
    { source: "repository:hub", target: "repository:leaf-one", type: "relation" },
  ],
  semanticEdges: [
    { source: "repository:hub", target: "repository:popular", type: "semantic", score: 0.94 },
  ],
};

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

test("Obsidian sizes repositories by unique visible connectivity instead of GitHub stars", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installGraph(page);
  await page.goto("/u/?username=example&style=obsidian");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ProjectMapObsidianRuntime?.snapshot().active)).toBe(true);

  const obsidian = await page.evaluate(() => ({
    snapshot: window.ProjectMapObsidianRuntime.snapshot(),
    hubRadius: nodeRadius(state.byId.get("repository:hub")),
    popularRadius: nodeRadius(state.byId.get("repository:popular")),
  }));

  expect(obsidian.snapshot.repositoryDegrees).toEqual({
    "repository:hub": 4,
    "repository:leaf-one": 2,
    "repository:leaf-two": 2,
    "repository:popular": 2,
  });
  expect(obsidian.hubRadius).toBeGreaterThan(obsidian.popularRadius);
  expect(obsidian.snapshot.phase).toBe("settled");

  await page.goto("/u/?username=example&style=galaxy-classic");
  await expect(page.locator("#status")).toBeHidden();
  const galaxy = await page.evaluate(() => ({
    hubRadius: nodeRadius(state.byId.get("repository:hub")),
    popularRadius: nodeRadius(state.byId.get("repository:popular")),
  }));
  expect(galaxy.popularRadius).toBeGreaterThan(galaxy.hubRadius);
});
