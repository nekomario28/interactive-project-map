import { expect, test } from "@playwright/test";
import { installQualityDiscoverabilityFixture } from "./quality-discoverability-fixture.mjs";

test("experimental Quality control preserves zero-request Structure default and discloses frozen evidence", async ({ page }) => {
  const counters = { presentation: 0, runtime: 0 };
  await installQualityDiscoverabilityFixture(page, counters);
  page.on("request", (request) => {
    if (request.url().endsWith("/quality-view.js")) counters.runtime += 1;
  });

  await page.goto("/u/?username=example&style=galaxy-systems&q=alpha&motion=off");
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator("#qualityToggle")).toBeVisible();
  await expect(page.locator("#qualityToggle")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#qualityToggle")).toHaveText("Quality (experimental)");
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().state)).toBe("disabled");
  expect(counters.presentation).toBe(0);
  expect(counters.runtime).toBe(0);

  await page.locator("#qualityToggle").click();
  await page.waitForURL((url) => url.searchParams.get("quality") === "1");
  expect(new URL(page.url()).searchParams.get("q")).toBe("alpha");
  expect(new URL(page.url()).searchParams.get("motion")).toBe("off");
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator("#qualityToggle")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#qualityToggle")).toHaveText("Quality On (experimental)");
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().state)).toBe("active");
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().lastDrawnRings)).toBe(1);
  expect(counters.presentation).toBe(1);
  expect(counters.runtime).toBe(1);

  await page.evaluate(() => updateDetails(state.byId.get("repository:alpha")));
  await expect(page.locator("#detailsMeta")).toContainText("Quality evidence snapshot");
  await expect(page.locator("#detailsMeta")).toContainText("2026-08-25");
  await expect(page.locator("#detailsMeta")).toContainText("frozen");
  await expect(page.locator("#detailsMeta")).toContainText("not automatically refreshed");

  await page.locator("#qualityToggle").click();
  await page.waitForURL((url) => !url.searchParams.has("quality"));
  await expect(page.locator("#qualityToggle")).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().state)).toBe("disabled");
  expect(counters.presentation).toBe(1);
  expect(counters.runtime).toBe(1);
});
