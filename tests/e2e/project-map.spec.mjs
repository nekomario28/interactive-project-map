import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const styles = [
  ["radial", "/radial/"],
  ["galaxy-classic", "/u/"],
  ["galaxy-systems", "/u/"],
  ["galaxy-hybrid", "/u/"],
  ["obsidian", "/u/"],
  ["tree", "/tree/"],
  ["treemap", "/treemap/"],
  ["timeline", "/timeline/"],
  ["cluster", "/cluster/"],
  ["sunburst", "/sunburst/"],
  ["matrix", "/matrix/"],
  ["sankey", "/sankey/"],
];

const groups = [
  ["robotics", "Robotics / ROS 2"],
  ["ai-ml", "AI / Machine Learning"],
  ["minecraft", "Minecraft Modding"],
  ["lang-python", "Python"],
];

const repoDefs = [
  ["dual-scorpion-sim", "robotics", "Python", false, false, 7, "2025-01-10T00:00:00Z"],
  ["acrylic-press-cell", "robotics", "C++", false, false, 3, "2025-04-12T00:00:00Z"],
  ["robotics-fork", "robotics", "Python", true, false, 1, "2025-07-03T00:00:00Z"],
  ["decidelta", "ai-ml", "Rust", false, false, 9, "2025-08-21T00:00:00Z"],
  ["pokemon-agent", "ai-ml", "Python", false, false, 4, "2026-01-16T00:00:00Z"],
  ["old-ai-experiment", "ai-ml", "Jupyter Notebook", false, true, 0, "2024-03-02T00:00:00Z"],
  ["civitas", "minecraft", "Java", false, false, 5, "2025-11-09T00:00:00Z"],
  ["create-addon-notes", "minecraft", "Java", true, false, 0, "2026-02-14T00:00:00Z"],
  ["interactive-project-map", "lang-python", "JavaScript", false, false, 12, "2026-06-01T00:00:00Z"],
  ["course-utils", "lang-python", "Python", false, false, 2, "2024-09-20T00:00:00Z"],
];

const graph = {
  owner: "example",
  generatedAt: "2026-08-18T00:00:00Z",
  repositoryCount: repoDefs.length,
  groupCount: groups.length,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    ...groups.map(([id, label]) => ({ id: `group:${id}`, label, type: "group", repositoryCount: repoDefs.filter((repo) => repo[1] === id).length })),
    ...repoDefs.map(([name, groupId, language, fork, archived, stars, createdAt], index) => ({
      id: `repository:${name}`, label: name, type: "repository", url: `https://github.com/example/${name}`, description: `${name} browser fixture project`, language,
      topics: index % 2 === 0 ? ["robotics", "visualization"] : ["project-map"], stars, forks: Math.floor(stars / 3), fork, archived, createdAt,
      updatedAt: "2026-08-18T00:00:00Z", groupId, groupLabel: groups.find(([id]) => id === groupId)?.[1] || "Other",
    })),
  ],
  edges: [
    ...groups.map(([id]) => ({ source: "user:example", target: `group:${id}`, type: "ownership" })),
    ...repoDefs.map(([name, groupId]) => ({ source: `group:${groupId}`, target: `repository:${name}`, type: "membership" })),
    { source: "repository:dual-scorpion-sim", target: "repository:decidelta", type: "relation" },
  ],
};

async function installRawFixture(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/galaxy.svg", async (route) => {
    await route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="740" height="420"><rect width="100%" height="100%" fill="#070a12"/></svg>' });
  });
}

function watchBrowserErrors(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
  return failures;
}

test.beforeAll(async () => {
  await mkdir(".tmp/playwright-visual/dark", { recursive: true });
  await mkdir(".tmp/playwright-visual/mobile", { recursive: true });
});

