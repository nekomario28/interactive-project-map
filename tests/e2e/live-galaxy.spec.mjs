import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const repoNames = ["robot-one", "robot-two", "robot-three", "ai-one", "ai-two", "ai-three"];
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
      description: `${name} regression fixture`,
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
    { source: "repository:robot-one", target: "repository:ai-one", type: "relation" },
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

async function capturedCanvasLabels(page) {
  return page.evaluate(() => {
    const seen = [];
    const original = ctx.fillText;
    ctx.fillText = function capture(text, ...args) {
      seen.push(String(text));
      return original.call(this, text, ...args);
    };
    try {
      draw();
    } finally {
      ctx.fillText = original;
    }
    return seen;
  });
}

test.beforeAll(async () => {
  await mkdir(".tmp/playwright-visual/dark", { recursive: true });
});

test("Galaxy keeps normal-size repository labels visible while orbiting", async ({ page }) => {
  await installGraph(page);
  const failures = browserErrors(page);
  await page.goto("/u/?username=example&style=galaxy");
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator("#subtitle")).toContainText("Living Galaxy");

  const labels = await capturedCanvasLabels(page);
  for (const name of repoNames) expect(labels).toContain(name);

  const before = await page.evaluate(() => Object.fromEntries(
    state.nodes.filter((node) => node.type === "repository").map((node) => [node.id, { x: node.x, y: node.y }]),
  ));
  await page.waitForTimeout(1300);
  const after = await page.evaluate(() => Object.fromEntries(
    state.nodes.filter((node) => node.type === "repository").map((node) => [node.id, { x: node.x, y: node.y }]),
  ));
  const displacement = Math.max(...Object.keys(before).map((id) => Math.hypot(after[id].x - before[id].x, after[id].y - before[id].y)));
  expect(displacement).toBeGreaterThan(1);

  await page.evaluate(() => updateDetails(state.byId.get("repository:robot-one")));
  await page.screenshot({ path: ".tmp/playwright-visual/dark/galaxy-selected.png", fullPage: true });
  expect(failures).toEqual([]);
});

test("Obsidian is pre-settled and still at rest before interaction", async ({ page }) => {
  await installGraph(page);
  const failures = browserErrors(page);
  await page.goto("/u/?username=example&style=obsidian");
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator("#subtitle")).toContainText("settled at rest");
  await page.waitForTimeout(250);

  const before = await page.evaluate(() => Object.fromEntries(state.nodes.map((node) => [node.id, { x: node.x, y: node.y }])));
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => Object.fromEntries(state.nodes.map((node) => [node.id, { x: node.x, y: node.y }])));
  const displacement = Math.max(...Object.keys(before).map((id) => Math.hypot(after[id].x - before[id].x, after[id].y - before[id].y)));
  expect(displacement).toBeLessThan(0.05);
  expect(failures).toEqual([]);
});

test("Obsidian drag reheats the whole graph with no release anchor", async ({ page }) => {
  await installGraph(page);
  const failures = browserErrors(page);
  await page.goto("/u/?username=example&style=obsidian");
  await expect(page.locator("#status")).toBeHidden();
  await page.waitForTimeout(300);

  const before = await page.evaluate(() => {
    const dragged = state.byId.get("repository:robot-one");
    const neighbor = state.byId.get("group:robotics");
    const distant = state.byId.get("repository:ai-three");
    const point = worldToScreen(dragged.x, dragged.y);
    const rect = document.getElementById("galaxy").getBoundingClientRect();
    return {
      screen: { x: rect.left + point.x, y: rect.top + point.y },
      dragged: { x: dragged.x, y: dragged.y },
      neighbor: { x: neighbor.x, y: neighbor.y },
      distant: { x: distant.x, y: distant.y },
    };
  });

  await page.mouse.move(before.screen.x, before.screen.y);
  await page.mouse.down();
  await page.mouse.move(before.screen.x + 110, before.screen.y + 60, { steps: 12 });
  await page.waitForTimeout(260);
  await page.mouse.up();
  await page.waitForTimeout(850);

  const after = await page.evaluate(() => {
    const dragged = state.byId.get("repository:robot-one");
    const neighbor = state.byId.get("group:robotics");
    const distant = state.byId.get("repository:ai-three");
    return {
      dragged: { x: dragged.x, y: dragged.y },
      neighbor: { x: neighbor.x, y: neighbor.y },
      distant: { x: distant.x, y: distant.y },
    };
  });
  expect(Math.hypot(after.dragged.x - before.dragged.x, after.dragged.y - before.dragged.y)).toBeGreaterThan(20);
  expect(Math.hypot(after.neighbor.x - before.neighbor.x, after.neighbor.y - before.neighbor.y)).toBeGreaterThan(1);
  expect(Math.hypot(after.distant.x - before.distant.x, after.distant.y - before.distant.y)).toBeGreaterThan(0.05);

  await page.screenshot({ path: ".tmp/playwright-visual/dark/obsidian-global-reheat.png", fullPage: true });
  expect(failures).toEqual([]);
});

test("Tree keeps every repository child on exactly one parallel level", async ({ page }) => {
  await installGraph(page);
  const failures = browserErrors(page);
  await page.goto("/tree/?username=example&style=tree");
  await expect(page.locator("#status")).toBeHidden();
  const levels = await page.evaluate(() => [...new Set(state.nodes.filter((node) => node.type === "repository").map((node) => node.y.toFixed(4)))]);
  expect(levels).toHaveLength(1);
  await page.screenshot({ path: ".tmp/playwright-visual/dark/tree-parallel.png", fullPage: true });
  expect(failures).toEqual([]);
});

test("Sunburst prints every repository name for a normal-size portfolio", async ({ page }) => {
  await installGraph(page);
  const failures = browserErrors(page);
  await page.goto("/sunburst/?username=example&style=sunburst");
  await expect(page.locator("#status")).toBeHidden();
  const labels = await capturedCanvasLabels(page);
  for (const name of repoNames) expect(labels).toContain(name);
  await page.screenshot({ path: ".tmp/playwright-visual/dark/sunburst-labels.png", fullPage: true });
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
