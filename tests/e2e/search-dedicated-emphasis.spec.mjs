import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-20T00:00:00Z",
  repositoryCount: 3,
  groupCount: 2,
  taxonomy: {
    schemaVersion: 1,
    corpusFingerprint: "fixture",
    repositories: [],
    source: { providerId: "standard", model: "ipm-standard-v1" },
    categories: [
      { id: "robotics-automation", label: "Robotics & Automation", description: "Robotics and automation", aliases: ["robots", "autonomous systems", "ros robotics"] },
      { id: "ai-ml", label: "AI & Machine Learning", description: "AI systems", aliases: ["artificial intelligence", "deep learning"] },
    ],
  },
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics-automation", label: "Robotics & Automation", type: "group", repositoryCount: 2 },
    { id: "group:ai-ml", label: "AI & Machine Learning", type: "group", repositoryCount: 1 },
    {
      id: "repository:robot-nav", label: "robot-nav", type: "repository", url: "https://github.com/example/robot-nav",
      description: "Autonomous navigation stack", language: "Python", topics: ["navigation"], stars: 5, forks: 0, fork: false, archived: false,
      createdAt: "2025-01-10T00:00:00Z", updatedAt: "2026-08-20T00:00:00Z", groupId: "robotics-automation", groupLabel: "Robotics & Automation",
      taxonomyAssignment: { categoryId: "robotics-automation", categoryLabel: "Robotics & Automation", confidence: 0.98, method: "deterministic", evidence: [], secondaryTags: ["artifact:application", "ecosystem:ros2", "topic:slam"] },
    },
    {
      id: "repository:robot-arm", label: "robot-arm", type: "repository", url: "https://github.com/example/robot-arm",
      description: "Manipulator controller", language: "C++", topics: ["moveit"], stars: 2, forks: 0, fork: false, archived: false,
      createdAt: "2025-06-12T00:00:00Z", updatedAt: "2026-08-20T00:00:00Z", groupId: "robotics-automation", groupLabel: "Robotics & Automation",
      taxonomyAssignment: { categoryId: "robotics-automation", categoryLabel: "Robotics & Automation", confidence: 0.97, method: "deterministic", evidence: [], secondaryTags: ["artifact:application", "ecosystem:ros2", "topic:manipulation"] },
    },
    {
      id: "repository:model-train", label: "model-train", type: "repository", url: "https://github.com/example/model-train",
      description: "Neural network model training", language: "Python", topics: ["machine-learning"], stars: 4, forks: 0, fork: false, archived: false,
      createdAt: "2026-01-03T00:00:00Z", updatedAt: "2026-08-20T00:00:00Z", groupId: "ai-ml", groupLabel: "AI & Machine Learning",
      taxonomyAssignment: { categoryId: "ai-ml", categoryLabel: "AI & Machine Learning", confidence: 0.96, method: "deterministic", evidence: [], secondaryTags: ["artifact:model", "topic:training"] },
    },
  ],
  edges: [
    { source: "user:example", target: "group:robotics-automation", type: "ownership" },
    { source: "user:example", target: "group:ai-ml", type: "ownership" },
    { source: "group:robotics-automation", target: "repository:robot-nav", type: "membership" },
    { source: "group:robotics-automation", target: "repository:robot-arm", type: "membership" },
    { source: "group:ai-ml", target: "repository:model-train", type: "membership" },
  ],
};

const presets = [
  ["radial", "/radial/?username=example&style=radial"],
  ["tree", "/tree/?username=example&style=tree"],
  ["treemap", "/treemap/?username=example&style=treemap"],
  ["timeline", "/timeline/?username=example&style=timeline"],
  ["cluster", "/cluster/?username=example&style=cluster"],
  ["sunburst", "/sunburst/?username=example&style=sunburst"],
  ["matrix", "/matrix/?username=example&style=matrix"],
  ["sankey", "/sankey/?username=example&style=sankey"],
];

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

