import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const EVIDENCE_DIR = ".tmp/playwright-visual/canvas-render-density-default";
const SEARCH_TARGET = "stress-repo-042";

function largeGraph(repositoryCount = 300, groupCount = 10) {
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    id: `group:stress-${index}`,
    label: `Stress Category ${index + 1}`,
    type: "group",
    repositoryCount: Math.ceil(repositoryCount / groupCount),
  }));
  const repositories = Array.from({ length: repositoryCount }, (_, index) => {
    const groupIndex = index % groups.length;
    const name = `stress-repo-${String(index).padStart(3, "0")}`;
    return {
      id: `repository:${name}`,
      label: name,
      type: "repository",
      url: `https://github.com/example/${name}`,
      description: `Synthetic render-density evidence repository ${index}`,
      language: ["Python", "TypeScript", "Rust", "C++", "Java", "Shell"][index % 6],
      topics: ["stress", "render-density", `group-${groupIndex}`],
      stars: (index * 13) % 37,
      forks: index % 7,
      fork: index % 11 === 0,
      archived: index % 19 === 0,
      createdAt: new Date(Date.UTC(2020 + (index % 7), index % 12, 1 + (index % 27))).toISOString(),
      updatedAt: "2026-08-26T00:00:00Z",
      groupId: `stress-${groupIndex}`,
      groupLabel: groups[groupIndex].label,
    };
  });
  return {
    owner: "example",
    generatedAt: "2026-08-26T00:00:00Z",
    repositoryCount,
    groupCount: groups.length,
    nodes: [
      { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
      ...groups,
      ...repositories,
    ],
    edges: [
      ...groups.map((group) => ({ source: "user:example", target: group.id, type: "ownership" })),
      ...repositories.map((repository) => ({ source: `group:${repository.groupId}`, target: repository.id, type: "membership" })),
    ],
  };
}

async function installGraph(page, graph) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function canvasMetrics(page) {
  return page.locator("#galaxy").evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    return {
      cssWidth: rect.width,
      cssHeight: rect.height,
      backingWidth: canvas.width,
      backingHeight: canvas.height,
      ratioX: canvas.width / Math.max(1, rect.width),
      ratioY: canvas.height / Math.max(1, rect.height),
      devicePixelRatio: window.devicePixelRatio,
      policy: window.ProjectMapRenderDensity?.snapshot?.({ width: rect.width, devicePixelRatio: window.devicePixelRatio }),
    };
  });
}

async function sampleAnimationFrames(page, durationMs = 3500) {
  return page.evaluate(async (duration) => {
    const intervals = [];
    let started = 0;
    let previous = 0;
    await new Promise((resolve) => {
      function frame(now) {
        if (!started) {
          started = now;
          previous = now;
          requestAnimationFrame(frame);
          return;
        }
        intervals.push(now - previous);
        previous = now;
        if (now - started >= duration) resolve();
        else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    const sorted = [...intervals].sort((a, b) => a - b);
    const elapsed = intervals.reduce((sum, value) => sum + value, 0);
    const percentile = (fraction) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))] || 0;
    return {
      requestedDurationMs: duration,
      elapsedMs: elapsed,
      frames: intervals.length,
      observedFps: intervals.length / Math.max(0.001, elapsed / 1000),
      averageFrameMs: elapsed / Math.max(1, intervals.length),
      p50FrameMs: percentile(0.5),
      p95FrameMs: percentile(0.95),
      maxFrameMs: sorted.at(-1) || 0,
    };
  }, durationMs);
}

async function openEvidencePage(browser, graph, { render = null, reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 3,
    reducedMotion,
  });
  const page = await context.newPage();
  await installGraph(page, graph);
  const url = new URL("http://example.test/u/");
  url.searchParams.set("username", "example");
  url.searchParams.set("style", "galaxy-hybrid");
  if (render) url.searchParams.set("render", render);
  await page.goto(`${url.pathname}${url.search}`);
  await expect(page.locator("#status")).toBeHidden({ timeout: 20_000 });
  await expect(page.locator("#error")).not.toHaveClass(/visible/);
  await page.getByRole("button", { name: "Fit" }).click();
  return { context, page };
}

async function measureAnimation(browser, graph, render) {
  const { context, page } = await openEvidencePage(browser, graph, { render, reducedMotion: "no-preference" });
  await page.waitForTimeout(400);
  const metrics = await canvasMetrics(page);
  const frames = await sampleAnimationFrames(page);
  await context.close();
  return { metrics, frames };
}

async function captureReadability(browser, graph, render, filename) {
  const { context, page } = await openEvidencePage(browser, graph, { render, reducedMotion: "reduce" });
  await page.locator("#search").fill(SEARCH_TARGET);
  await page.waitForTimeout(250);
  const metrics = await canvasMetrics(page);
  await page.locator("#galaxy").screenshot({ path: `${EVIDENCE_DIR}/${filename}` });
  await context.close();
  return metrics;
}

test("DPR3 300-repository native versus Auto evidence informs the 2D default decision", async ({ browser, browserName }) => {
  test.skip(browserName !== "chromium", "Default render-density evidence is collected once in Chromium.");
  test.setTimeout(60_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const graph = largeGraph();

  const native = await measureAnimation(browser, graph, null);
  const auto = await measureAnimation(browser, graph, "auto");
  const nativeReadability = await captureReadability(browser, graph, null, "native-dpr3-search.png");
  const autoReadability = await captureReadability(browser, graph, "auto", "auto-dpr3-search.png");

  const nativeArea = native.metrics.backingWidth * native.metrics.backingHeight;
  const autoArea = auto.metrics.backingWidth * auto.metrics.backingHeight;
  const evidence = {
    repositoryCount: graph.repositoryCount,
    viewport: { width: 1280, height: 720, deviceScaleFactor: 3 },
    searchTarget: SEARCH_TARGET,
    native,
    auto,
    nativeReadability,
    autoReadability,
    backingAreaRatio: autoArea / Math.max(1, nativeArea),
    backingAreaReduction: 1 - autoArea / Math.max(1, nativeArea),
    fpsRatio: auto.frames.observedFps / Math.max(0.001, native.frames.observedFps),
    p95FrameRatio: auto.frames.p95FrameMs / Math.max(0.001, native.frames.p95FrameMs),
  };
  await writeFile(`${EVIDENCE_DIR}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  expect(native.metrics.devicePixelRatio).toBe(3);
  expect(native.metrics.policy.mode).toBe("native");
  expect(auto.metrics.policy.mode).toBe("auto");
  expect(auto.metrics.policy.pixelRatio).toBe(1.45);
  expect(Math.abs(auto.metrics.cssWidth - native.metrics.cssWidth)).toBeLessThanOrEqual(1);
  expect(Math.abs(auto.metrics.cssHeight - native.metrics.cssHeight)).toBeLessThanOrEqual(1);
  expect(evidence.backingAreaRatio).toBeLessThan(0.25);
  expect(native.frames.frames).toBeGreaterThan(5);
  expect(auto.frames.frames).toBeGreaterThan(5);
  expect(nativeReadability.cssWidth).toBe(autoReadability.cssWidth);
  expect(nativeReadability.cssHeight).toBe(autoReadability.cssHeight);
});
