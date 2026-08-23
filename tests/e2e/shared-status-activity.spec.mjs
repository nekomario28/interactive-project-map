import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-22T00:00:00Z",
  repositoryCount: 4,
  groupCount: 2,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 3 },
    { id: "group:web", label: "Web", type: "group", repositoryCount: 1 },
    { id: "repository:alpha", label: "alpha", type: "repository", url: "https://github.com/example/alpha", language: "Python", fork: false, archived: false, updatedAt: "2026-08-21T00:00:00Z", groupId: "robotics", groupLabel: "Robotics" },
    { id: "repository:beta", label: "beta", type: "repository", url: "https://github.com/example/beta", language: "C++", fork: true, archived: false, updatedAt: "2026-06-15T00:00:00Z", groupId: "robotics", groupLabel: "Robotics" },
    { id: "repository:gamma", label: "gamma", type: "repository", url: "https://github.com/example/gamma", language: "Rust", fork: false, archived: true, updatedAt: "2025-01-01T00:00:00Z", groupId: "robotics", groupLabel: "Robotics" },
    { id: "repository:delta", label: "delta", type: "repository", url: "https://github.com/example/delta", language: "TypeScript", fork: false, archived: false, updatedAt: "2026-08-10T00:00:00Z", groupId: "web", groupLabel: "Web" },
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
    { source: "repository:alpha", target: "repository:beta", type: "semantic", score: 0.9 },
  ],
};

async function installFixture(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function canvasImage(page) {
  return page.locator("#galaxy").evaluate((canvas) => canvas.toDataURL("image/png"));
}

async function renderSnapshot(page) {
  return page.evaluate(() => window.ProjectMapRenderProjection?.snapshot?.() || null);
}

async function obsidianSnapshot(page) {
  return page.evaluate(() => window.ProjectMapObsidianRuntime?.snapshot?.() || null);
}

test("shared repository filters change the actual layout and canvas", async ({ page }) => {
  await installFixture(page);
  await page.goto("/u/?username=example&style=galaxy-systems&motion=off");
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.getByRole("button", { name: /Original repositories: 2/ })).toHaveText("Original 2");
  await expect(page.getByRole("button", { name: /Fork repositories: 1/ })).toHaveText("Fork 1");
  await expect(page.getByRole("button", { name: /Archived repositories: 1/ })).toHaveText("Archived 1");
  await expect(page.locator("#resultCount")).toHaveText("4 / 4 repos");

  await expect.poll(async () => (await renderSnapshot(page))?.repositories?.sort()).toEqual([
    "repository:alpha",
    "repository:beta",
    "repository:delta",
    "repository:gamma",
  ]);
  const allCanvas = await canvasImage(page);

  await page.getByRole("button", { name: /Fork repositories: 1/ }).click();
  await expect(page.locator("#resultCount")).toHaveText("3 / 4 repos");
  await expect.poll(async () => (await renderSnapshot(page))?.repositories?.sort()).toEqual([
    "repository:alpha",
    "repository:delta",
    "repository:gamma",
  ]);
  const withoutFork = await canvasImage(page);
  expect(withoutFork).not.toEqual(allCanvas);

  await page.getByRole("button", { name: /Fork repositories: 1/ }).click();
  await expect(page.locator("#resultCount")).toHaveText("4 / 4 repos");
  await expect.poll(async () => (await renderSnapshot(page))?.repositories?.length).toBe(4);
});

test("Activity changes final canvas output and OFF restores the base rendering", async ({ page }) => {
  await installFixture(page);
  await page.goto("/u/?username=example&style=obsidian&motion=off");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(async () => (await renderSnapshot(page))?.repositories?.length).toBe(4);
  await expect.poll(async () => (await obsidianSnapshot(page))?.phase).toBe("settled");
  const baseCanvas = await canvasImage(page);

  const activity = page.locator("#activityToggle");
  await activity.click();
  await expect(activity).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await renderSnapshot(page))?.activityOverlayCount).toBe(4);
  const activityCanvas = await canvasImage(page);
  expect(activityCanvas).not.toEqual(baseCanvas);

  await activity.click();
  await expect(activity).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => (await renderSnapshot(page))?.activityOverlayCount).toBe(0);
  await expect.poll(async () => await canvasImage(page)).toBe(baseCanvas);
});