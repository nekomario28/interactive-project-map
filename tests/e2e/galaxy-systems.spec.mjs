import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { renderGalaxySystemsSvg } from "../../scripts/galaxy-svg-systems.mjs";

const repositories = [
  ["robot-one", "robotics", "Python", 8],
  ["robot-two", "robotics", "C++", 4],
  ["robot-three", "robotics", "Rust", 2],
  ["ai-one", "ai", "Python", 7],
  ["ai-two", "ai", "JavaScript", 3],
  ["ai-three", "ai", "Python", 1],
  ["web-one", "web", "TypeScript", 3],
  ["web-two", "web", "JavaScript", 1],
  ["game-one", "games", "Rust", 2],
  ["game-two", "games", "C++", 1],
];

const groupDefs = [["robotics", "Robotics"], ["ai", "AI"], ["web", "Web"], ["games", "Games"]];
const graph = {
  owner: "example",
  generatedAt: "2026-08-19T00:00:00Z",
  repositoryCount: repositories.length,
  groupCount: groupDefs.length,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    ...groupDefs.map(([id, label]) => ({ id: `group:${id}`, label, type: "group", repositoryCount: repositories.filter((repo) => repo[1] === id).length })),
    ...repositories.map(([name, groupId, language, stars]) => ({
      id: `repository:${name}`, label: name, type: "repository", url: `https://github.com/example/${name}`,
      description: `${name} Galaxy family fixture`, language, topics: ["visualization"], stars, forks: 0, fork: false, archived: false,
      updatedAt: "2026-08-19T00:00:00Z", groupId, groupLabel: groupDefs.find(([id]) => id === groupId)?.[1] || groupId,
    })),
  ],
  edges: [
    ...groupDefs.map(([id]) => ({ source: "user:example", target: `group:${id}`, type: "ownership" })),
    ...repositories.map(([name, groupId]) => ({ source: `group:${groupId}`, target: `repository:${name}`, type: "membership" })),
    { source: "repository:robot-one", target: "repository:ai-one", type: "relation" },
  ],
};

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

function snapshotScript() {
  return () => {
    const owner = state.byId.get("user:example");
    return {
      groups: Object.fromEntries(state.nodes.filter((node) => node.type === "group").map((node) => [node.id, { x: node.x, y: node.y, radius: Math.hypot(node.x - owner.x, node.y - owner.y) }])),
      repos: Object.fromEntries(state.nodes.filter((node) => node.type === "repository").map((node) => {
        const group = state.byId.get(`group:${node.groupId}`);
        return [node.id, { x: node.x, y: node.y, ownGroupDistance: Math.hypot(node.x - group.x, node.y - group.y), ownerDistance: Math.hypot(node.x - owner.x, node.y - owner.y) }];
      })),
    };
  };
}

function maximumMovement(before, after, key) {
  return Math.max(...Object.keys(before[key]).map((id) => Math.hypot(after[key][id].x - before[key][id].x, after[key][id].y - before[key][id].y)));
}

async function canvasLabelsAtZoom(page, zoom) {
  return page.evaluate((nextZoom) => {
    state.zoom = nextZoom;
    state.query = "";
    state.selected = null;
    state.hovered = null;
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
    return {
      labels: seen,
      mode: window.GalaxySystemsLabelLOD.mode(),
      visible: window.GalaxySystemsLabelLOD.visibleRepositoryIds(),
      adaptive: window.ProjectMapAdaptiveLabels?.snapshot() || null,
    };
  }, zoom);
}

test.beforeAll(async () => {
  await mkdir(".tmp/playwright-visual/dark", { recursive: true });
});

test("legacy galaxy URL normalizes to Galaxy Systems", async ({ page }) => {
  await installGraph(page);
  await page.goto("/u/?username=example&style=galaxy");
  await page.waitForURL(/\/u\/\?username=example&style=galaxy-systems/);
  await expect(page.locator("#style")).toHaveValue("galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();
});

test("Galaxy Systems uses slow category motion and slower local repository orbits", async ({ page }) => {
  await installGraph(page);
  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator("#subtitle")).toContainText("Galaxy Systems");

  const before = await page.evaluate(snapshotScript());
  for (const repo of Object.values(before.repos)) {
    expect(repo.ownGroupDistance).toBeLessThan(repo.ownerDistance);
    expect(repo.ownGroupDistance).toBeGreaterThan(40);
  }

  await page.waitForTimeout(1500);
  const after = await page.evaluate(snapshotScript());
  const categoryMovement = maximumMovement(before, after, "groups");
  const repositoryMovement = maximumMovement(before, after, "repos");
  expect(categoryMovement).toBeGreaterThan(0.2);
  expect(categoryMovement).toBeLessThan(2.2);
  expect(repositoryMovement).toBeGreaterThan(0.5);
  expect(repositoryMovement).toBeLessThan(6);

  await page.screenshot({ path: ".tmp/playwright-visual/dark/galaxy-systems-slow.png", fullPage: true });
});

