import { expect, test } from "@playwright/test";

function repository(id, label, groupId, groupLabel) {
  return {
    id,
    label,
    repositoryName: label,
    type: "repository",
    url: `https://github.com/example/${label}`,
    description: `${label} orbital evidence repository`,
    language: "JavaScript",
    topics: ["galaxy-motion"],
    stars: 1,
    forks: 0,
    fork: false,
    archived: false,
    relation: "owned",
    updatedAt: "2026-08-31T00:00:00Z",
    groupId,
    groupLabel,
  };
}

const graph = {
  owner: "example",
  generatedAt: "2026-08-31T00:00:00Z",
  repositoryCount: 3,
  groupCount: 2,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 2 },
    { id: "group:ai", label: "AI", type: "group", repositoryCount: 1 },
    repository("repository:alpha", "alpha", "robotics", "Robotics"),
    repository("repository:beta", "beta", "robotics", "Robotics"),
    repository("repository:delta", "delta", "ai", "AI"),
  ],
  edges: [
    { source: "user:example", target: "group:robotics", type: "ownership" },
    { source: "user:example", target: "group:ai", type: "ownership" },
    { source: "group:robotics", target: "repository:alpha", type: "membership" },
    { source: "group:robotics", target: "repository:beta", type: "membership" },
    { source: "group:ai", target: "repository:delta", type: "membership" },
  ],
};

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function center(locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

test("Galaxy owned repositories visibly orbit their category and Motion Off freezes the orbit", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Real Three.js orbital motion is exercised once in Chromium.");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await installGraph(page);
  await page.goto("/three/?username=example&style3d=galaxy");
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });
  await expect(page.locator("#motionToggle")).toHaveText("Motion On");

  await page.locator("#search").fill("alpha");
  const planetLabel = page.locator('[data-repository-label-id="repository:alpha"]');
  await expect(planetLabel).toBeVisible();
  const groupLabel = page.locator("#threeLabels .three-label-group", { hasText: "Robotics" });
  await expect(groupLabel).toBeVisible();

  const planetBefore = await center(planetLabel);
  const groupBefore = await center(groupLabel);
  await page.waitForTimeout(1200);
  const planetAfter = await center(planetLabel);
  const groupAfter = await center(groupLabel);

  expect(distance(planetBefore, planetAfter)).toBeGreaterThan(2);
  expect(distance(groupBefore, groupAfter)).toBeGreaterThan(0.5);

  await page.locator("#motionToggle").click();
  await expect(page.locator("#motionToggle")).toHaveText("Motion Off");
  const frozenBefore = await center(planetLabel);
  await page.waitForTimeout(900);
  const frozenAfter = await center(planetLabel);
  expect(distance(frozenBefore, frozenAfter)).toBeLessThan(1);
});
