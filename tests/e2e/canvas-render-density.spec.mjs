import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const EVIDENCE_DIR = ".tmp/playwright-visual/canvas-render-density";

const graph = {
  owner: "example",
  generatedAt: "2026-08-26T00:00:00Z",
  repositoryCount: 1,
  groupCount: 1,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:systems", label: "Systems", type: "group", repositoryCount: 1 },
    { id: "repository:project", label: "project", type: "repository", url: "https://github.com/example/project", description: "fixture", language: "JavaScript", topics: [], stars: 1, forks: 0, fork: false, archived: false, updatedAt: "2026-08-25T00:00:00Z", groupId: "systems", groupLabel: "Systems" },
  ],
  edges: [
    { source: "user:example", target: "group:systems", type: "ownership" },
    { source: "group:systems", target: "repository:project", type: "membership" },
  ],
};

const readabilityGraph = (() => {
  const groups = ["Robotics Systems", "AI Research", "Developer Tools", "Visualization"];
  const nodes = [{ id: "user:example", label: "example", type: "owner", url: "https://github.com/example" }];
  const edges = [];
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const groupId = `group:g${groupIndex}`;
    const groupLabel = groups[groupIndex];
    nodes.push({ id: groupId, label: groupLabel, type: "group", repositoryCount: 8 });
    edges.push({ source: "user:example", target: groupId, type: "ownership" });
    for (let repositoryIndex = 0; repositoryIndex < 8; repositoryIndex += 1) {
      const ordinal = groupIndex * 8 + repositoryIndex + 1;
      const id = `repository:readability-project-${String(ordinal).padStart(2, "0")}`;
      nodes.push({
        id,
        label: `readability-project-${String(ordinal).padStart(2, "0")}`,
        repositoryName: `readability-project-${String(ordinal).padStart(2, "0")}`,
        type: "repository",
        url: `https://github.com/example/readability-project-${String(ordinal).padStart(2, "0")}`,
        description: `Dense text readability fixture ${ordinal}`,
        language: repositoryIndex % 2 ? "TypeScript" : "JavaScript",
        topics: ["readability", "rendering"],
        stars: ordinal,
        forks: repositoryIndex,
        fork: false,
        archived: false,
        updatedAt: "2026-08-25T00:00:00Z",
        groupId: `g${groupIndex}`,
        groupLabel,
      });
      edges.push({ source: groupId, target: id, type: "membership" });
    }
  }
  return {
    owner: "example",
    generatedAt: "2026-08-26T00:00:00Z",
    repositoryCount: 32,
    groupCount: groups.length,
    nodes,
    edges,
  };
})();

async function installGraph(page, value = graph) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(value) });
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

async function saveEvidence(name, value) {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await writeFile(`${EVIDENCE_DIR}/${name}.json`, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function captureCanvas(page, name) {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.locator("#galaxy").screenshot({ path: `${EVIDENCE_DIR}/${name}.png` });
}

test.describe("DPR3 Canvas render density evidence", () => {
  test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 3 });

  test("shared 2D viewer preserves native DPR by default and bounds explicit Auto", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Backing-store density evidence is collected once in Chromium.");
    await installGraph(page);

    await page.goto("/u/?username=example&style=galaxy-hybrid");
    await expect(page.locator("#status")).toBeHidden({ timeout: 20_000 });
    const native = await canvasMetrics(page);

    await page.goto("/u/?username=example&style=galaxy-hybrid&render=auto");
    await expect(page.locator("#status")).toBeHidden({ timeout: 20_000 });
    const auto = await canvasMetrics(page);
    const nativeArea = native.backingWidth * native.backingHeight;
    const autoArea = auto.backingWidth * auto.backingHeight;
    const backingAreaRatio = autoArea / Math.max(1, nativeArea);
    await saveEvidence("shared-desktop-dpr3", {
      native,
      auto,
      backingAreaRatio,
      backingAreaReduction: 1 - backingAreaRatio,
    });

    expect(native.devicePixelRatio).toBe(3);
    expect(native.policy.mode).toBe("native");
    expect(native.policy.pixelRatio).toBe(3);
    expect(native.ratioX).toBeGreaterThan(2.9);
    expect(native.ratioY).toBeGreaterThan(2.9);
    expect(auto.policy.mode).toBe("auto");
    expect(auto.policy.pixelRatio).toBe(1.45);
    expect(auto.ratioX).toBeLessThanOrEqual(1.46);
    expect(auto.ratioY).toBeLessThanOrEqual(1.46);
    expect(Math.abs(auto.cssWidth - native.cssWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(auto.cssHeight - native.cssHeight)).toBeLessThanOrEqual(1);
    expect(autoArea).toBeLessThan(nativeArea * 0.25);
  });

  test("dense Radial captures native and Auto text-readability evidence without changing geometry", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Rendered readability evidence is collected once in Chromium.");
    await installGraph(page, readabilityGraph);

    await page.goto("/radial/?username=example&style=radial");
    await expect(page.locator("#status")).toBeHidden({ timeout: 20_000 });
    const native = await canvasMetrics(page);
    await captureCanvas(page, "radial-readability-native-dpr3");

    await page.goto("/radial/?username=example&style=radial&render=auto");
    await expect(page.locator("#status")).toBeHidden({ timeout: 20_000 });
    const auto = await canvasMetrics(page);
    await captureCanvas(page, "radial-readability-auto-dpr3");

    await saveEvidence("radial-readability-dpr3", { native, auto, repositories: 32, groups: 4 });
    expect(native.devicePixelRatio).toBe(3);
    expect(native.policy.mode).toBe("native");
    expect(auto.policy.mode).toBe("auto");
    expect(auto.policy.pixelRatio).toBe(1.45);
    expect(Math.abs(auto.cssWidth - native.cssWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(auto.cssHeight - native.cssHeight)).toBeLessThanOrEqual(1);
  });

  test("dedicated Radial consumes the same opt-in Canvas policy", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Dedicated Canvas density evidence is collected once in Chromium.");
    await installGraph(page);
    await page.goto("/radial/?username=example&style=radial&render=auto");
    await expect(page.locator("#status")).toBeHidden({ timeout: 20_000 });
    const metrics = await canvasMetrics(page);
    await saveEvidence("radial-desktop-dpr3", metrics);
    expect(metrics.devicePixelRatio).toBe(3);
    expect(metrics.policy.mode).toBe("auto");
    expect(metrics.ratioX).toBeLessThanOrEqual(1.46);
    expect(metrics.ratioY).toBeLessThanOrEqual(1.46);
  });

  test("mobile Auto caps Canvas backing store at one CSS pixel per axis", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Mobile Canvas density evidence is collected once in Chromium.");
    await page.setViewportSize({ width: 390, height: 844 });
    await installGraph(page);
    await page.goto("/u/?username=example&style=galaxy-hybrid&render=auto");
    await expect(page.locator("#status")).toBeHidden({ timeout: 20_000 });
    const metrics = await canvasMetrics(page);
    const width = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }));
    await saveEvidence("shared-mobile-dpr3", { metrics, width });
    expect(metrics.devicePixelRatio).toBe(3);
    expect(metrics.policy.mode).toBe("auto");
    expect(metrics.policy.pixelRatio).toBe(1);
    expect(metrics.ratioX).toBeLessThanOrEqual(1.01);
    expect(metrics.ratioY).toBeLessThanOrEqual(1.01);
    expect(width.scroll).toBeLessThanOrEqual(width.viewport);
  });
});
