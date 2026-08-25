import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-25T00:00:00Z",
  repositoryCount: 3,
  groupCount: 1,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 3 },
    { id: "repository:alpha", label: "alpha", type: "repository", url: "https://github.com/example/alpha", stars: 2, forks: 0, fork: false, archived: false, groupId: "robotics", groupLabel: "Robotics" },
    { id: "repository:beta", label: "beta", type: "repository", url: "https://github.com/example/beta", stars: 1, forks: 0, fork: false, archived: false, groupId: "robotics", groupLabel: "Robotics" },
    { id: "repository:gamma", label: "gamma", type: "repository", url: "https://github.com/example/gamma", stars: 0, forks: 0, fork: false, archived: false, groupId: "robotics", groupLabel: "Robotics" },
  ],
  edges: [
    { source: "user:example", target: "group:robotics", type: "ownership" },
    { source: "group:robotics", target: "repository:alpha", type: "membership" },
    { source: "group:robotics", target: "repository:beta", type: "membership" },
    { source: "group:robotics", target: "repository:gamma", type: "membership" },
  ],
  semanticEdges: [],
};

async function installFixture(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

test("shared camera compresses pan overscroll and settles inside scene guard", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1400, height: 980 } });
  const page = await context.newPage();
  await installFixture(page);
  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(window.ProjectMapCameraCoherence))).toBe(true);

  const direct = await page.evaluate(() => {
    const api = window.ProjectMapCameraCoherence;
    const limits = api.panBounds();
    state.pan.x = limits.maxX + 900;
    state.pan.y = limits.minY - 700;
    const raw = { x: state.pan.x, y: state.pan.y };
    const elastic = api.constrainPan({ elastic: true, redraw: false });
    const hard = api.constrainPan({ redraw: false });
    return { limits, raw, elastic: elastic.pan, hard: hard.pan };
  });

  expect(direct.limits.active).toBe(true);
  expect(direct.elastic.x).toBeGreaterThan(direct.limits.maxX);
  expect(direct.elastic.x).toBeLessThan(direct.raw.x);
  expect(direct.elastic.y).toBeLessThan(direct.limits.minY);
  expect(direct.elastic.y).toBeGreaterThan(direct.raw.y);
  expect(direct.hard.x).toBeCloseTo(direct.limits.maxX, 6);
  expect(direct.hard.y).toBeCloseTo(direct.limits.minY, 6);

  const eventPath = await page.evaluate(async () => {
    const api = window.ProjectMapCameraCoherence;
    const rect = canvas.getBoundingClientRect();
    const start = { x: 120, y: 120 };
    state.pan.x = 0;
    state.pan.y = 0;
    api.constrainPan({ redraw: false });
    state.down = { ...start };
    state.last = { ...start };
    state.moved = false;
    state.drag = null;
    state.panning = true;
    state.pointers.clear();
    state.pointers.set(91, { ...start });

    canvas.dispatchEvent(new PointerEvent("pointermove", {
      pointerId: 91,
      clientX: rect.left + start.x + 2600,
      clientY: rect.top + start.y - 2100,
      bubbles: true,
    }));
    await Promise.resolve();
    const during = api.snapshot();

    canvas.dispatchEvent(new PointerEvent("pointerup", {
      pointerId: 91,
      clientX: rect.left + start.x + 2600,
      clientY: rect.top + start.y - 2100,
      bubbles: true,
    }));
    await Promise.resolve();
    const settled = api.snapshot();
    return { during, settled };
  });

  expect(eventPath.during.pan.x).toBeGreaterThan(eventPath.during.panLimits.maxX);
  expect(eventPath.during.pan.y).toBeLessThan(eventPath.during.panLimits.minY);
  expect(eventPath.settled.pan.x).toBeGreaterThanOrEqual(eventPath.settled.panLimits.minX - 1e-6);
  expect(eventPath.settled.pan.x).toBeLessThanOrEqual(eventPath.settled.panLimits.maxX + 1e-6);
  expect(eventPath.settled.pan.y).toBeGreaterThanOrEqual(eventPath.settled.panLimits.minY - 1e-6);
  expect(eventPath.settled.pan.y).toBeLessThanOrEqual(eventPath.settled.panLimits.maxY + 1e-6);

  await context.close();
});
