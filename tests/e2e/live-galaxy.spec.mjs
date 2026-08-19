import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-19T00:00:00Z",
  repositoryCount: 6,
  groupCount: 2,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 3 },
    { id: "group:ai", label: "AI", type: "group", repositoryCount: 3 },
    ...[
      ["robot-one", "robotics", "Python", 8],
      ["robot-two", "robotics", "C++", 4],
      ["robot-three", "robotics", "Rust", 2],
      ["ai-one", "ai", "Python", 7],
      ["ai-two", "ai", "JavaScript", 3],
      ["ai-three", "ai", "Python", 1],
    ].map(([name, groupId, language, stars]) => ({
      id: `repository:${name}`,
      label: name,
      type: "repository",
      url: `https://github.com/example/${name}`,
      description: `${name} live-galaxy fixture`,
      language,
      topics: ["visualization"],
      stars,
      forks: 0,
      fork: false,
      archived: false,
      updatedAt: "2026-08-19T00:00:00Z",
      groupId,
      groupLabel: groupId === "robotics" ? "Robotics" : "AI",
    })),
  ],
  edges: [
    { source: "user:example", target: "group:robotics", type: "ownership" },
    { source: "user:example", target: "group:ai", type: "ownership" },
    ...["robot-one", "robot-two", "robot-three"].map((name) => ({ source: "group:robotics", target: `repository:${name}`, type: "membership" })),
    ...["ai-one", "ai-two", "ai-three"].map((name) => ({ source: "group:ai", target: `repository:${name}`, type: "membership" })),
  ],
};

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

function browserErrors(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  return failures;
}

test.beforeAll(async () => {
  await mkdir(".tmp/playwright-visual/dark", { recursive: true });
});

test("Galaxy follows the original live github.io orbital motion", async ({ page }) => {
  await installGraph(page);
  const failures = browserErrors(page);
  await page.goto("/u/?username=example&style=galaxy");
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator("#subtitle")).toContainText("Living Galaxy");

  const before = await page.evaluate(() => Object.fromEntries(
    state.nodes.filter((node) => node.type === "repository").map((node) => [node.id, { x: node.x, y: node.y }]),
  ));
  await page.waitForTimeout(1300);
  const after = await page.evaluate(() => Object.fromEntries(
    state.nodes.filter((node) => node.type === "repository").map((node) => [node.id, { x: node.x, y: node.y }]),
  ));

  const displacement = Math.max(...Object.keys(before).map((id) => Math.hypot(after[id].x - before[id].x, after[id].y - before[id].y)));
  expect(displacement).toBeGreaterThan(1);
  await page.screenshot({ path: ".tmp/playwright-visual/dark/galaxy-live.png", fullPage: true });
  expect(failures).toEqual([]);
});

test("Obsidian drag reheats the graph so connected nodes respond", async ({ page }) => {
  await installGraph(page);
  const failures = browserErrors(page);
  await page.goto("/u/?username=example&style=obsidian");
  await expect(page.locator("#status")).toBeHidden();
  await page.waitForTimeout(2200);

  const before = await page.evaluate(() => {
    const dragged = state.byId.get("repository:robot-one");
    const neighbor = state.byId.get("group:robotics");
    const point = worldToScreen(dragged.x, dragged.y);
    const rect = document.getElementById("galaxy").getBoundingClientRect();
    return {
      screen: { x: rect.left + point.x, y: rect.top + point.y },
      dragged: { x: dragged.x, y: dragged.y },
      neighbor: { x: neighbor.x, y: neighbor.y },
    };
  });

  await page.mouse.move(before.screen.x, before.screen.y);
  await page.mouse.down();
  await page.mouse.move(before.screen.x + 110, before.screen.y + 60, { steps: 12 });
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(650);

  const after = await page.evaluate(() => {
    const dragged = state.byId.get("repository:robot-one");
    const neighbor = state.byId.get("group:robotics");
    return { dragged: { x: dragged.x, y: dragged.y }, neighbor: { x: neighbor.x, y: neighbor.y } };
  });
  expect(Math.hypot(after.dragged.x - before.dragged.x, after.dragged.y - before.dragged.y)).toBeGreaterThan(20);
  expect(Math.hypot(after.neighbor.x - before.neighbor.x, after.neighbor.y - before.neighbor.y)).toBeGreaterThan(1);
  await page.screenshot({ path: ".tmp/playwright-visual/dark/obsidian-live.png", fullPage: true });
  expect(failures).toEqual([]);
});

test("style query text is authoritative even when the path still names another preset", async ({ page }) => {
  await installGraph(page);
  const failures = browserErrors(page);

  await page.goto("/tree/?username=example&style=galaxy");
  await page.waitForURL(/\/u\/\?username=example&style=galaxy/);
  await expect(page.locator("#style")).toHaveValue("galaxy");
  await expect(page.locator("#status")).toBeHidden();

  await page.goto("/u/?username=example&style=tree");
  await page.waitForURL(/\/tree\/\?username=example&style=tree/);
  await expect(page.locator("#style")).toHaveValue("tree");
  await expect(page.locator("#status")).toBeHidden();
  expect(failures).toEqual([]);
});
