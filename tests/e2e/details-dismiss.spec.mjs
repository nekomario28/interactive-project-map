import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-09-03T00:00:00Z",
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "repository:example/alpha", label: "alpha", type: "repository", url: "https://github.com/example/alpha", description: "Alpha project", language: "Rust", stars: 3, forks: 0, topics: [], groupLabel: "Tools" },
  ],
  edges: [{ source: "user:example", target: "repository:example/alpha", type: "owns" }],
};

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

test.use({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });

test("2D details close button dismisses the panel until the next selection", async ({ page }) => {
  await installGraph(page);
  await page.goto("/u/?username=example&motion=off");
  await expect(page.locator("#status")).toBeHidden();

  const details = page.locator("#details");
  await expect(details).toBeVisible();
  await page.locator("#search").fill("alpha");
  await page.locator("#search").press("ArrowDown");
  await expect(details).toHaveClass(/has-selection/);
  await expect(page.locator("#detailsTitle")).toHaveText("alpha");

  await page.locator("#detailsClose").click();
  await expect(details).not.toHaveClass(/has-selection/);
  await expect(details).toBeHidden();

  await page.locator("#search").fill("alpha");
  await page.locator("#search").press("ArrowDown");
  await expect(details).toHaveClass(/has-selection/);
  await expect(details).toBeVisible();
});

test("Three.js details close button dismisses the panel until the next selection", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Three.js selection is rendered once in Chromium; WebKit has a separate overlay hit-test carrier.");
  await installGraph(page);
  await page.goto("/three/?username=example&motion=off");
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });

  const canvas = page.locator("#galaxy3d");
  const details = page.locator("#details");
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(details).toHaveClass(/has-selection/);
  await expect(details).toBeVisible();

  await page.locator("#detailsClose").click();
  await expect(details).not.toHaveClass(/has-selection/);
  await expect(details).toBeHidden();

  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(details).toHaveClass(/has-selection/);
  await expect(details).toBeVisible();
});
