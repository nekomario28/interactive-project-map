import { expect, test } from "@playwright/test";

function makeDenseGalaxyGraph() {
  const repositories = Array.from({ length: 9 }, (_, index) => {
    const repositoryName = `dense-${index + 1}`;
    return {
      id: `repository:${repositoryName}`,
      label: repositoryName,
      repositoryName,
      type: "repository",
      url: `https://github.com/example/${repositoryName}`,
      description: `Dense Galaxy local-lane evidence repository ${index + 1}`,
      language: "TypeScript",
      stars: 20 - index,
      forks: 0,
      fork: false,
      archived: false,
      relation: "owned",
      groupId: "dense",
      groupLabel: "Dense",
      topics: ["galaxy-local-lane-evidence"],
      updatedAt: "2026-09-01T00:00:00Z",
    };
  });

  return {
    owner: "example",
    generatedAt: "2026-09-01T00:00:00Z",
    repositoryCount: repositories.length,
    groupCount: 1,
    nodes: [
      { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
      { id: "group:dense", label: "Dense", type: "group", repositoryCount: repositories.length },
      ...repositories,
    ],
    edges: [
      { source: "user:example", target: "group:dense", type: "ownership" },
      ...repositories.map((repository) => ({ source: "group:dense", target: repository.id, type: "membership" })),
    ],
  };
}

test("Galaxy local ellipse period family advances on the compact 3D packing lane", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "One real Three.js lane-progression check is enough; WebKit keeps the broader smoke suite.");
  const graph = makeDenseGalaxyGraph();
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });

  await page.goto("/three/?username=example&style3d=galaxy&motion=off");
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });

  const snapshot = await page.evaluate(() => window.ProjectMapThreejsGalaxyMotion?.snapshot());
  expect(snapshot).toBeTruthy();
  expect(snapshot.localOrbitModel).toBe("2d-galaxy-hybrid-ellipse");
  expect(snapshot.localOrbitAxisRatio).toBeCloseTo(0.68, 8);
  expect(snapshot.localOrbitPeriodModel).toBe("480+lane*240");
  expect(snapshot.edgePolicy).toBe("no-persistent-lines");
  expect(snapshot.persistentEdgeObjects).toBe(0);
  expect(snapshot.systems).toHaveLength(1);

  const repositories = snapshot.systems[0].repositories;
  expect(repositories).toHaveLength(9);
  expect(repositories.map((repository) => repository.period).sort((a, b) => a - b)).toEqual([
    480, 480, 480, 480, 480, 480, 480, 480, 720,
  ]);
  expect(new Set(repositories.map((repository) => repository.direction)).size).toBe(1);
  expect(Math.abs(repositories[0].direction)).toBe(1);
  for (const repository of repositories) {
    expect(repository.semiMajor).toBeGreaterThan(0);
    expect(repository.semiMinor / repository.semiMajor).toBeCloseTo(0.68, 8);
  }
});
