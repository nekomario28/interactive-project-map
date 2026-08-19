import { expect, test } from "@playwright/test";

const repositories = [
  ["robot-one", "robotics", "Python", 8],
  ["robot-two", "robotics", "C++", 4],
  ["ai-one", "ai", "Python", 7],
  ["ai-two", "ai", "JavaScript", 3],
];

const graph = {
  owner: "example",
  generatedAt: "2026-08-19T00:00:00Z",
  repositoryCount: repositories.length,
  groupCount: 2,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 2 },
    { id: "group:ai", label: "AI", type: "group", repositoryCount: 2 },
    ...repositories.map(([name, groupId, language, stars]) => ({
      id: `repository:${name}`,
      label: name,
      type: "repository",
      url: `https://github.com/example/${name}`,
      description: `${name} selection fixture`,
      language,
      topics: ["visualization"],
      stars,
      forks: 0,
      fork: false,
      archived: false,
      updatedAt: "2026-08-19T00:00:00Z",
      groupId,
      groupLabel: groupId === "robotics" ? "Robotics" : "AI",
    })),
  ],
  edges: [
    { source: "user:example", target: "group:robotics", type: "ownership" },
    { source: "user:example", target: "group:ai", type: "ownership" },
    { source: "group:robotics", target: "repository:robot-one", type: "membership" },
    { source: "group:robotics", target: "repository:robot-two", type: "membership" },
    { source: "group:ai", target: "repository:ai-one", type: "membership" },
    { source: "group:ai", target: "repository:ai-two", type: "membership" },
    { source: "repository:robot-one", target: "repository:ai-one", type: "relation" },
  ],
};

const presets = [
  ["radial", "/radial/?username=example&style=radial"],
  ["galaxy", "/u/?username=example&style=galaxy"],
  ["obsidian", "/u/?username=example&style=obsidian"],
  ["tree", "/tree/?username=example&style=tree"],
  ["treemap", "/treemap/?username=example&style=treemap"],
  ["timeline", "/timeline/?username=example&style=timeline"],
  ["cluster", "/cluster/?username=example&style=cluster"],
  ["sunburst", "/sunburst/?username=example&style=sunburst"],
  ["matrix", "/matrix/?username=example&style=matrix"],
  ["sankey", "/sankey/?username=example&style=sankey"],
];

function signature(value) {
  if (!value) return "";
  return String(
    value.id ||
    value.label ||
    value.repo?.id ||
    value.repository?.id ||
    `${value.group?.id || ""}:${value.language || ""}:${value.kind || ""}:${value.source?.id || ""}:${value.target?.id || ""}`,
  );
}

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function interactionPoints(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById("galaxy");
    const rect = canvas.getBoundingClientRect();
    const key = (value) => {
      if (!value) return "";
      return String(
        value.id ||
        value.label ||
        value.repo?.id ||
        value.repository?.id ||
        `${value.group?.id || ""}:${value.language || ""}:${value.kind || ""}:${value.source?.id || ""}:${value.target?.id || ""}`,
      );
    };
    const selected = [];
    const seen = new Set();
    let blank = null;
    const step = 6;
    for (let y = 4; y < rect.height - 4 && (selected.length < 2 || !blank); y += step) {
      for (let x = 4; x < rect.width - 4 && (selected.length < 2 || !blank); x += step) {
        const hit = hitTest(x, y);
        if (!hit) {
          blank ||= { x, y };
          continue;
        }
        const id = key(hit);
        if (id && !seen.has(id)) {
          seen.add(id);
          selected.push({ x, y, id });
        }
      }
    }
    return {
      rect: { left: rect.left, top: rect.top },
      first: selected[0] || null,
      second: selected[1] || null,
      blank,
    };
  });
}

for (const [name, url] of presets) {
  test(`${name}: item click switches focus and blank click clears it`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installGraph(page);
    await page.goto(url);
    await expect(page.locator("#status")).toBeHidden();

    const points = await interactionPoints(page);
    expect(points.first, `${name} did not expose a first selectable hit target`).toBeTruthy();
    expect(points.second, `${name} did not expose a second selectable hit target`).toBeTruthy();
    expect(points.blank, `${name} did not expose blank canvas space`).toBeTruthy();

    await page.mouse.click(points.rect.left + points.first.x, points.rect.top + points.first.y);
    const firstSelection = await page.evaluate(() => {
      const value = state.selected;
      if (!value) return "";
      return String(value.id || value.label || value.repo?.id || value.repository?.id || `${value.group?.id || ""}:${value.language || ""}:${value.kind || ""}:${value.source?.id || ""}:${value.target?.id || ""}`);
    });
    expect(firstSelection).toBeTruthy();

    await page.mouse.click(points.rect.left + points.second.x, points.rect.top + points.second.y);
    const secondSelection = await page.evaluate(() => {
      const value = state.selected;
      if (!value) return "";
      return String(value.id || value.label || value.repo?.id || value.repository?.id || `${value.group?.id || ""}:${value.language || ""}:${value.kind || ""}:${value.source?.id || ""}:${value.target?.id || ""}`);
    });
    expect(secondSelection).toBeTruthy();
    expect(secondSelection).not.toBe(firstSelection);

    await page.mouse.click(points.rect.left + points.blank.x, points.rect.top + points.blank.y);
    await expect.poll(() => page.evaluate(() => state.selected === null)).toBe(true);
  });
}

// Keep this helper referenced by Node so lint catches accidental shape drift.
void signature;
