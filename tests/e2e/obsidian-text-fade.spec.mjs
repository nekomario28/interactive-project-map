import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-21T00:00:00Z",
  repositoryCount: 2,
  groupCount: 1,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:research", label: "Research", type: "group", repositoryCount: 2 },
    { id: "repository:focus-repo", label: "focus-repo", type: "repository", url: "https://github.com/example/focus-repo", description: "fade target", language: "JavaScript", topics: [], stars: 0, forks: 0, fork: false, archived: false, updatedAt: "2026-08-21T00:00:00Z", groupId: "research", groupLabel: "Research" },
    { id: "repository:other-repo", label: "other-repo", type: "repository", url: "https://github.com/example/other-repo", description: "other target", language: "Rust", topics: [], stars: 0, forks: 0, fork: false, archived: false, updatedAt: "2026-08-21T00:00:00Z", groupId: "research", groupLabel: "Research" },
  ],
  edges: [
    { source: "user:example", target: "group:research", type: "ownership" },
    { source: "group:research", target: "repository:focus-repo", type: "membership" },
    { source: "group:research", target: "repository:other-repo", type: "membership" },
  ],
};

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function arrange(page) {
  await page.evaluate(() => {
    const positions = {
      "user:example": [0, -250],
      "group:research": [0, -40],
      "repository:focus-repo": [280, 120],
      "repository:other-repo": [-280, 120],
    };
    for (const [id, [x, y]] of Object.entries(positions)) {
      const node = state.byId.get(id);
      node.x = x; node.y = y; node.vx = 0; node.vy = 0;
    }
    state.pan.x = 0; state.pan.y = 0;
  });
}

async function labelAlpha(page, zoom, label = "focus-repo") {
  return page.evaluate(({ targetZoom, targetLabel }) => {
    state.zoom = targetZoom;
    const values = [];
    const original = ctx.fillText;
    ctx.fillText = function capture(text, ...args) {
      if (String(text) === targetLabel) values.push(ctx.globalAlpha);
      return original.call(this, text, ...args);
    };
    try { draw(); } finally { ctx.fillText = original; }
    return values.length ? Math.max(...values) : 0;
  }, { targetZoom: zoom, targetLabel: label });
}

test("Obsidian note labels fade continuously with zoom and stay readable for active exploration", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installGraph(page);
  await page.goto("/u/?username=example&style=obsidian");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ProjectMapObsidianRuntime?.snapshot().active)).toBe(true);
  await arrange(page);

  const low = await labelAlpha(page, 0.30);
  const middle = await labelAlpha(page, 0.54);
  const high = await labelAlpha(page, 0.80);
  expect(low).toBe(0);
  expect(middle).toBeGreaterThan(0.2);
  expect(middle).toBeLessThan(0.8);
  expect(high).toBeGreaterThan(0.95);

  await page.evaluate(() => updateDetails(state.byId.get("repository:focus-repo")));
  const selectedLow = await labelAlpha(page, 0.30);
  expect(selectedLow).toBeGreaterThan(0.95);

  await page.evaluate(() => { updateDetails(null); state.hovered = state.byId.get("repository:focus-repo"); });
  const hoveredLow = await labelAlpha(page, 0.30);
  expect(hoveredLow).toBeGreaterThan(0.95);

  await page.evaluate(() => { state.hovered = null; });
  await page.locator("#search").fill("focus-repo");
  await expect.poll(() => page.evaluate(() => window.ProjectMapSearchContext?.level("repository:focus-repo"))).toBe("direct");
  const searchedLow = await labelAlpha(page, 0.30);
  expect(searchedLow).toBeGreaterThanOrEqual(0.82);
});
