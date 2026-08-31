import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-09-01T00:00:00Z",
  repositoryCount: 5,
  groupCount: 2,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:inner", label: "Inner", type: "group", repositoryCount: 2 },
    { id: "group:outer", label: "Outer", type: "group", repositoryCount: 2 },
    { id: "repository:alpha", label: "alpha", repositoryName: "alpha", type: "repository", url: "https://github.com/example/alpha", description: "Inner alpha", language: "TypeScript", stars: 8, forks: 1, fork: false, archived: false, relation: "owned", groupId: "inner", groupLabel: "Inner", topics: [], updatedAt: "2026-08-31T00:00:00Z" },
    { id: "repository:beta", label: "beta", repositoryName: "beta", type: "repository", url: "https://github.com/example/beta", description: "Inner beta", language: "Rust", stars: 5, forks: 0, fork: false, archived: false, relation: "owned", groupId: "inner", groupLabel: "Inner", topics: [], updatedAt: "2026-08-31T00:00:00Z" },
    { id: "repository:gamma", label: "gamma", repositoryName: "gamma", type: "repository", url: "https://github.com/example/gamma", description: "Outer gamma", language: "Python", stars: 3, forks: 0, fork: false, archived: false, relation: "owned", groupId: "outer", groupLabel: "Outer", topics: [], updatedAt: "2026-08-31T00:00:00Z" },
    { id: "repository:delta", label: "delta", repositoryName: "delta", type: "repository", url: "https://github.com/example/delta", description: "Outer delta", language: "Go", stars: 2, forks: 0, fork: false, archived: false, relation: "owned", groupId: "outer", groupLabel: "Outer", topics: [], updatedAt: "2026-08-31T00:00:00Z" },
    { id: "repository:outside/epsilon", label: "outside/epsilon", repositoryOwner: "outside", repositoryName: "epsilon", type: "repository", url: "https://github.com/outside/epsilon", description: "External contribution", language: "C++", stars: 11, forks: 2, fork: false, archived: false, relation: "contributed", topics: [], updatedAt: "2026-08-31T00:00:00Z", contribution: { commits: 3, pullRequests: 1, mergedPullRequests: 1, commitsTruncated: false, pullRequestsTruncated: false } },
  ],
  edges: [
    { source: "user:example", target: "group:inner", type: "ownership" },
    { source: "user:example", target: "group:outer", type: "ownership" },
    { source: "group:inner", target: "repository:alpha", type: "membership" },
    { source: "group:inner", target: "repository:beta", type: "membership" },
    { source: "group:outer", target: "repository:gamma", type: "membership" },
    { source: "group:outer", target: "repository:delta", type: "membership" },
    { source: "user:example", target: "repository:outside/epsilon", type: "contribution" },
  ],
  externalContributions: {
    window: { from: "2026-07-01T00:00:00Z", to: "2026-09-01T00:00:00Z" },
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

async function galaxySnapshot(page) {
  return page.evaluate(() => window.ProjectMapThreejsGalaxyMotion?.snapshot());
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

test("Galaxy uses co-rotating radius-dependent motion and keeps external work on the slower outer orbit", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Real Three.js orbital motion is exercised once in Chromium.");
  await installGraph(page);
  await page.goto("/three/?username=example&style3d=galaxy");
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });

  const before = await galaxySnapshot(page);
  expect(before).toBeTruthy();
  expect(before.model).toBe("flat-curve-inspired");
  expect(before.direction).toBe("co-rotating");
  expect(before.armCount).toBe(1);
  expect(before.systems).toHaveLength(2);
  expect(before.external).toHaveLength(1);

  const systemsByRadius = [...before.systems].sort((a, b) => a.radius - b.radius);
  expect(systemsByRadius[1].period).toBeGreaterThan(systemsByRadius[0].period);
  expect(before.external[0].radius).toBeGreaterThan(systemsByRadius[1].radius);
  expect(before.external[0].period).toBeGreaterThan(systemsByRadius[1].period);

  await page.waitForTimeout(1_250);
  const after = await galaxySnapshot(page);
  const innerBefore = systemsByRadius[0];
  const innerAfter = after.systems.find((system) => system.id === innerBefore.id);
  const repoBefore = innerBefore.repositories[0];
  const repoAfter = innerAfter.repositories.find((repo) => repo.id === repoBefore.id);
  const externalAfter = after.external.find((repo) => repo.id === before.external[0].id);

  expect(distance(innerBefore, innerAfter)).toBeGreaterThan(0.08);
  expect(distance(repoBefore, repoAfter)).toBeGreaterThan(0.08);
  expect(distance(before.external[0], externalAfter)).toBeGreaterThan(0.08);
});

test("Galaxy Motion Off freezes category, repository, and Contributed orbital positions", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Real Three.js orbital motion is exercised once in Chromium.");
  await installGraph(page);
  await page.goto("/three/?username=example&style3d=galaxy&motion=off");
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });
  await expect(page.locator("#motionToggle")).toHaveText("Motion Off");

  const before = await galaxySnapshot(page);
  await page.waitForTimeout(800);
  const after = await galaxySnapshot(page);

  expect(after.elapsed).toBe(before.elapsed);
  expect(distance(before.systems[0], after.systems[0])).toBeLessThan(1e-7);
  expect(distance(before.systems[0].repositories[0], after.systems[0].repositories[0])).toBeLessThan(1e-7);
  expect(distance(before.external[0], after.external[0])).toBeLessThan(1e-7);
});
