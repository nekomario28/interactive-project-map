import { expect, test } from "@playwright/test";

function largeGraph(repositoryCount = 300, groupCount = 10) {
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    id: `group:stress-${index}`,
    label: `Stress Category ${index + 1}`,
    type: "group",
    repositoryCount: Math.ceil(repositoryCount / groupCount),
  }));
  const repos = Array.from({ length: repositoryCount }, (_, index) => {
    const groupIndex = index % groups.length;
    const name = `stress-repo-${String(index).padStart(3, "0")}`;
    return {
      id: `repository:${name}`,
      label: name,
      type: "repository",
      url: `https://github.com/example/${name}`,
      description: `Synthetic dense-label repository ${index}`,
      language: ["Python", "TypeScript", "Rust", "C++", "Java", "Shell"][index % 6],
      topics: ["stress", `group-${groupIndex}`],
      stars: (index * 13) % 37,
      forks: index % 7,
      fork: index % 11 === 0,
      archived: index % 19 === 0,
      createdAt: new Date(Date.UTC(2020 + (index % 7), index % 12, 1 + (index % 27))).toISOString(),
      updatedAt: "2026-08-18T00:00:00Z",
      groupId: `stress-${groupIndex}`,
      groupLabel: groups[groupIndex].label,
    };
  });
  return {
    owner: "example",
    generatedAt: "2026-08-18T00:00:00Z",
    repositoryCount,
    groupCount: groups.length,
    nodes: [
      { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
      ...groups,
      ...repos,
    ],
    edges: [
      ...groups.map((group) => ({ source: "user:example", target: group.id, type: "ownership" })),
      ...repos.map((repo) => ({ source: `group:${repo.groupId}`, target: repo.id, type: "membership" })),
    ],
  };
}

async function installGraph(page, graph) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function capturedRepositoryLabels(page) {
  return page.evaluate(() => {
    const seen = [];
    const original = ctx.fillText;
    ctx.fillText = function capture(text, ...args) {
      const value = String(text);
      if (value.startsWith("stress-repo-")) seen.push(value);
      return original.call(this, text, ...args);
    };
    try {
      draw();
    } finally {
      ctx.fillText = original;
    }
    return seen;
  });
}

test("Sunburst preserves dense label LOD while search hits remain readable", async ({ page }) => {
  await installGraph(page, largeGraph());
  await page.goto("/sunburst/?username=example&style=sunburst");
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator(".legend .contributed")).toHaveCount(1);

  const ambientLabels = await capturedRepositoryLabels(page);
  expect(ambientLabels).toHaveLength(0);

  await page.locator("#search").fill("stress-repo-137");
  await expect.poll(() => page.evaluate(() => state.query)).toBe("stress-repo-137");
  const searchedLabels = await capturedRepositoryLabels(page);
  expect(searchedLabels).toContain("stress-repo-137");
  expect(searchedLabels.length).toBeLessThanOrEqual(2);
});
