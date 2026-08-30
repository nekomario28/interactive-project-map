import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const EVIDENCE_DIR = ".tmp/playwright-visual/canvas-render-density/cross-viewer";
const ROUTES = [
  ["shared-galaxy-hybrid", "/u/?username=example&style=galaxy-hybrid&motion=off"],
  ["radial", "/radial/?username=example&style=radial"],
  ["tree", "/tree/?username=example&style=tree"],
  ["treemap", "/treemap/?username=example&style=treemap"],
  ["timeline", "/timeline/?username=example&style=timeline"],
  ["cluster", "/cluster/?username=example&style=cluster"],
  ["sunburst", "/sunburst/?username=example&style=sunburst"],
];

const graph = (() => {
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
      const name = `readability-project-${String(ordinal).padStart(2, "0")}`;
      const id = `repository:${name}`;
      nodes.push({
        id,
        label: name,
        repositoryName: name,
        type: "repository",
        url: `https://github.com/example/${name}`,
        description: `Cross-viewer density fixture ${ordinal}`,
        language: repositoryIndex % 2 ? "TypeScript" : "JavaScript",
        topics: ["readability", "rendering"],
        stars: ordinal,
        forks: repositoryIndex,
        fork: false,
        archived: false,
        relation: "owned",
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

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function metrics(page) {
  return page.locator("#galaxy").evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    return {
      cssWidth: rect.width,
      cssHeight: rect.height,
      backingWidth: canvas.width,
      backingHeight: canvas.height,
      ratioX: canvas.width / Math.max(1, rect.width),
      ratioY: canvas.height / Math.max(1, rect.height),
      policy: window.ProjectMapRenderDensity?.snapshot?.({ width: rect.width, devicePixelRatio: window.devicePixelRatio }),
    };
  });
}

function withRenderAuto(path) {
  const url = new URL(path, "http://example.test");
  url.searchParams.set("render", "auto");
  return `${url.pathname}${url.search}`;
}

test.describe("cross-viewer DPR3 render-density evidence", () => {
  test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 3 });

  test("affected Canvas viewers preserve CSS geometry and emit paired native/Auto screenshots", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Cross-viewer rendered evidence is collected once in Chromium.");
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await installGraph(page);
    const result = {};

    for (const [name, path] of ROUTES) {
      await page.goto(path);
      await expect(page.locator("#status")).toBeHidden({ timeout: 20_000 });
      await expect(page.locator("#galaxy")).toBeVisible();
      const native = await metrics(page);
      await page.locator("#galaxy").screenshot({ path: `${EVIDENCE_DIR}/${name}-native-dpr3.png` });

      await page.goto(withRenderAuto(path));
      await expect(page.locator("#status")).toBeHidden({ timeout: 20_000 });
      await expect(page.locator("#galaxy")).toBeVisible();
      const auto = await metrics(page);
      await page.locator("#galaxy").screenshot({ path: `${EVIDENCE_DIR}/${name}-auto-dpr3.png` });

      expect(native.policy.mode, `${name} native policy`).toBe("native");
      expect(native.policy.pixelRatio, `${name} native ratio`).toBe(3);
      expect(auto.policy.mode, `${name} Auto policy`).toBe("auto");
      expect(auto.policy.pixelRatio, `${name} Auto ratio`).toBe(1.45);
      expect(Math.abs(auto.cssWidth - native.cssWidth), `${name} CSS width`).toBeLessThanOrEqual(1);
      expect(Math.abs(auto.cssHeight - native.cssHeight), `${name} CSS height`).toBeLessThanOrEqual(1);

      result[name] = {
        native,
        auto,
        backingAreaRatio: (auto.backingWidth * auto.backingHeight) / Math.max(1, native.backingWidth * native.backingHeight),
      };
    }

    await writeFile(`${EVIDENCE_DIR}/metrics.json`, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  });
});
