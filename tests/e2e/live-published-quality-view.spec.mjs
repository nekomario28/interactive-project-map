import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const publicViewer = (style) =>
  `https://nekomario28.github.io/interactive-project-map/u/?username=nekomario28&style=${style}&quality=1`;

for (const style of ["galaxy-systems", "obsidian"]) {
  test(`public ${style} consumes the published Quality pair`, async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    let presentationRequests = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/project-map/quality-presentation.json")) presentationRequests += 1;
    });

    await page.goto(publicViewer(style), { waitUntil: "domcontentloaded", timeout: 30_000 });

    await expect.poll(
      () => page.evaluate(() => window.ProjectMapQualityView?.snapshot().state),
      { timeout: 20_000 },
    ).toBe("active");
    await expect.poll(
      () => page.evaluate(() => window.ProjectMapQualityView?.snapshot().lastDrawnRings),
      { timeout: 20_000 },
    ).toBe(4);

    const snapshot = await page.evaluate(() => window.ProjectMapQualityView.snapshot());
    expect(snapshot.available).toBe(4);
    expect(snapshot.unavailable).toBe(11);
    expect(snapshot.semanticSource).toBe("renderer-neutral-presentation");
    expect(snapshot.geometryAuthority).toBe("overlay-only");
    expect(snapshot.productionRankingAllowed).toBe(false);
    expect(presentationRequests).toBe(1);
    expect(pageErrors).toEqual([]);

    await mkdir(".tmp/playwright-visual/dark", { recursive: true });
    await page.locator("#galaxy").screenshot({
      path: `.tmp/playwright-visual/dark/live-published-quality-${style}.png`,
    });
  });
}
