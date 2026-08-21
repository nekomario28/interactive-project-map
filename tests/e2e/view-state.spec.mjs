import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-21T00:00:00Z",
  repositoryCount: 4,
  groupCount: 2,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 3 },
    { id: "group:web", label: "Web", type: "group", repositoryCount: 1 },
    { id: "repository:alpha", label: "alpha", type: "repository", url: "https://github.com/example/alpha", description: "root robot", language: "Python", topics: ["robotics"], stars: 4, forks: 0, fork: false, archived: false, updatedAt: "2026-08-20T00:00:00Z", groupId: "robotics", groupLabel: "Robotics" },
    { id: "repository:beta", label: "beta", type: "repository", url: "https://github.com/example/beta", description: "fork neighbor", language: "C++", topics: ["robotics"], stars: 2, forks: 1, fork: true, archived: false, updatedAt: "2026-06-01T00:00:00Z", groupId: "robotics", groupLabel: "Robotics" },
    { id: "repository:gamma", label: "gamma", type: "repository", url: "https://github.com/example/gamma", description: "archived second hop", language: "Rust", topics: ["robotics"], stars: 1, forks: 0, fork: false, archived: true, updatedAt: "2025-01-01T00:00:00Z", groupId: "robotics", groupLabel: "Robotics" },
    { id: "repository:delta", label: "delta", type: "repository", url: "https://github.com/example/delta", description: "unrelated web", language: "TypeScript", topics: ["web"], stars: 1, forks: 0, fork: false, archived: false, updatedAt: "2026-08-10T00:00:00Z", groupId: "web", groupLabel: "Web" },
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
    { source: "repository:beta", target: "repository:gamma", type: "semantic", score: 0.90 },
  ],
};

async function installFixture(page, fixture = graph) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture) });
  });
}

function repoIds() {
  return state.nodes.filter((node) => node.type === "repository").map((node) => node.id).sort();
}

async function hitRepository(page, id) {
  return page.evaluate((repositoryId) => {
    const node = state.byId.get(repositoryId);
    if (!node) return null;
    const point = worldToScreen(node.x, node.y);
    return hitTest(point.x, point.y)?.id || null;
  }, id);
}

test("shared view controls visibly filter every repository status and compose with motion, activity, search and local depth", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await installFixture(page);
  await page.goto("/u/?username=example&style=obsidian");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ProjectMapViewState?.snapshot?.().statuses?.length ?? -1)).toBe(3);

  await expect(page.getByRole("group", { name: "Repositories" })).toBeVisible();
  await expect(page.getByRole("group", { name: "View" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Original repositories: 2/ })).toHaveText("Original 2");
  await expect(page.getByRole("button", { name: /^Fork repositories: 1/ })).toHaveText("Fork 1");
  await expect(page.getByRole("button", { name: /^Archived repositories: 1/ })).toHaveText("Archived 1");
  await expect(page.locator("#resultCount")).toHaveText("4 / 4 repos");

  for (const [label, id] of [
    ["Original", "repository:alpha"],
    ["Fork", "repository:beta"],
    ["Archived", "repository:gamma"],
  ]) {
    const button = page.getByRole("button", { name: new RegExp(`^${label} repositories:`) });
    await page.evaluate((repositoryId) => { state.hovered = state.byId.get(repositoryId); }, id);
    await button.click();
    expect(await hitRepository(page, id)).not.toBe(id);
    expect(await page.evaluate(() => state.hovered?.id || null)).toBeNull();
    await button.click();
    expect(await hitRepository(page, id)).toBe(id);
  }

  const archivedButton = page.getByRole("button", { name: /^Archived repositories:/ });
  await archivedButton.click();
  expect(await page.evaluate(() => window.ProjectMapViewState.snapshot().statuses)).toEqual(["original", "fork"]);
  await expect(page.locator("#resultCount")).toHaveText("3 / 4 repos");
  expect(new URL(page.url()).searchParams.get("status")).toBe("original,fork");

  await page.getByRole("button", { name: "Motion On" }).click();
  expect(await page.evaluate(() => window.ProjectMapViewState.snapshot().motionOff)).toBe(true);
  expect(new URL(page.url()).searchParams.get("motion")).toBe("off");

  await page.getByRole("button", { name: "Activity" }).click();
  expect(await page.evaluate(() => window.ProjectMapViewState.snapshot().activity)).toBe(true);
  expect(new URL(page.url()).searchParams.get("activity")).toBe("1");

  await page.locator("#search").fill("beta");
  await expect(page.locator("#resultCount")).toHaveText("1 matches · 3/4 repos");
  expect(new URL(page.url()).searchParams.get("q")).toBe("beta");
  await page.locator("#search").fill("");

  await page.evaluate(() => updateDetails(state.byId.get("repository:alpha")));
  await expect(page.locator("#focusButton")).toHaveText("Focus");
  await page.locator("#focusButton").click();
  await expect.poll(() => page.evaluate(repoIds)).toEqual(["repository:alpha", "repository:beta"]);
  expect(await page.evaluate(() => window.ProjectMapViewState.snapshot().focusDepth)).toBe(1);

  await page.getByRole("button", { name: "2", exact: true }).click();
  // gamma is still excluded by the active Archived status filter, proving that
  // status visibility is applied before relation-depth traversal.
  await expect.poll(() => page.evaluate(repoIds)).toEqual(["repository:alpha", "repository:beta"]);

  await archivedButton.click();
  await expect.poll(() => page.evaluate(repoIds)).toEqual(["repository:alpha", "repository:beta", "repository:gamma"]);
  expect(await page.evaluate(() => state.nodes.some((node) => node.id === "repository:delta"))).toBe(false);
  expect(new URL(page.url()).searchParams.get("depth")).toBe("2");

  await page.getByRole("button", { name: "Exit focus" }).click();
  await expect.poll(() => page.evaluate(repoIds)).toEqual([
    "repository:alpha",
    "repository:beta",
    "repository:delta",
    "repository:gamma",
  ]);
  await expect(page.locator("#resultCount")).toHaveText("4 / 4 repos");
  expect(new URL(page.url()).searchParams.has("focus")).toBe(false);
});

test("a status with zero repositories is disabled instead of looking like a broken filter", async ({ page }) => {
  const nodes = graph.nodes.filter((node) => node.id !== "repository:gamma");
  const fixture = {
    ...graph,
    repositoryCount: 3,
    nodes,
    edges: graph.edges.filter((edge) => edge.source !== "repository:gamma" && edge.target !== "repository:gamma"),
    semanticEdges: graph.semanticEdges.filter((edge) => edge.source !== "repository:gamma" && edge.target !== "repository:gamma"),
  };
  await installFixture(page, fixture);
  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();

  const archivedButton = page.getByRole("button", { name: /^Archived repositories: 0/ });
  await expect(archivedButton).toBeDisabled();
  await expect(archivedButton).toHaveText("Archived 0");
  await expect(archivedButton).toHaveAttribute("title", /No archived repositories are available/);
  await expect(page.locator("#resultCount")).toHaveText("3 / 3 repos");
  expect(await page.evaluate(() => window.ProjectMapViewState.snapshot().statusCounts)).toEqual({ original: 2, fork: 1, archived: 0 });
  expect(await page.evaluate(() => window.ProjectMapViewState.snapshot().statuses)).toEqual(["original", "fork"]);
  expect(new URL(page.url()).searchParams.has("status")).toBe(false);
});