import { expect, test } from "@playwright/test";

const groups = ["alpha", "beta", "gamma", "delta", "epsilon"];
const ownedRepositories = groups.map((group, index) => ({
  id: `repository:${group}`,
  label: group,
  repositoryName: group,
  type: "repository",
  url: `https://github.com/example/${group}`,
  description: `${group} fixture repository`,
  language: ["TypeScript", "Rust", "Python", "Go", "JavaScript"][index],
  stars: 8 - index,
  forks: index % 2,
  fork: false,
  archived: false,
  relation: "owned",
  groupId: group,
  groupLabel: group[0].toUpperCase() + group.slice(1),
  topics: [],
  updatedAt: "2026-08-31T00:00:00Z",
}));

const graph = {
  owner: "example",
  generatedAt: "2026-09-01T00:00:00Z",
  repositoryCount: 6,
  groupCount: groups.length,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    ...groups.map((group) => ({
      id: `group:${group}`,
      label: group[0].toUpperCase() + group.slice(1),
      type: "group",
      repositoryCount: 1,
    })),
    ...ownedRepositories,
    {
      id: "repository:outside/zeta",
      label: "outside/zeta",
      repositoryOwner: "outside",
      repositoryName: "zeta",
      type: "repository",
      url: "https://github.com/outside/zeta",
      description: "External contribution",
      language: "C++",
      stars: 11,
      forks: 2,
      fork: false,
      archived: false,
      relation: "contributed",
      topics: [],
      updatedAt: "2026-08-31T00:00:00Z",
      contribution: { commits: 3, pullRequests: 1, mergedPullRequests: 1, commitsTruncated: false, pullRequestsTruncated: false },
    },
  ],
  edges: [
    ...groups.flatMap((group) => [
      { source: "user:example", target: `group:${group}`, type: "ownership" },
      { source: `group:${group}`, target: `repository:${group}`, type: "membership" },
    ]),
    { source: "user:example", target: "repository:outside/zeta", type: "contribution" },
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
  expect(before.edgePolicy).toBe("structural-only");
  expect(before.armCount).toBe(3);
  expect(before.systems).toHaveLength(5);
  expect(before.external).toHaveLength(1);

  const systemsByRadius = [...before.systems].sort((a, b) => a.radius - b.radius);
  const inner = systemsByRadius[0];
  const outer = systemsByRadius.at(-1);
  expect(outer.radius).toBeGreaterThan(inner.radius + 20);
  expect(outer.period).toBeGreaterThan(inner.period);
  expect(before.external[0].radius).toBeGreaterThan(outer.radius);
  expect(before.external[0].period).toBeGreaterThan(outer.period);

  await page.waitForTimeout(1_250);
  const after = await galaxySnapshot(page);
  const innerAfter = after.systems.find((system) => system.id === inner.id);
  const repoBefore = inner.repositories[0];
  const repoAfter = innerAfter.repositories.find((repo) => repo.id === repoBefore.id);
  const externalAfter = after.external.find((repo) => repo.id === before.external[0].id);

  expect(distance(inner, innerAfter)).toBeGreaterThan(0.08);
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
