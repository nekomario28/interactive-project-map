import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-21T00:00:00Z",
  repositoryCount: 4,
  groupCount: 1,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:research", label: "Research", type: "group", repositoryCount: 4 },
    { id: "repository:focus", label: "focus", type: "repository", url: "https://github.com/example/focus", description: "hover focus", language: "JavaScript", topics: [], stars: 0, forks: 0, fork: false, archived: false, updatedAt: "2026-08-21T00:00:00Z", groupId: "research", groupLabel: "Research" },
    { id: "repository:relation", label: "relation", type: "repository", url: "https://github.com/example/relation", description: "explicit relation neighbor", language: "Rust", topics: [], stars: 0, forks: 0, fork: false, archived: false, updatedAt: "2026-08-21T00:00:00Z", groupId: "research", groupLabel: "Research" },
    { id: "repository:semantic", label: "semantic", type: "repository", url: "https://github.com/example/semantic", description: "semantic neighbor", language: "Python", topics: [], stars: 0, forks: 0, fork: false, archived: false, updatedAt: "2026-08-21T00:00:00Z", groupId: "research", groupLabel: "Research" },
    { id: "repository:unrelated", label: "unrelated", type: "repository", url: "https://github.com/example/unrelated", description: "non neighbor", language: "Go", topics: [], stars: 0, forks: 0, fork: false, archived: false, updatedAt: "2026-08-21T00:00:00Z", groupId: "research", groupLabel: "Research" },
  ],
  edges: [
    { source: "user:example", target: "group:research", type: "ownership" },
    { source: "group:research", target: "repository:focus", type: "membership" },
    { source: "group:research", target: "repository:relation", type: "membership" },
    { source: "group:research", target: "repository:semantic", type: "membership" },
    { source: "group:research", target: "repository:unrelated", type: "membership" },
    { source: "repository:focus", target: "repository:relation", type: "relation" },
  ],
  semanticEdges: [
    { source: "repository:focus", target: "repository:semantic", type: "semantic", score: 0.93 },
  ],
};

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function opacities(page) {
  return page.evaluate(() => Object.fromEntries([
    "user:example",
    "group:research",
    "repository:focus",
    "repository:relation",
    "repository:semantic",
    "repository:unrelated",
  ].map((id) => [id, nodeOpacity(state.byId.get(id))])));
}

async function edgeAlphas(page) {
  return page.evaluate(() => {
    const values = [];
    const original = ctx.stroke;
    ctx.stroke = function captureStroke(...args) {
      values.push(Number(ctx.globalAlpha));
      return original.call(this, ...args);
    };
    try {
      drawEdges(palette());
    } finally {
      ctx.stroke = original;
    }
    return values;
  });
}

test("Obsidian hover emphasizes incident neighborhood while persistent selection stays authoritative", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installGraph(page);
  await page.goto("/u/?username=example&style=obsidian");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ProjectMapObsidianRuntime?.snapshot().active)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.ProjectMapSemanticEdges?.count())).toBe(1);
  await expect.poll(() => page.evaluate(() => Boolean(window.ProjectMapObsidianHover))).toBe(true);

  const baselineEdges = await edgeAlphas(page);
  expect(baselineEdges.length).toBeGreaterThanOrEqual(7);
  expect(Math.min(...baselineEdges)).toBeGreaterThan(0.2);

  await page.evaluate(() => { state.hovered = state.byId.get("repository:focus"); });
  const snapshot = await page.evaluate(() => window.ProjectMapObsidianHover.snapshot());
  expect(snapshot.active).toBe(true);
  expect(snapshot.focusId).toBe("repository:focus");
  expect(snapshot.selectedId).toBeNull();
  expect(snapshot.neighborIds).toEqual([
    "group:research",
    "repository:relation",
    "repository:semantic",
  ]);

  const hovered = await opacities(page);
  expect(hovered["repository:focus"]).toBeGreaterThan(0.95);
  expect(hovered["group:research"]).toBeGreaterThan(0.95);
  expect(hovered["repository:relation"]).toBeGreaterThan(0.95);
  expect(hovered["repository:semantic"]).toBeGreaterThan(0.95);
  expect(hovered["repository:unrelated"]).toBeLessThan(0.3);
  expect(hovered["user:example"]).toBeLessThan(0.3);

  const hoverEdges = await edgeAlphas(page);
  expect(Math.min(...hoverEdges)).toBeLessThan(0.08);
  expect(Math.max(...hoverEdges)).toBeGreaterThan(0.6);
  expect(await page.evaluate(() => state.selected)).toBeNull();

  await page.evaluate(() => {
    state.hovered = null;
    updateDetails(state.byId.get("repository:unrelated"));
  });
  const selectedOnlyNodes = await opacities(page);
  const selectedOnlyEdges = await edgeAlphas(page);

  await page.evaluate(() => { state.hovered = state.byId.get("repository:focus"); });
  const selectedAndHoveredNodes = await opacities(page);
  const selectedAndHoveredEdges = await edgeAlphas(page);
  expect(selectedAndHoveredNodes).toEqual(selectedOnlyNodes);
  expect(selectedAndHoveredEdges).toEqual(selectedOnlyEdges);
  expect(await page.evaluate(() => state.selected?.id)).toBe("repository:unrelated");

  await page.goto("/u/?username=example&style=galaxy-classic");
  await expect(page.locator("#status")).toBeHidden();
  await page.evaluate(() => { state.hovered = state.byId.get("repository:focus"); });
  expect(await page.evaluate(() => window.ProjectMapObsidianHover.snapshot().active)).toBe(false);
  expect((await opacities(page))["repository:unrelated"]).toBeGreaterThan(0.95);
});
