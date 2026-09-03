import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test.beforeAll(async () => {
  await mkdir(".tmp/playwright-visual/webkit", { recursive: true });
});

test("iPhone WebKit keeps the canonical Three.js details close control pointer-reachable", async ({ page }) => {
  await page.goto("/three/");
  const details = page.locator("#details");
  await expect(details).toBeHidden();

  await page.evaluate(() => {
    document.getElementById("error")?.classList.remove("visible");
    const status = document.getElementById("status");
    if (status) status.hidden = true;
    document.getElementById("details")?.classList.add("has-selection");
  });

  await expect(details).toBeVisible();
  const close = page.locator("#detailsClose");
  await expect(close).toBeVisible();
  const hit = await close.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      pointerReachable: target === button || button.contains(target),
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
    };
  });

  expect(hit.pointerReachable).toBe(true);
  expect(hit.scrollWidth).toBeLessThanOrEqual(hit.viewportWidth);
  expect(hit.rect.left).toBeGreaterThanOrEqual(0);
  expect(hit.rect.top).toBeGreaterThanOrEqual(0);
  expect(hit.rect.right).toBeLessThanOrEqual(hit.viewportWidth);

  await page.screenshot({ path: ".tmp/playwright-visual/webkit/threejs-details-hit-test.png", fullPage: true });
});
