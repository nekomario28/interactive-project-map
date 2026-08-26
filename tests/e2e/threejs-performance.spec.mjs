import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

function buildGraph(repositoryCount, groupCount = 8) {
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    id: `group:g${index}`,
    label: `Group ${index + 1}`,
    type: "group",
    repositoryCount: Math.ceil(repositoryCount / groupCount),
  }));
  const repositories = Array.from({ length: repositoryCount }, (_, index) => {
    const groupIndex = index % groupCount;
    return {
      id: `repository:repo-${index}`,
      label: `repo-${index}`,
      type: "repository",
      url: `https://github.com/example/repo-${index}`,
      description: `Synthetic performance fixture repository ${index}`,
      language: index % 3 === 0 ? "Rust" : index % 3 === 1 ? "JavaScript" : "Python",
      stars: index % 37,
      forks: index % 11,
      fork: false,
      archived: false,
      relation: "owned",
      repositoryName: `repo-${index}`,
      groupId: `g${groupIndex}`,
      groupLabel: `Group ${groupIndex + 1}`,
      topics: ["performance", `group-${groupIndex}`],
    };
  });

  return {
    owner: "example",
    generatedAt: "2026-08-26T00:00:00Z",
    nodes: [
      { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
      ...groups,
      ...repositories,
    ],
    edges: [
      ...groups.map((group) => ({ source: "user:example", target: group.id, type: "ownership" })),
      ...repositories.map((repository, index) => ({
        source: groups[index % groupCount].id,
        target: repository.id,
        type: "membership",
      })),
    ],
  };
}

function summarizeFrameIntervals(samples, windowMs) {
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = (fraction) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
  const total = samples.reduce((sum, value) => sum + value, 0);
  return {
    windowMs,
    count: samples.length,
    observedFps: samples.length / (windowMs / 1000),
    averageMs: samples.length ? total / samples.length : null,
    p50Ms: samples.length ? percentile(0.5) : null,
    p95Ms: samples.length ? percentile(0.95) : null,
    maxMs: samples.length ? sorted.at(-1) : null,
  };
}

async function sampleFramesForDuration(page, windowMs = 5_000) {
  return page.evaluate((duration) => new Promise((resolve) => {
    const samples = [];
    let previous = null;
    let animationFrame = 0;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      resolve(samples);
    };

    const timer = setTimeout(finish, duration);
    const step = (now) => {
      if (finished) return;
      if (previous !== null) samples.push(now - previous);
      previous = now;
      animationFrame = requestAnimationFrame(step);
    };

    animationFrame = requestAnimationFrame(step);
    void timer;
  }), windowMs);
}

async function readHeap(page) {
  return page.evaluate(() => {
    const memory = performance.memory;
    if (!memory) return null;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };
  });
}

async function measureScenario(page, repositoryCount) {
  const fixture = buildGraph(repositoryCount);
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture) });
  });

  const readyStartedAt = performance.now();
  await page.goto("/three/?username=example");
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });
  const readyMs = performance.now() - readyStartedAt;

  const snapshot = await page.evaluate(() => window.ProjectMapThreejsLab?.snapshot());
  expect(snapshot).toEqual({
    username: "example",
    repositories: repositoryCount,
    groups: 8,
    renderer: "threejs-cosmic",
    experimental: true,
  });

  const samplingWindowMs = 5_000;
  const baselineHeap = await readHeap(page);
  const baselineFrames = summarizeFrameIntervals(await sampleFramesForDuration(page, samplingWindowMs), samplingWindowMs);
  const canvas = page.locator("#galaxy3d");
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();

  await page.mouse.move(canvasBox.x + canvasBox.width * 0.45, canvasBox.y + canvasBox.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.62, canvasBox.y + canvasBox.height * 0.38, { steps: 8 });
  await page.mouse.up();
  await page.mouse.wheel(0, -420);

  const originalFilter = page.locator('[data-status-filter="original"]');
  await originalFilter.click();
  await expect(page.locator("#resultCount")).toContainText(`0 / ${repositoryCount} projects`);
  await originalFilter.click();
  await expect(page.locator("#resultCount")).toContainText(`${repositoryCount} / ${repositoryCount} projects`);

  const interactionFrames = summarizeFrameIntervals(await sampleFramesForDuration(page, samplingWindowMs), samplingWindowMs);
  const finalHeap = await readHeap(page);
  const labels = await page.locator(".three-label").evaluateAll((items) => ({
    total: items.length,
    visible: items.filter((item) => {
      const rect = item.getBoundingClientRect();
      const opacity = Number.parseFloat(getComputedStyle(item).opacity || "0");
      return opacity > 0.05 && rect.width > 0 && rect.height > 0;
    }).length,
  }));
  const backingStore = await canvas.evaluate((element) => ({
    width: element.width,
    height: element.height,
    cssWidth: element.getBoundingClientRect().width,
    cssHeight: element.getBoundingClientRect().height,
  }));

  expect(readyMs).toBeGreaterThan(0);
  expect(baselineFrames.count).toBeGreaterThan(0);
  expect(interactionFrames.count).toBeGreaterThan(0);
  expect(Number.isFinite(baselineFrames.p95Ms)).toBe(true);
  expect(Number.isFinite(interactionFrames.p95Ms)).toBe(true);
  expect(labels.total).toBe(9);
  expect(labels.visible).toBeGreaterThan(0);
  expect(labels.visible).toBeLessThanOrEqual(labels.total);
  expect(backingStore.width).toBeGreaterThan(0);
  expect(backingStore.height).toBeGreaterThan(0);
  await expect(page.locator("#status")).toHaveClass(/ready/);

  return {
    repositoryCount,
    totalNodes: fixture.nodes.length,
    totalEdges: fixture.edges.length,
    readyMs,
    baselineFrames,
    interactionFrames,
    heap: { before: baselineHeap, after: finalHeap },
    labels,
    backingStore,
  };
}

for (const repositoryCount of [120, 480]) {
  test(`Three.js lab records ${repositoryCount}-repository performance evidence`, async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Performance evidence is Chromium-only; WebKit remains a compatibility/fallback gate.");
    // This is a harness budget for collecting evidence, not a product performance threshold.
    test.setTimeout(repositoryCount >= 400 ? 75_000 : 45_000);
    await mkdir(".tmp/playwright-visual", { recursive: true });

    const evidence = await measureScenario(page, repositoryCount);
    await writeFile(
      `.tmp/playwright-visual/threejs-performance-${repositoryCount}.json`,
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
  });
}
