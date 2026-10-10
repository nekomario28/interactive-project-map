import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const graph = {
  owner: "example", generatedAt: "2026-10-10T00:00:00Z", repositoryCount: 1, groupCount: 1,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:robotics", label: "Robotics", type: "group", repositoryCount: 1 },
    { id: "repository:alpha", label: "alpha", type: "repository", url: "https://github.com/example/alpha", description: "Robotics fixture", language: "TypeScript", groupId: "robotics", groupLabel: "Robotics", topics: ["robotics"], stars: 1, forks: 0, fork: false, archived: false },
  ],
  edges: [
    { source: "user:example", target: "group:robotics", type: "ownership" },
    { source: "group:robotics", target: "repository:alpha", type: "membership" },
  ],
};
const shared = ["galaxy-classic", "galaxy-systems", "galaxy-hybrid", "obsidian"];
const dedicated = ["radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"];
const views = [
  ...[...dedicated, ...shared].map((style) => [style, `${shared.includes(style) ? "/u/" : `/${style}/`}?username=example&style=${style}&motion=off`]),
  ...["cosmic", "galaxy", "aurora", "wireframe"].map((style) => [`3d-${style}`, `/three/?username=example&style3d=${style}&motion=off`]),
];

test.use({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });

test.beforeEach(async ({ page }) => {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) }));
});

for (const [name, path] of views) {
  test(`${name} keeps the project source link in the bottom-right footer`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(path);
    if (name.startsWith("3d-")) await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });
    else await expect(page.locator("#status")).toBeHidden();
    const link = page.locator("footer .project-source-link");
    await expect(link).toHaveCount(1);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "https://github.com/nekomario28/interactive-project-map");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(link).toHaveAccessibleName("Interactive Project Map source on GitHub (opens in a new tab)");
    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(24);
    expect(box.x + box.width).toBeGreaterThan(1250);
    expect(box.x + box.width).toBeLessThanOrEqual(1280);
    expect(box.y + box.height).toBeGreaterThan(850);
    expect(box.y + box.height).toBeLessThanOrEqual(900);
    expect(errors).toEqual([]);
    await mkdir(".tmp/playwright-visual/project-source", { recursive: true });
    await page.screenshot({ path: `.tmp/playwright-visual/project-source/${name}.png`, fullPage: true });
  });
}

test("project source link opens an isolated tab without changing the map", async ({ page, context }) => {
  const url = "https://github.com/nekomario28/interactive-project-map";
  await context.route(url, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Source fixture</title><p>Project source fixture</p>" }));
  await page.goto("/radial/?username=example&motion=off");
  await expect(page.locator("#status")).toBeHidden();
  const originalUrl = page.url();
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.locator("footer .project-source-link").click()]);
  await popup.waitForLoadState();
  expect(popup.url()).toBe(url);
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  expect(page.url()).toBe(originalUrl);
  await popup.close();
});

test("project source link has a visible keyboard focus indicator", async ({ page }) => {
  await page.goto("/radial/?username=example&motion=off");
  await expect(page.locator("#status")).toBeHidden();
  const link = page.locator("footer .project-source-link");
  await link.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(link).toBeFocused();
  expect(await link.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("solid");
});
