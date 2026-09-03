import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-09-03T00:00:00Z",
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
  ],
  edges: [],
};

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

test("mobile Three.js selection opens the canonical details panel and close hides it", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Three.js selection is rendered once in Chromium; WebKit has a separate overlay hit-test carrier.");
  await installGraph(page);
  await page.goto("/three/?username=example");
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 20_000 });

  const canvas = page.locator("#galaxy3d");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });

  const details = page.locator("#details");
  await expect(details).toHaveClass(/has-selection/);
  await expect(details).toBeVisible();
  await expect(page.locator("#detailsTitle")).toHaveText("example");

  const close = page.locator("#detailsClose");
  await expect(close).toBeVisible();
  const topmostAtClose = await close.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit === button || button.contains(hit);
  });
  expect(topmostAtClose).toBe(true);

  await close.click();
  await expect(details).not.toHaveClass(/has-selection/);
  await expect(details).toBeHidden();
});
