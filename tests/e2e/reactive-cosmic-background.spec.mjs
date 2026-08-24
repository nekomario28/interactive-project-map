import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-24T00:00:00Z",
  repositoryCount: 4,
  groupCount: 2,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 2 },
    { id: "group:systems", label: "Systems", type: "group", repositoryCount: 2 },
    { id: "repository:alpha", label: "alpha", type: "repository", url: "https://github.com/example/alpha", language: "Python", stars: 2, forks: 0, fork: false, archived: false, groupId: "robotics", groupLabel: "Robotics", updatedAt: "2026-08-20T00:00:00Z" },
    { id: "repository:beta", label: "beta", type: "repository", url: "https://github.com/example/beta", language: "TypeScript", stars: 0, forks: 0, fork: false, archived: false, groupId: "robotics", groupLabel: "Robotics", updatedAt: "2026-08-21T00:00:00Z" },
    { id: "repository:gamma", label: "gamma", type: "repository", url: "https://github.com/example/gamma", language: "Rust", stars: 4, forks: 0, fork: false, archived: false, groupId: "systems", groupLabel: "Systems", updatedAt: "2026-08-21T00:00:00Z" },
    { id: "repository:delta", label: "delta", type: "repository", url: "https://github.com/example/delta", language: "C++", stars: 1, forks: 0, fork: false, archived: false, groupId: "systems", groupLabel: "Systems", updatedAt: "2026-08-21T00:00:00Z" },
  ],
  edges: [
    { source: "user:example", target: "group:robotics", type: "ownership" },
    { source: "user:example", target: "group:systems", type: "ownership" },
    { source: "group:robotics", target: "repository:alpha", type: "membership" },
    { source: "group:robotics", target: "repository:beta", type: "membership" },
    { source: "group:systems", target: "repository:gamma", type: "membership" },
    { source: "group:systems", target: "repository:delta", type: "membership" },
  ],
  semanticEdges: [],
};

async function installFixture(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function sampleFirstDonorStar(page) {
  return page.evaluate(() => {
    const snap = window.ProjectMapCosmicBackground?.snapshot();
    if (!snap?.firstStar) return null;
    const size = canvasSize();
    drawBackground(palette(), size.width, size.height);
    const dpr = window.devicePixelRatio || 1;
    const cx = Math.round(snap.firstStar.screen.x * dpr);
    const cy = Math.round(snap.firstStar.screen.y * dpr);
    const x = Math.max(0, Math.min(canvas.width - 5, cx - 2));
    const y = Math.max(0, Math.min(canvas.height - 5, cy - 2));
    const pixels = ctx.getImageData(x, y, 5, 5).data;
    let brightest = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      brightest = Math.max(brightest, pixels[index] + pixels[index + 1] + pixels[index + 2]);
    }
    return { snap, brightest };
  });
}

test("Galaxy restores the profile-local background as one world-space system", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await installFixture(page);
  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(window.ProjectMapCosmicBackground))).toBe(true);

  const before = await sampleFirstDonorStar(page);
  expect(before).not.toBeNull();
  expect(before.snap.donor).toBe("nekomario28/profile-local-common-center-galaxy");
  expect(before.snap.donorCommit).toBe("ead72debca2a16608ebc5b799993c0234ea10cab");
  expect(before.snap.geometry).toBe("world-space-spiral-sectors");
  expect(before.snap.starCount).toBe(92);
  expect(before.snap.rings).toEqual([132, 194, 256]);
  expect(before.snap.yFlatten).toBe(0.63);
  expect(before.snap.associationLobes).toBe(4);
  expect(before.snap.associationStars).toBe(7);
  expect(before.snap.groupCount).toBe(2);
  expect(before.brightest).toBeGreaterThan(45);
  expect(await page.evaluate(() => typeof window.ProjectMapCosmicBackground.spawnMeteor)).toBe("undefined");

  await page.evaluate(() => {
    state.pan.x += 120;
    state.pan.y -= 75;
    draw();
  });
  const after = await sampleFirstDonorStar(page);
  expect(after).not.toBeNull();
  expect(after.brightest).toBeGreaterThan(45);
  expect(after.snap.firstStar.world.x).toBeCloseTo(before.snap.firstStar.world.x, 5);
  expect(after.snap.firstStar.world.y).toBeCloseTo(before.snap.firstStar.world.y, 5);
  expect(Math.abs(after.snap.firstStar.screen.x - before.snap.firstStar.screen.x)).toBeGreaterThan(90);
  expect(Math.abs(after.snap.firstStar.screen.y - before.snap.firstStar.screen.y)).toBeGreaterThan(50);

  await context.close();
});

test("Obsidian keeps its own background instead of inheriting the profile galaxy structure", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1000, height: 760 } });
  const page = await context.newPage();
  await installFixture(page);
  await page.goto("/u/?username=example&style=obsidian");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(window.ProjectMapCosmicBackground))).toBe(true);
  expect(await page.evaluate(() => window.ProjectMapCosmicBackground.snapshot().donorCommit)).toBe("ead72debca2a16608ebc5b799993c0234ea10cab");
  expect(await page.evaluate(() => state.style)).toBe("obsidian");
  expect(await page.evaluate(() => typeof window.ProjectMapCosmicBackground.spawnMeteor)).toBe("undefined");
  await context.close();
});