test("generator exposes twelve visual presets and emits the selected stable setup", async ({ page }) => {
  await installRawFixture(page);
  const browserErrors = watchBrowserErrors(page);
  await page.goto("/");

  const cards = page.locator("[data-style-preset]");
  await expect(cards).toHaveCount(12);
  for (const [style] of styles) {
    const card = page.locator(`[data-style-preset="${style}"]`);
    await card.click();
    await expect(page.locator("#mapStyle")).toHaveValue(style);
    await expect(card).toHaveAttribute("aria-pressed", "true");
  }

  await page.locator('[data-style-preset="galaxy-hybrid"]').click();
  await page.locator("#username").fill("example");
  await page.locator("#theme").selectOption("light");
  await page.locator("#maxRepos").fill("300");
  await page.getByRole("button", { name: "Generate setup" }).click();

  await expect(page.locator("#result")).toHaveClass(/visible/);
  const workflow = await page.locator("#workflow").inputValue();
  expect(workflow).toContain("style: galaxy-hybrid");
  expect(workflow).toContain('max_repos: "300"');
  expect(workflow).toContain("theme: light");
  expect(workflow).toContain("uses: nekomario28/interactive-project-map/.github/workflows/generate-project-map.yml@v1");
  const staticUrls = await page.locator("#staticUrls").inputValue();
  expect(staticUrls).toContain("/u/?username=example&style=galaxy-hybrid");
  await expect(page).toHaveURL(/style=galaxy-hybrid/);

  await page.locator("#username").fill("bad user!");
  await page.getByRole("button", { name: "Generate setup" }).click();
  await expect(page.locator("#status")).toContainText("valid GitHub username");
  await expect(page.locator("#result")).not.toHaveClass(/visible/);
  expect(browserErrors).toEqual([]);
});

test("all twelve viewers load one sanitized graph without browser errors", async ({ browser }) => {
  for (const [style, path] of styles) {
    await test.step(style, async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await installRawFixture(page);
      const browserErrors = watchBrowserErrors(page);
      await page.goto(`${path}?username=example&style=${style}`);
      await expect(page.locator("#galaxy")).toBeVisible();
      await expect(page.locator("#style")).toHaveValue(style);
      await expect(page.locator("#status")).toBeHidden();
      await expect(page.locator("#error")).not.toHaveClass(/visible/);

      await page.locator("#search").fill("robot");
      await page.getByRole("button", { name: "Fit" }).click();
      await page.getByRole("button", { name: "Reset" }).click();
      await page.locator("#galaxy").focus();
      await page.keyboard.press("0");
      await page.keyboard.press("+");
      await page.keyboard.press("-");
      await page.keyboard.press("Escape");
      await page.screenshot({ path: `.tmp/playwright-visual/dark/${style}.png`, fullPage: true });

      expect(browserErrors).toEqual([]);
      await context.close();
    });
  }
});

test("style navigation crosses dedicated and all shared Galaxy routes", async ({ page }) => {
  await installRawFixture(page);
  const browserErrors = watchBrowserErrors(page);
  await page.goto("/tree/?username=example&style=tree");
  await expect(page.locator("#status")).toBeHidden();

  for (const style of ["galaxy-classic", "galaxy-systems", "galaxy-hybrid", "obsidian"]) {
    await page.locator("#style").selectOption(style);
    await page.waitForURL(new RegExp(`/u/\\?username=example&style=${style}`));
    await expect(page.locator("#style")).toHaveValue(style);
    await expect(page.locator("#status")).toBeHidden();
  }

  await page.locator("#style").selectOption("sankey");
  await page.waitForURL(/\/sankey\/\?username=example&style=sankey/);
  await expect(page.locator("#style")).toHaveValue("sankey");
  await expect(page.locator("#status")).toBeHidden();
  expect(browserErrors).toEqual([]);
});

test("generator and viewer remain usable at a phone viewport", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await installRawFixture(page);
  const browserErrors = watchBrowserErrors(page);

  await page.goto("/");
  await expect(page.locator("[data-style-preset]")).toHaveCount(12);
  const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(homeOverflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: ".tmp/playwright-visual/mobile/generator.png", fullPage: true });

  await page.goto("/u/?username=example&style=galaxy-hybrid");
  await expect(page.locator("#status")).toBeHidden();
  const viewerOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(viewerOverflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: ".tmp/playwright-visual/mobile/galaxy-hybrid.png", fullPage: true });

  expect(browserErrors).toEqual([]);
  await context.close();
});