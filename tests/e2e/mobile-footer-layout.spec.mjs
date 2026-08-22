import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-22T00:00:00Z",
  repositoryCount: 1,
  groupCount: 1,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:systems", label: "Systems", type: "group", repositoryCount: 1 },
    { id: "repository:project", label: "project", type: "repository", url: "https://github.com/example/project", description: "fixture", language: "JavaScript", topics: [], stars: 1, forks: 0, fork: false, archived: false, updatedAt: "2026-08-22T00:00:00Z", groupId: "systems", groupLabel: "Systems" },
  ],
  edges: [
    { source: "user:example", target: "group:systems", type: "ownership" },
    { source: "group:systems", target: "repository:project", type: "membership" },
  ],
};

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

for (const path of ["/u/?username=example&style=galaxy-hybrid", "/treemap/?username=example&style=treemap"]) {
  test(`mobile footer stays inside the viewport: ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installGraph(page);
    await page.goto(path);
    await expect(page.locator("#status")).toBeHidden();

    const geometry = await page.evaluate(() => {
      const footer = document.querySelector("footer");
      const note = footer?.querySelector(":scope > span:first-child");
      if (!footer || !note) return null;
      const footerRect = footer.getBoundingClientRect();
      const noteRect = note.getBoundingClientRect();
      const style = getComputedStyle(note);
      return {
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        footerLeft: footerRect.left,
        footerRight: footerRect.right,
        footerBottom: footerRect.bottom,
        noteRight: noteRect.right,
        noteClientWidth: note.clientWidth,
        noteScrollWidth: note.scrollWidth,
        overflow: style.overflow,
        textOverflow: style.textOverflow,
        whiteSpace: style.whiteSpace,
      };
    });

    expect(geometry).not.toBeNull();
    expect(geometry.footerLeft).toBeGreaterThanOrEqual(-0.5);
    expect(geometry.footerRight).toBeLessThanOrEqual(geometry.viewportWidth + 0.5);
    expect(geometry.footerBottom).toBeLessThanOrEqual(geometry.viewportHeight + 0.5);
    expect(geometry.noteRight).toBeLessThanOrEqual(geometry.footerRight + 0.5);
    expect(geometry.noteScrollWidth).toBeGreaterThan(geometry.noteClientWidth);
    expect(geometry.overflow).toBe("hidden");
    expect(geometry.textOverflow).toBe("ellipsis");
    expect(geometry.whiteSpace).toBe("nowrap");
  });
}
