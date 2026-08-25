import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-25T00:00:00Z",
  repositoryCount: 2,
  groupCount: 1,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 2 },
    { id: "repository:alpha", label: "alpha", type: "repository", url: "https://github.com/example/alpha", language: "Python", stars: 1, forks: 0, fork: false, archived: false, groupId: "robotics", groupLabel: "Robotics", updatedAt: "2026-08-25T00:00:00Z" },
    { id: "repository:beta", label: "beta", type: "repository", url: "https://github.com/example/beta", language: "TypeScript", stars: 1, forks: 0, fork: false, archived: false, groupId: "robotics", groupLabel: "Robotics", updatedAt: "2026-08-25T00:00:00Z" },
  ],
  edges: [
    { source: "user:example", target: "group:robotics", type: "ownership" },
    { source: "group:robotics", target: "repository:alpha", type: "membership" },
    { source: "group:robotics", target: "repository:beta", type: "membership" },
  ],
  semanticEdges: [],
};

async function installFixture(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

test("a depth star keeps each new zoom anchor after an intervening pan", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1400, height: 980 } });
  const page = await context.newPage();
  await installFixture(page);
  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(window.ProjectMapCameraCoherence && window.ProjectMapCosmicBackground))).toBe(true);

  const result = await page.evaluate(() => {
    state.zoom = 1;
    state.pan.x = 0;
    state.pan.y = 0;
    draw();

    const initial = window.ProjectMapCosmicBackground.snapshot();
    const firstAnchor = { x: initial.nearStar.x, y: initial.nearStar.y };
    window.ProjectMapCameraCoherence.zoomAt(firstAnchor.x, firstAnchor.y, 1.35);

    state.pan.x += 100;
    state.pan.y -= 60;
    draw();
    const afterPan = window.ProjectMapCosmicBackground.snapshot();
    const secondAnchor = { x: afterPan.nearStar.x, y: afterPan.nearStar.y };

    window.ProjectMapCameraCoherence.zoomAt(secondAnchor.x, secondAnchor.y, 1.35);
    const afterSecondZoom = window.ProjectMapCosmicBackground.snapshot();

    return {
      firstAnchor,
      secondAnchor,
      initialIndex: initial.nearStar.index,
      afterPanIndex: afterPan.nearStar.index,
      finalIndex: afterSecondZoom.nearStar.index,
      finalStar: { x: afterSecondZoom.nearStar.x, y: afterSecondZoom.nearStar.y },
    };
  });

  expect(result.afterPanIndex).toBe(result.initialIndex);
  expect(result.finalIndex).toBe(result.initialIndex);
  expect(Math.abs(result.finalStar.x - result.secondAnchor.x)).toBeLessThan(0.75);
  expect(Math.abs(result.finalStar.y - result.secondAnchor.y)).toBeLessThan(0.75);

  await context.close();
});
