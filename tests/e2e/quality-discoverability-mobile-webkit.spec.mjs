import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { installQualityDiscoverabilityFixture } from "./quality-discoverability-fixture.mjs";

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.beforeAll(async () => {
  await mkdir(".tmp/playwright-visual/webkit", { recursive: true });
});

test("iPhone WebKit keeps experimental Quality opt-in usable and frozen evidence readable", async ({ page }) => {
  const counters = { presentation: 0 };
  await installQualityDiscoverabilityFixture(page, counters);

  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator("#qualityToggle")).toBeVisible();
  await expect(page.locator("#qualityToggle")).toHaveAttribute("aria-pressed", "false");
  await expectNoHorizontalOverflow(page);
  expect(counters.presentation).toBe(0);

  await page.locator("#qualityToggle").tap();
  await page.waitForURL((url) => url.searchParams.get("quality") === "1");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().state)).toBe("active");
  await expect(page.locator("#qualityToggle")).toHaveAttribute("aria-pressed", "true");
  expect(counters.presentation).toBe(1);
  await expectNoHorizontalOverflow(page);

  await page.evaluate(() => updateDetails(state.byId.get("repository:alpha")));
  await expect(page.locator("#detailsMeta")).toContainText("2026-08-25");
  await expect(page.locator("#detailsMeta")).toContainText("frozen");
  await expect(page.locator("#detailsMeta")).toContainText("not automatically refreshed");

  const panel = await page.locator("#details").evaluate((element) => ({
    overflowY: getComputedStyle(element).overflowY,
    width: element.getBoundingClientRect().width,
    viewportWidth: window.innerWidth,
  }));
  expect(panel.overflowY).toBe("auto");
  expect(panel.width).toBeLessThanOrEqual(panel.viewportWidth);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: ".tmp/playwright-visual/webkit/quality-experimental-frozen-evidence.png", fullPage: true });
});
