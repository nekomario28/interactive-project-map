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

test("project source link stays inside intermediate and narrow viewports", async ({ page }) => {
  for (const [width, height] of [[830, 600], [844, 390], [390, 844]]) {
    await page.setViewportSize({ width, height });
    for (const [name, path] of [
      ["radial", "/radial/?username=example&style=radial&motion=off"],
      ["shared", "/u/?username=example&style=galaxy-systems&motion=off"],
      ["three", "/three/?username=example&style3d=cosmic&motion=off"],
    ]) {
      await page.goto(path);
      if (name === "three") await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });
      else await expect(page.locator("#status")).toBeHidden();
      const link = page.locator(".project-source-link:visible");
      await expect(link).toBeInViewport({ ratio: 1 });
      const box = await link.boundingBox();
      expect(box.x + box.width, `${name} at ${width}px`).toBeLessThanOrEqual(width);
      expect(box.y + box.height, `${name} at ${width}px`).toBeLessThanOrEqual(height);
      expect(await link.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return hit === element || element.contains(hit);
      })).toBe(true);
      await mkdir(".tmp/playwright-visual/project-source-responsive", { recursive: true });
      await page.screenshot({ path: `.tmp/playwright-visual/project-source-responsive/${name}-${width}x${height}.png` });
    }
  }
});

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

test.describe("touch source navigation", () => {
  test.use({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });

  test("source stays reachable in the toolbar across portrait, reduced height and landscape", async ({ page }) => {
    for (const [width, height] of [[393, 851], [393, 420], [851, 393], [320, 568], [375, 667]]) {
      await page.setViewportSize({ width, height });
      for (const [name, path] of [
        ["radial", "/radial/?username=example&style=radial&motion=off"],
        ["shared", "/u/?username=example&style=galaxy-systems&motion=off"],
        ["three", "/three/?username=example&style3d=cosmic&motion=off"],
      ]) {
        await page.goto(path);
        await expect(page.locator("header .controls")).toBeHidden();
        const workspace = await page.locator(".workspace").boundingBox();
        expect(workspace.height, `${name} must leave most of the mobile screen for the map`).toBeGreaterThanOrEqual(height * 0.55);
        if (name !== "three") {
          await expect(page.locator("#status")).toBeHidden();
          await expect.poll(() => page.locator("canvas").evaluate((canvas) => {
            const r = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            return Math.max(Math.abs(canvas.width / dpr - r.width), Math.abs(canvas.height / dpr - r.height));
          })).toBeLessThanOrEqual(1);
        }
        const link = page.locator("header .project-source-link");
        await expect(link).toBeVisible();
        await expect(link).toHaveText("Source ↗");
        await expect(link).toBeInViewport({ ratio: 1 });
        await expect(page.getByRole("link", { name: "Interactive Project Map source on GitHub (opens in a new tab)", exact: true })).toHaveCount(1);
        const box = await link.boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.y + box.height).toBeLessThanOrEqual(100);
        const heading = await page.locator("#title").boundingBox();
        const titleBlock = await page.locator(".title-block").boundingBox();
        expect(heading.width + 1, `${name} must not reserve source-button width inside the title`).toBeGreaterThanOrEqual(titleBlock.width);
        expect(await link.evaluate((element) => {
          const r = element.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return hit === element || element.contains(hit);
        })).toBe(true);
        await mkdir(".tmp/playwright-visual/mobile-source", { recursive: true });
        await page.screenshot({ path: `.tmp/playwright-visual/mobile-source/${name}-${width}x${height}.png` });
      }
    }
  });

  test("short-height controls can scroll to Copy link without hiding Source or the graph", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 420 });
    await page.goto("/u/?username=example&style=galaxy-systems&motion=off");
    await expect(page.locator("#status")).toBeHidden();
    const source = page.locator("header .project-source-link");
    const before = await source.boundingBox();
    const workspace = await page.locator(".workspace").boundingBox();
    expect(workspace.height).toBeGreaterThanOrEqual(50);
    const toggle = page.getByRole("button", { name: "Controls", exact: true });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.tap();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const copy = page.locator("#shareView");
    await copy.scrollIntoViewIfNeeded();
    await expect(copy).toBeInViewport({ ratio: 1 });
    expect(await copy.evaluate((element) => {
      const r = element.getBoundingClientRect();
      return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === element;
    })).toBe(true);
    await expect(source).toBeInViewport({ ratio: 1 });
    expect((await source.boundingBox()).y).toBe(before.y);
    await page.screenshot({ path: ".tmp/playwright-visual/mobile-source/shared-scrolled-393x420.png" });
    await toggle.tap();
    await expect(page.locator("header .controls")).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("toolbar source opens an isolated tab by touch even when the graph cannot load", async ({ page, context }) => {
    const url = "https://github.com/nekomario28/interactive-project-map";
    await context.route(url, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Source fixture</title>" }));
    await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", (route) => route.fulfill({ status: 404, body: "Missing graph fixture" }));
    for (const path of ["/radial/?username=example", "/u/?username=example", "/three/?username=example"]) {
      await page.goto(path);
      const originalUrl = page.url();
      const link = page.getByRole("link", { name: "Interactive Project Map source on GitHub (opens in a new tab)", exact: true });
      await expect(link).toHaveCount(1);
      const [popup] = await Promise.all([page.waitForEvent("popup"), link.tap()]);
      await popup.waitForLoadState();
      expect(popup.url()).toBe(url);
      expect(await popup.evaluate(() => window.opener)).toBeNull();
      expect(page.url()).toBe(originalUrl);
      await popup.close();
    }
  });
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