function geometrySnapshot() {
  return () => {
    const style = document.body.dataset.mapStyle;
    const common = { zoom: state.zoom, pan: { ...state.pan } };
    if (["radial", "tree", "cluster", "timeline"].includes(style)) {
      return { ...common, nodes: (state.nodes || []).map((node) => [node.id, node.x, node.y]) };
    }
    if (style === "treemap") {
      return { ...common, repos: (state.repos || []).map((repo) => [repo.id, { ...repo.box }]) };
    }
    if (style === "sunburst") {
      return {
        ...common,
        segments: (state.segments || []).map((repo) => [repo.id, repo.start, repo.end]),
        groups: (state.groups || []).map((group) => [group.group?.id, group.start, group.end]),
      };
    }
    if (style === "matrix") {
      return {
        ...common,
        rows: (state.rows || []).map((row) => row.id),
        columns: [...(state.columns || [])],
        cells: (state.cells || []).map((cell) => [cell.rowIndex, cell.columnIndex, cell.repos.map((repo) => repo.id)]),
      };
    }
    if (style === "sankey") {
      return {
        ...common,
        groups: (state.groups || []).map((group) => [group.group?.id, group.x, group.y, group.w, group.h]),
        statuses: (state.statuses || []).map((node) => [node.status, node.x, node.y, node.w, node.h]),
      };
    }
    return common;
  };
}

for (const [style, url] of presets) {
  test(`${style}: direct repository hits are visually ranked above context without geometry changes`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installGraph(page);
    await page.goto(url);
    await expect(page.locator("#status")).toBeHidden();
    await expect.poll(() => page.evaluate(() => Boolean(window.ProjectMapSearchVisualEmphasis))).toBe(true);

    const before = await page.evaluate(geometrySnapshot());
    const search = page.locator("#search");

    await search.fill("ecosystem:ros2");
    await expect.poll(() => page.evaluate(() => window.ProjectMapSearchContext?.snapshot().query)).toBe("ecosystem:ros2");
    const direct = await page.evaluate(() => ({
      context: window.ProjectMapSearchContext.snapshot(),
      visual: window.ProjectMapSearchVisualEmphasis.snapshot(),
      aggregateMatches: document.body.dataset.mapStyle === "matrix"
        ? state.cells.reduce((sum, cell) => sum + cellMatchCount(cell), 0)
        : document.body.dataset.mapStyle === "sankey"
          ? state.groups.reduce((sum, group) => sum + filteredCount(group), 0)
          : null,
    }));
    expect(direct.context.directRepositoryIds).toEqual(["repository:robot-arm", "repository:robot-nav"]);
    expect(direct.visual.directRepositoryIds).toEqual(direct.context.directRepositoryIds);
    expect(direct.visual.targetCount).toBeGreaterThan(0);
    expect(direct.visual.renderedTargetCount).toBeGreaterThan(0);
    if (style === "matrix" || style === "sankey") expect(direct.aggregateMatches).toBe(2);
    expect(await page.evaluate(geometrySnapshot())).toEqual(before);

    await search.fill("autonomous systems");
    await expect.poll(() => page.evaluate(() => window.ProjectMapSearchContext.snapshot().query)).toBe("autonomous systems");
    const category = await page.evaluate(() => ({
      context: window.ProjectMapSearchContext.snapshot(),
      visual: window.ProjectMapSearchVisualEmphasis.snapshot(),
      aggregateMatches: document.body.dataset.mapStyle === "matrix"
        ? state.cells.reduce((sum, cell) => sum + cellMatchCount(cell), 0)
        : document.body.dataset.mapStyle === "sankey"
          ? state.groups.reduce((sum, group) => sum + filteredCount(group), 0)
          : null,
    }));
    expect(category.context.directRepositoryIds).toEqual([]);
    expect(category.context.directCategoryIds).toEqual(["group:robotics-automation"]);
    expect(category.context.categoryMemberIds).toEqual(["repository:robot-arm", "repository:robot-nav"]);
    expect(category.visual.targetCount).toBe(0);
    if (style === "matrix" || style === "sankey") expect(category.aggregateMatches).toBe(2);
    expect(await page.evaluate(geometrySnapshot())).toEqual(before);

    if (style === "matrix" || style === "sankey") {
      await search.fill("ecosystem:ros2");
      await search.press("ArrowDown");
      const first = await page.evaluate(() => ({ selected: state.selected?.id, direct: window.ProjectMapSearchContext.directRepositories(), meta: document.getElementById("detailsMeta")?.textContent || "" }));
      expect(first.direct).toHaveLength(2);
      expect(first.selected).toBe(first.direct[0]);
      expect(first.meta).toContain("Match");
      await search.press("ArrowDown");
      expect(await page.evaluate(() => state.selected?.id)).toBe(first.direct[1]);
      expect(await page.evaluate(geometrySnapshot())).toEqual(before);
    }
  });
}
