import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-26T00:00:00Z",
  repositoryCount: 4,
  groupCount: 2,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 3 },
    { id: "group:web", label: "Web", type: "group", repositoryCount: 1 },
    { id: "repository:alpha", label: "alpha", type: "repository", url: "https://github.com/example/alpha", groupId: "robotics", groupLabel: "Robotics", fork: false, archived: false },
    { id: "repository:beta", label: "beta", type: "repository", url: "https://github.com/example/beta", groupId: "robotics", groupLabel: "Robotics", fork: true, archived: false },
    { id: "repository:gamma", label: "gamma", type: "repository", url: "https://github.com/example/gamma", groupId: "robotics", groupLabel: "Robotics", fork: false, archived: true },
    { id: "repository:delta", label: "delta", type: "repository", url: "https://github.com/example/delta", groupId: "web", groupLabel: "Web", fork: false, archived: false },
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
    { source: "repository:alpha", target: "repository:beta", type: "semantic", score: 0.95 },
    { source: "repository:beta", target: "repository:gamma", type: "semantic", score: 0.9 },
  ],
};

async function installFixture(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

function canonicalProjection(projected) {
  return {
    nodeIds: projected.nodes.map((node) => node.id).sort(),
    edgeIds: [...projected.edges, ...projected.semanticEdges]
      .map((edge) => `${edge.type || "edge"}:${edge.source}->${edge.target}`)
      .sort(),
  };
}

test("2D and Three.js consume identical Local Graph node/edge projection IDs", async ({ page }) => {
  await installFixture(page);
  const state = "username=example&status=original,fork,archived&focus=repository:alpha&depth=2";
  await page.goto(`/three/?${state}`);
  await expect(page.locator("#status")).toHaveClass(/ready/);
  await expect(page.locator("#focusControls")).toBeVisible();

  const three = await expect.poll(async () => page.evaluate(() => window.ProjectMapThreejsLocalGraph?.snapshot?.() || null)).not.toBeNull().then(async () => page.evaluate(() => window.ProjectMapThreejsLocalGraph.snapshot()));
  expect(three.focusRoot).toBe("repository:alpha");
  expect(three.depth).toBe(2);
  expect(three.nodeIds).toEqual([
    "group:robotics",
    "repository:alpha",
    "repository:beta",
    "repository:gamma",
    "user:example",
  ]);
  await expect(page.locator("#resultCount")).toHaveText("3 / 4 projects");

  await page.goto(`/u/?${state}&style=obsidian`);
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ProjectMapViewState?.snapshot?.().focusRoot || null)).toBe("repository:alpha");
  const two = await page.evaluate(() => {
    const snapshot = window.ProjectMapViewState.snapshot();
    const projected = window.ProjectMapViewModel.projectLocalGraph(
      state.graph,
      snapshot.focusRoot,
      snapshot.focusDepth,
      snapshot.statuses,
    );
    return {
      nodeIds: projected.nodes.map((node) => node.id).sort(),
      edgeIds: [...projected.edges, ...projected.semanticEdges]
        .map((edge) => `${edge.type || "edge"}:${edge.source}->${edge.target}`)
        .sort(),
    };
  });
  expect(two).toEqual({ nodeIds: three.nodeIds, edgeIds: three.edgeIds });
});

test("Three.js Local Graph depth and exit controls update transferable URL state", async ({ page }) => {
  await installFixture(page);
  await page.goto("/three/?username=example&status=original,fork,archived&focus=repository:alpha&depth=2");
  await expect(page.locator("#status")).toHaveClass(/ready/);
  await expect(page.locator("#focusControls")).toBeVisible();

  await page.getByRole("button", { name: "1", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.ProjectMapThreejsLocalGraph.snapshot().nodeIds)).toEqual([
    "group:robotics",
    "repository:alpha",
    "repository:beta",
    "user:example",
  ]);
  expect(new URL(page.url()).searchParams.get("depth")).toBe("1");
  await expect(page.locator("#resultCount")).toHaveText("2 / 4 projects");

  await page.getByRole("button", { name: "Exit focus" }).click();
  await expect(page.locator("#focusControls")).toBeHidden();
  expect(new URL(page.url()).searchParams.has("focus")).toBe(false);
  expect(new URL(page.url()).searchParams.has("depth")).toBe(false);
  await expect(page.locator("#resultCount")).toHaveText("4 / 4 projects");
});
