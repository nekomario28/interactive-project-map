import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { renderGalaxySvg } from "../../scripts/svg.mjs";

const repositories = [
  ["robot-one", "robotics", "Python", 8],
  ["robot-two", "robotics", "C++", 4],
  ["robot-three", "robotics", "Rust", 2],
  ["ai-one", "ai", "Python", 7],
  ["ai-two", "ai", "JavaScript", 3],
  ["ai-three", "ai", "Python", 1],
];

const graph = {
  owner: "example",
  generatedAt: "2026-08-19T00:00:00Z",
  repositoryCount: repositories.length,
  groupCount: 2,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 3 },
    { id: "group:ai", label: "AI", type: "group", repositoryCount: 3 },
    ...repositories.map(([name, groupId, language, stars]) => ({
      id: `repository:${name}`,
      label: name,
      type: "repository",
      url: `https://github.com/example/${name}`,
      description: `${name} Galaxy Systems fixture`,
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

test.beforeAll(async () => {
  await mkdir(".tmp/playwright-visual/dark", { recursive: true });
});

test("interactive Galaxy groups repositories into local category systems", async ({ page }) => {
  await installGraph(page);
  await page.goto("/u/?username=example&style=galaxy");
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator("#subtitle")).toContainText("Galaxy Systems");

  const before = await page.evaluate(() => {
    const owner = state.byId.get("user:example");
    const groups = state.nodes.filter((node) => node.type === "group");
    const repos = state.nodes.filter((node) => node.type === "repository");
    return {
      groups: Object.fromEntries(groups.map((node) => [node.id, { x: node.x, y: node.y }])),
      repos: Object.fromEntries(repos.map((node) => {
        const group = state.byId.get(`group:${node.groupId}`);
        return [node.id, {
          x: node.x,
          y: node.y,
          ownGroupDistance: Math.hypot(node.x - group.x, node.y - group.y),
          ownerDistance: Math.hypot(node.x - owner.x, node.y - owner.y),
        }];
      })),
    };
  });

  for (const repo of Object.values(before.repos)) {
    expect(repo.ownGroupDistance).toBeLessThan(repo.ownerDistance);
    expect(repo.ownGroupDistance).toBeGreaterThan(40);
  }

  await page.waitForTimeout(1400);
  const after = await page.evaluate(() => ({
    groups: Object.fromEntries(state.nodes.filter((node) => node.type === "group").map((node) => [node.id, { x: node.x, y: node.y }])),
    repos: Object.fromEntries(state.nodes.filter((node) => node.type === "repository").map((node) => [node.id, { x: node.x, y: node.y }])),
  }));

  const groupMovement = Math.max(...Object.keys(before.groups).map((id) => Math.hypot(after.groups[id].x - before.groups[id].x, after.groups[id].y - before.groups[id].y)));
  const repoMovement = Math.max(...Object.keys(before.repos).map((id) => Math.hypot(after.repos[id].x - before.repos[id].x, after.repos[id].y - before.repos[id].y)));
  expect(groupMovement).toBeLessThan(0.05);
  expect(repoMovement).toBeGreaterThan(1);

  await page.screenshot({ path: ".tmp/playwright-visual/dark/galaxy-systems.png", fullPage: true });
});

test("declarative Galaxy orbit animation runs when the SVG is used as a normal browser image", async ({ page }) => {
  const svg = renderGalaxySvg(graph, "dark", 740, 420, "galaxy");
  assert.match(svg, /<animateTransform/);
  const source = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  await page.setContent(`<body style="margin:0;background:#000"><img id="map" width="740" height="420" src="${source}"></body>`);
  await expect(page.locator("#map")).toBeVisible();
  await page.waitForTimeout(250);
  const first = await page.locator("#map").screenshot();
  await page.waitForTimeout(1800);
  const second = await page.locator("#map").screenshot();
  assert.equal(first.equals(second), false, "a standards-compliant image context should advance the declarative SVG orbit animation");
});
