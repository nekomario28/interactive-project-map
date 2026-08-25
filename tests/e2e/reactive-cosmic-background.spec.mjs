import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-24T00:00:00Z",
  repositoryCount: 2,
  groupCount: 1,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 2 },
    {
      id: "repository:alpha",
      label: "alpha",
      type: "repository",
      url: "https://github.com/example/alpha",
      language: "Python",
      stars: 2,
      forks: 0,
      fork: false,
      archived: false,
      groupId: "robotics",
      groupLabel: "Robotics",
      updatedAt: "2026-08-20T00:00:00Z",
    },
    {
      id: "repository:beta",
      label: "beta",
      type: "repository",
      url: "https://github.com/example/beta",
      language: "TypeScript",
      stars: 0,
      forks: 0,
      fork: false,
      archived: false,
      groupId: "robotics",
      groupLabel: "Robotics",
      updatedAt: "2026-08-21T00:00:00Z",
    },
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

function modularDelta(after, before, size) {
  let delta = after - before;
  while (delta > size / 2) delta -= size;
  while (delta < -size / 2) delta += size;
  return delta;
}

async function sampleBackground(page) {
  return page.evaluate(() => {
    const api = window.ProjectMapCosmicBackground;
    if (!api) return null;
    const snap = api.snapshot();
    if (!snap.nearStar) return null;
    const size = canvasSize();
    drawBackground(palette(), size.width, size.height);
    const dpr = window.devicePixelRatio || 1;
    const x = Math.max(0, Math.min(canvas.width - 3, Math.round(snap.nearStar.x * dpr) - 1));
    const y = Math.max(0, Math.min(canvas.height - 3, Math.round(snap.nearStar.y * dpr) - 1));
    const pixels = ctx.getImageData(x, y, 3, 3).data;
    let brightest = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      brightest = Math.max(brightest, pixels[index] + pixels[index + 1] + pixels[index + 2]);
    }
    return { snap, brightest };
  });
}

test("shared cosmic background moves continuously with camera pan and paints wrapped stars", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
  const page = await context.newPage();
  await installFixture(page);
  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(window.ProjectMapCosmicBackground))).toBe(true);

  const before = await sampleBackground(page);
  expect(before).not.toBeNull();
  expect(before.brightest).toBeGreaterThan(60);
  expect(before.snap.layers.map((layer) => layer.parallax)).toEqual([0.08, 0.18, 0.32]);
  expect(before.snap.layers.map((layer) => layer.zoomParallax)).toEqual([0.05, 0.12, 0.22]);
  const nearLayer = before.snap.layers.find((layer) => layer.id === "near");

  await page.evaluate(() => {
    state.pan.x += 120;
    state.pan.y -= 75;
    draw();
  });
  const after = await sampleBackground(page);
  expect(after).not.toBeNull();
  expect(after.brightest).toBeGreaterThan(60);
  expect(after.snap.nearStar.index).toBe(before.snap.nearStar.index);
  expect(modularDelta(after.snap.nearStar.x, before.snap.nearStar.x, before.snap.nearStar.tile.width)).toBeCloseTo(120 * 0.32 * nearLayer.zoomScale, 3);
  expect(modularDelta(after.snap.nearStar.y, before.snap.nearStar.y, before.snap.nearStar.tile.height)).toBeCloseTo(-75 * 0.32 * nearLayer.zoomScale, 3);

  await context.close();
});

