import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

// Deterministic synthetic portfolio: no GitHub network dependency and no
// conflation of source-code imports with portfolio ownership relations.
function fixtureGraph() {
  const categories = ["alpha", "beta", "gamma", "delta"];
  const owner = { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" };
  const groups = categories.map((name) => ({
    id: `group:${name}`, label: name.toUpperCase(), type: "group", repositoryCount: 2,
  }));
  const repos = categories.flatMap((category, index) => [0, 1].map((subindex) => {
    const name = `${category}-${subindex}`;
    return {
      id: `repository:${name}`, label: name, repositoryName: name, type: "repository",
      url: `https://github.com/example/${name}`,
      description: `Visual audit fixture ${name}`,
      language: index % 2 === 0 ? "TypeScript" : "Rust",
      topics: ["fixture"], stars: 15 - index * 2 - subindex, forks: 0, fork: false,
      archived: false, relation: "owned", groupId: category,
      groupLabel: category.toUpperCase(), updatedAt: "2026-10-10T00:00:00Z",
    };
  }));
  return {
    owner: "example", generatedAt: "2026-10-10T00:00:00Z",
    repositoryCount: repos.length, groupCount: groups.length,
    nodes: [owner, ...groups, ...repos],
    edges: [
      ...groups.map((group) => ({ source: owner.id, target: group.id, type: "ownership" })),
      ...repos.map((repo) => ({ source: `group:${repo.groupId}`, target: repo.id, type: "membership" })),
    ],
  };
}

async function routeGraph(page) {
  const graph = fixtureGraph();
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function recordTwoDimensionalLayout(page, style) {
  await page.goto(`/u/?username=example&style=${style}&motion=off`);
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ProjectMapAdaptiveLabels?.snapshot().active)).toBe(true);
  const snapshot = await page.evaluate(() => {
    state.zoom = 1.35;
    draw();
    return window.ProjectMapAdaptiveLabels.snapshot();
  });
  expect(snapshot.style).toBe(style);
  expect(snapshot.placements.length).toBeGreaterThanOrEqual(4);
  expect(snapshot.placements.some((box) => box.role === "group")).toBe(true);
  return {
    name: `2d:${style}`,
    width: snapshot.viewport.width,
    height: snapshot.viewport.height,
    boxes: snapshot.placements.map(({ id, text, role, fontSize, bbox }) => ({ id, text, role, fontSize, bbox })),
  };
}

async function recordThreeDimensionalLayout(page) {
  await page.goto("/three/?username=example&style3d=galaxy&motion=on");
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });
  await page.locator("#search").fill("alpha-0");
  await expect(page.locator('[data-repository-label-id="repository:alpha-0"]')).toBeVisible();
  const snapshot = await page.evaluate(() => {
    const layer = document.getElementById("threeLabels");
    const bounds = layer.getBoundingClientRect();
    const boxes = [...layer.querySelectorAll(".three-label")].flatMap((element) => {
      const style = getComputedStyle(element);
      if (element.hidden || style.visibility === "hidden" || style.display === "none" || Number(style.opacity) < 0.2) return [];
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return [];
      return [{
        id: element.dataset.repositoryLabelId || element.textContent,
        text: element.textContent,
        role: element.classList.contains("three-label-repository") ? "repository" : "category",
        fontSize: parseFloat(style.fontSize),
        bbox: [rect.left - bounds.left, rect.top - bounds.top, rect.right - bounds.left, rect.bottom - bounds.top],
      }];
    });
    return { name: "3d:galaxy", width: bounds.width, height: bounds.height, boxes };
  });
  expect(snapshot.boxes.some((box) => box.role === "repository")).toBe(true);
  expect(snapshot.boxes.length).toBeGreaterThanOrEqual(2);
  return snapshot;
}

test("gxkit visual audit captures actual 2D canvas placements, projected 3D DOM labels, and rendered Galaxy frames", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "The Chromium render produces portable geometry and raster evidence; WebKit keeps its smoke suite.");
  const dir = resolve(".tmp/gxkit-visual");
  await mkdir(resolve(dir, "frames"), { recursive: true });
  await page.setViewportSize({ width: 960, height: 620 });
  await routeGraph(page);

  const surfaces = [];
  for (const style of ["galaxy-systems", "galaxy-hybrid"]) {
    surfaces.push(await recordTwoDimensionalLayout(page, style));
  }
  surfaces.push(await recordThreeDimensionalLayout(page));
  await writeFile(resolve(dir, "layout.json"), JSON.stringify({ contract: 1, surfaces }, null, 2) + "\n");

  // Motion ON has an independent 3D scene-state test; this captures *rendered*
  // output to catch a frozen, black, or undecodable WebGL frame sequence.
  await page.locator("#search").fill("");
  await page.locator("#galaxy3d").screenshot({ path: resolve(dir, "frames/galaxy-00.png") });
  const before = await page.evaluate(() => window.ProjectMapThreejsGalaxyMotion?.snapshot());
  expect(before?.systems?.length).toBeGreaterThan(0);
  for (let index = 1; index < 5; index += 1) {
    await page.waitForTimeout(800);
    await page.locator("#galaxy3d").screenshot({
      path: resolve(dir, `frames/galaxy-${String(index).padStart(2, "0")}.png`),
    });
  }
  const after = await page.evaluate(() => window.ProjectMapThreejsGalaxyMotion?.snapshot());
  expect(after.elapsed).toBeGreaterThan(before.elapsed);
  const start = before.systems[0];
  const end = after.systems.find((system) => system.id === start.id);
  expect(Math.hypot(start.x - end.x, start.y - end.y, start.z - end.z)).toBeGreaterThan(0.05);
});