test("Galaxy Systems keeps useful repository labels visible and expands them as zoom allows", async ({ page }) => {
  await installGraph(page);
  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();

  const far = await canvasLabelsAtZoom(page, 0.80);
  expect(far.mode).toBe("categories");
  expect(far.visible).toHaveLength(0);
  expect(far.adaptive?.active).toBe(true);
  for (const [id, label] of groupDefs) {
    const count = repositories.filter((repo) => repo[1] === id).length;
    expect(far.labels).toContain(`${label} · ${count}`);
  }
  const farRepos = repositories.filter(([name]) => far.labels.includes(name)).map(([name]) => name);
  expect(farRepos.length).toBeGreaterThan(0);
  expect(far.adaptive.repoLabels).toBe(farRepos.length);
  await page.screenshot({ path: ".tmp/playwright-visual/dark/galaxy-systems-labels-far.png", fullPage: true });

  const middle = await canvasLabelsAtZoom(page, 1.50);
  expect(middle.mode).toBe("featured");
  expect(middle.visible).toHaveLength(8);
  const middleRepos = repositories.filter(([name]) => middle.labels.includes(name)).map(([name]) => name);
  expect(middleRepos.length).toBeGreaterThanOrEqual(farRepos.length);
  expect(middle.adaptive.repoBudget).toBeGreaterThanOrEqual(far.adaptive.repoBudget);
  expect(middle.labels).toContain("robot-one");
  expect(middle.labels).toContain("ai-one");
  await page.screenshot({ path: ".tmp/playwright-visual/dark/galaxy-systems-labels-middle.png", fullPage: true });

  const near = await canvasLabelsAtZoom(page, 2.10);
  expect(near.mode).toBe("all");
  expect(near.visible).toHaveLength(repositories.length);
  expect(near.adaptive.repoBudget).toBeGreaterThanOrEqual(middle.adaptive.repoBudget);
  for (const [name] of repositories) expect(near.labels).toContain(name);
  await page.screenshot({ path: ".tmp/playwright-visual/dark/galaxy-systems-labels-near.png", fullPage: true });

  const selectedVisible = await page.evaluate(() => {
    state.zoom = 0.80;
    updateDetails(state.byId.get("repository:robot-three"));
    return window.GalaxySystemsLabelLOD.visibleRepositoryIds();
  });
  expect(selectedVisible).toContain("repository:robot-three");

  const searchVisible = await page.evaluate(() => {
    updateDetails(null);
    state.zoom = 0.80;
    state.query = "ai-three";
    return window.GalaxySystemsLabelLOD.visibleRepositoryIds();
  });
  expect(searchVisible).toContain("repository:ai-three");
});

test("Galaxy Hybrid keeps a spiral of category systems while local repositories orbit elliptically", async ({ page }) => {
  await installGraph(page);
  await page.goto("/u/?username=example&style=galaxy-hybrid");
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator("#subtitle")).toContainText("Galaxy Hybrid");

  const before = await page.evaluate(snapshotScript());
  const radii = Object.values(before.groups).map((group) => group.radius);
  expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(100);
  for (const repo of Object.values(before.repos)) expect(repo.ownGroupDistance).toBeLessThan(repo.ownerDistance);

  await page.waitForTimeout(1500);
  const after = await page.evaluate(snapshotScript());
  const categoryMovement = maximumMovement(before, after, "groups");
  const repositoryMovement = maximumMovement(before, after, "repos");
  expect(categoryMovement).toBeGreaterThan(0.15);
  expect(categoryMovement).toBeLessThan(2.2);
  expect(repositoryMovement).toBeGreaterThan(0.4);
  expect(repositoryMovement).toBeLessThan(6);

  await page.screenshot({ path: ".tmp/playwright-visual/dark/galaxy-hybrid.png", fullPage: true });
});

test("Galaxy Classic remains the original global Living Galaxy presentation", async ({ page }) => {
  await installGraph(page);
  await page.goto("/u/?username=example&style=galaxy-classic");
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator("#subtitle")).toContainText("Living Galaxy");
  const before = await page.evaluate(snapshotScript());
  await page.waitForTimeout(1200);
  const after = await page.evaluate(snapshotScript());
  expect(maximumMovement(before, after, "repos")).toBeGreaterThan(0.2);
  await page.screenshot({ path: ".tmp/playwright-visual/dark/galaxy-classic.png", fullPage: true });
});

test("declarative Systems orbit animation advances in a normal browser image", async ({ page }) => {
  const svg = renderGalaxySystemsSvg(graph, "dark", 740, 420);
  assert.match(svg, /<animateTransform/);
  assert.match(svg, /dur="1800s"/);
  assert.match(svg, /dur="360s"/);
  const source = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  await page.setContent(`<body style="margin:0;background:#000"><img id="map" width="740" height="420" src="${source}"></body>`);
  await expect(page.locator("#map")).toBeVisible();
  await page.waitForTimeout(250);
  const first = await page.locator("#map").screenshot();
  await page.waitForTimeout(1800);
  const second = await page.locator("#map").screenshot();
  assert.equal(first.equals(second), false, "a standards-compliant image context should advance the declarative SVG orbit animation");
});
