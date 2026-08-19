import { expect, test } from "@playwright/test";

const graph = {
  owner: "example", generatedAt: "2026-08-19T00:00:00Z", repositoryCount: 2, groupCount: 1,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 2 },
    { id: "repository:alpha", label: "alpha", type: "repository", url: "https://github.com/example/alpha", description: "alpha project", language: "Python", topics: [], stars: 1, forks: 0, fork: false, archived: false, updatedAt: "2026-08-19T00:00:00Z", groupId: "robotics", groupLabel: "Robotics" },
    { id: "repository:beta", label: "beta", type: "repository", url: "https://github.com/example/beta", description: "beta project", language: "Rust", topics: [], stars: 1, forks: 0, fork: false, archived: false, updatedAt: "2026-08-19T00:00:00Z", groupId: "robotics", groupLabel: "Robotics" },
  ],
  edges: [
    { source: "user:example", target: "group:robotics", type: "ownership" },
    { source: "group:robotics", target: "repository:alpha", type: "membership" },
    { source: "group:robotics", target: "repository:beta", type: "membership" },
  ],
};

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function clickNode(page, id) {
  const point = await page.evaluate((nodeId) => {
    const node = state.byId.get(nodeId); const screen = worldToScreen(node.x, node.y); const rect = document.getElementById("galaxy").getBoundingClientRect();
    return { x: rect.left + screen.x, y: rect.top + screen.y };
  }, id);
  await page.mouse.click(point.x, point.y);
}

async function clickEmptyCanvas(page) {
  const point = await page.evaluate(() => {
    const canvas = document.getElementById("galaxy"); const rect = canvas.getBoundingClientRect();
    const candidates = [[24, 24], [rect.width - 24, 24], [24, rect.height - 24], [rect.width - 24, rect.height - 24]];
    for (const [x, y] of candidates) if (!hitTest(x, y)) return { x: rect.left + x, y: rect.top + y };
    return { x: rect.left + 12, y: rect.top + 12 };
  });
  await page.mouse.click(point.x, point.y);
}

for (const style of ["galaxy-classic", "galaxy-systems", "galaxy-hybrid", "obsidian"]) {
  test(`${style}: blank click clears selection and another node switches focus`, async ({ page }) => {
    await installGraph(page);
    await page.goto(`/u/?username=example&style=${style}`);
    await expect(page.locator("#status")).toBeHidden();
    await clickNode(page, "repository:alpha");
    await expect(page.locator("#detailsTitle")).toHaveText("alpha");
    await expect.poll(() => page.evaluate(() => state.selected?.id || null)).toBe("repository:alpha");
    await clickEmptyCanvas(page);
    await expect(page.locator("#detailsTitle")).toHaveText("Project map");
    await expect.poll(() => page.evaluate(() => state.selected?.id || null)).toBe(null);
    await clickNode(page, "repository:alpha");
    await clickNode(page, "repository:beta");
    await expect(page.locator("#detailsTitle")).toHaveText("beta");
    await expect.poll(() => page.evaluate(() => state.selected?.id || null)).toBe("repository:beta");
  });
}
