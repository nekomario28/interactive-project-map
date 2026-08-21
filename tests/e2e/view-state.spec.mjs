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

async function installFixture(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

function repoIds() {
  return state.nodes.filter((node) => node.type === "repository").map((node) => node.id).sort();
}

test("shared view controls compose status, motion, activity, search and local depth without new data fetches", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await installFixture(page);
  await page.goto("/u/?username=example&style=obsidian");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ProjectMapViewState?.snapshot?.().statuses?.length ?? -1)).toBe(3);

  await expect(page.locator("#resultCount")).toHaveText("4 repos");
  await page.getByRole("button", { name: "Archived" }).click();
  expect(await page.evaluate(() => window.ProjectMapViewState.snapshot().statuses)).toEqual(["original", "fork"]);
  await expect(page.locator("#resultCount")).toHaveText("3 repos");
  expect(new URL(page.url()).searchParams.get("status")).toBe("original,fork");

  await page.getByRole("button", { name: "Motion On" }).click();
  expect(await page.evaluate(() => window.ProjectMapViewState.snapshot().motionOff)).toBe(true);
  expect(new URL(page.url()).searchParams.get("motion")).toBe("off");

  await page.getByRole("button", { name: "Activity" }).click();
  expect(await page.evaluate(() => window.ProjectMapViewState.snapshot().activity)).toBe(true);
  expect(new URL(page.url()).searchParams.get("activity")).toBe("1");

  await page.locator("#search").fill("beta");
  await expect(page.locator("#resultCount")).toHaveText("1 matches");
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

  await page.getByRole("button", { name: "Archived" }).click();
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
  expect(new URL(page.url()).searchParams.has("focus")).toBe(false);
});