test("zoom keeps its screen anchor while star depth and the galaxy envelope respond to camera scale", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1400, height: 980 } });
  const page = await context.newPage();
  await installFixture(page);
  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(window.ProjectMapCameraCoherence && window.ProjectMapCosmicBackground))).toBe(true);

  expect(await page.evaluate(() => window.ProjectMapCameraCoherence.normalizedWheelPixels(new WheelEvent("wheel", { deltaY: 3, deltaMode: WheelEvent.DOM_DELTA_LINE })))).toBe(48);

  const result = await page.evaluate(() => {
    const size = canvasSize();
    const anchor = { x: size.width * 0.68, y: size.height * 0.43 };
    const world = screenToWorld(anchor.x, anchor.y);
    const before = window.ProjectMapCosmicBackground.snapshot();
    const initialCamera = window.ProjectMapCameraCoherence.snapshot();
    const targetZoom = Math.min(initialCamera.limits.max * 0.85, Math.max(before.zoom * 1.45, before.zoom + 0.25));
    window.ProjectMapCameraCoherence.zoomAt(anchor.x, anchor.y, targetZoom / before.zoom);
    const after = window.ProjectMapCosmicBackground.snapshot();
    const anchoredScreen = worldToScreen(world.x, world.y);
    const originScreen = worldToScreen(0, 0);
    return { anchor, anchoredScreen, originScreen, before, after, camera: window.ProjectMapCameraCoherence.snapshot() };
  });

  expect(result.after.zoom).toBeGreaterThan(result.before.zoom);
  expect(Math.abs(result.anchoredScreen.x - result.anchor.x)).toBeLessThan(0.75);
  expect(Math.abs(result.anchoredScreen.y - result.anchor.y)).toBeLessThan(0.75);
  expect(result.camera.limits.min).toBeGreaterThanOrEqual(0.08);
  expect(result.camera.limits.min).toBeLessThan(result.camera.limits.fit);
  expect(result.camera.limits.max).toBeGreaterThanOrEqual(4.5);

  const scales = result.after.layers.map((layer) => layer.zoomScale);
  const beforeScales = result.before.layers.map((layer) => layer.zoomScale);
  expect(scales[2] / beforeScales[2]).toBeGreaterThan(scales[1] / beforeScales[1]);
  expect(scales[1] / beforeScales[1]).toBeGreaterThan(scales[0] / beforeScales[0]);
  expect(scales[0]).toBeGreaterThan(beforeScales[0]);
  expect(result.after.envelope.screenRadius).toBeGreaterThan(result.before.envelope.screenRadius);
  expect(result.after.envelope.center.x).toBeCloseTo(result.originScreen.x, 5);
  expect(result.after.envelope.center.y).toBeCloseTo(result.originScreen.y, 5);

  await context.close();
});

test("meteor is a real background canvas event and remains behind graph content", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await installFixture(page);
  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(window.ProjectMapCosmicBackground))).toBe(true);
  expect(await page.evaluate(() => window.ProjectMapCosmicBackground.spawnMeteor())).toBe(true);

  await expect.poll(async () => page.evaluate(() => {
    const snap = window.ProjectMapCosmicBackground.snapshot();
    return snap.meteor.active
      && snap.meteor.progress > 0.28
      && snap.meteor.progress < 0.72
      && snap.meteor.headX > 8
      && snap.meteor.headX < snap.viewport.width - 8
      && snap.meteor.headY > 8
      && snap.meteor.headY < snap.viewport.height - 8;
  }), { timeout: 2_000 }).toBe(true);

  const meteorPixel = await page.evaluate(() => {
    const snap = window.ProjectMapCosmicBackground.snapshot();
    const size = canvasSize();
    drawBackground(palette(), size.width, size.height);
    const dpr = window.devicePixelRatio || 1;
    const cx = Math.round(snap.meteor.headX * dpr);
    const cy = Math.round(snap.meteor.headY * dpr);
    const x = Math.max(0, Math.min(canvas.width - 7, cx - 3));
    const y = Math.max(0, Math.min(canvas.height - 7, cy - 3));
    const pixels = ctx.getImageData(x, y, 7, 7).data;
    let brightest = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      brightest = Math.max(brightest, pixels[index] + pixels[index + 1] + pixels[index + 2]);
    }
    return brightest;
  });
  expect(meteorPixel).toBeGreaterThan(180);

  await context.close();
});

test("reduced motion freezes star parallax and depth scaling while suppressing meteors", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1000, height: 760 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await installFixture(page);
  await page.goto("/u/?username=example&style=obsidian");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(window.ProjectMapCosmicBackground))).toBe(true);

  const before = await page.evaluate(() => window.ProjectMapCosmicBackground.snapshot());
  expect(before.reducedMotion).toBe(true);
  expect(before.layers.every((layer) => layer.parallax === 0)).toBe(true);
  expect(before.layers.every((layer) => layer.zoomScale === 1)).toBe(true);
  expect(await page.evaluate(() => window.ProjectMapCosmicBackground.spawnMeteor())).toBe(false);

  await page.evaluate(() => {
    state.pan.x += 200;
    state.pan.y += 140;
    state.zoom *= 1.8;
    draw();
  });
  const after = await page.evaluate(() => window.ProjectMapCosmicBackground.snapshot());
  expect(after.nearStar.x).toBeCloseTo(before.nearStar.x, 5);
  expect(after.nearStar.y).toBeCloseTo(before.nearStar.y, 5);
  expect(after.nearStar.radius).toBeCloseTo(before.nearStar.radius, 5);
  expect(after.layers.every((layer) => layer.zoomScale === 1)).toBe(true);
  expect(after.meteor.active).toBe(false);

  await context.close();
});
