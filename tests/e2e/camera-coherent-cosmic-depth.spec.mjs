import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-25T00:00:00Z",
  repositoryCount: 3,
  groupCount: 1,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:systems", label: "Systems", type: "group", repositoryCount: 3 },
    { id: "repository:alpha", label: "alpha", type: "repository", url: "https://github.com/example/alpha", language: "Rust", stars: 4, forks: 0, fork: false, archived: false, groupId: "systems", groupLabel: "Systems" },
    { id: "repository:beta", label: "beta", type: "repository", url: "https://github.com/example/beta", language: "TypeScript", stars: 1, forks: 0, fork: false, archived: false, groupId: "systems", groupLabel: "Systems" },
    { id: "repository:gamma", label: "gamma", type: "repository", url: "https://github.com/example/gamma", language: "Python", stars: 0, forks: 0, fork: false, archived: false, groupId: "systems", groupLabel: "Systems" },
  ],
  edges: [
    { source: "user:example", target: "group:systems", type: "ownership" },
    { source: "group:systems", target: "repository:alpha", type: "membership" },
    { source: "group:systems", target: "repository:beta", type: "membership" },
    { source: "group:systems", target: "repository:gamma", type: "membership" },
  ],
  semanticEdges: [],
};

async function installFixture(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

test("world-anchored galaxy body is visibly brighter than empty deep space", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 980 } });
  const page = await context.newPage();
  await installFixture(page);
  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(window.ProjectMapCosmicBackground))).toBe(true);

  const sample = await page.evaluate(() => {
    const snap = window.ProjectMapCosmicBackground.snapshot();
    const size = canvasSize();
    drawBackground(palette(), size.width, size.height);
    const dpr = window.devicePixelRatio || 1;
    const center = snap.envelope.center;
    const half = 10;
    const x = Math.max(0, Math.min(canvas.width - (half * 2 + 1), Math.round(center.x * dpr) - half));
    const y = Math.max(0, Math.min(canvas.height - (half * 2 + 1), Math.round(center.y * dpr) - half));
    const pixels = ctx.getImageData(x, y, half * 2 + 1, half * 2 + 1).data;
    let total = 0;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      total += pixels[index] + pixels[index + 1] + pixels[index + 2];
      count += 1;
    }
    const background = palette().background;
    const match = /^#([0-9a-f]{6})$/i.exec(background);
    const packed = match ? Number.parseInt(match[1], 16) : 0;
    const baseBrightness = ((packed >> 16) & 255) + ((packed >> 8) & 255) + (packed & 255);
    return {
      averageBrightness: total / Math.max(1, count),
      baseBrightness,
      center,
      viewport: size,
      screenRadius: snap.envelope.screenRadius,
    };
  });

  expect(sample.center.x).toBeGreaterThan(0);
  expect(sample.center.x).toBeLessThan(sample.viewport.width);
  expect(sample.center.y).toBeGreaterThan(0);
  expect(sample.center.y).toBeLessThan(sample.viewport.height);
  expect(sample.screenRadius).toBeGreaterThan(150);
  expect(sample.averageBrightness).toBeGreaterThan(sample.baseBrightness + 5);

  await context.close();
});

test("galaxy body radius stays stable while live nodes move inside the same graph/style scene", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await installFixture(page);
  await page.goto("/u/?username=example&style=obsidian");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(window.ProjectMapCosmicBackground))).toBe(true);

  const radii = await page.evaluate(() => {
    const before = window.ProjectMapCosmicBackground.snapshot().envelope.worldRadius;
    const repo = state.nodes.find((node) => node.type === "repository");
    repo.x += 2400;
    repo.y -= 1700;
    const after = window.ProjectMapCosmicBackground.snapshot().envelope.worldRadius;
    return { before, after };
  });

  expect(radii.after).toBeCloseTo(radii.before, 8);
  await context.close();
});
