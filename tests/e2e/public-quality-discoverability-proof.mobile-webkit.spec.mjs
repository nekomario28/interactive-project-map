import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const BASE_URL = "https://nekomario28.github.io/interactive-project-map/u/?username=nekomario28&style=galaxy-systems";
const PRESENTATION_URL = "https://raw.githubusercontent.com/nekomario28/nekomario28/HEAD/project-map/quality-presentation.json";
const EXPECTED_GENERATOR = "a05e1cc31a0a82b42af16e6e2c13c584577792be";

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("deployed iPhone WebKit exposes the same experimental Quality control and frozen evidence disclosure", async ({ page, request, browserName }) => {
  test.setTimeout(90_000);
  const response = await request.get(PRESENTATION_URL);
  expect(response.ok()).toBe(true);
  const presentation = await response.json();
  expect(presentation.source.assessment.generatorRevision).toBe(EXPECTED_GENERATOR);
  expect(presentation.diagnostics).toMatchObject({ joinedRepositories: 15, available: 3, unavailable: 12, strictJoin: true });
  expect(presentation.evidenceFreshness).toMatchObject({
    mode: "bounded-frozen-snapshots",
    automaticRefresh: false,
    sourceCount: 3,
    newestSnapshotDate: "2026-08-25",
  });

  let presentationRequests = 0;
  let runtimeRequests = 0;
  page.on("request", (requestEvent) => {
    if (requestEvent.url().endsWith("/project-map/quality-presentation.json")) presentationRequests += 1;
    if (requestEvent.url().endsWith("/quality-view.js")) runtimeRequests += 1;
  });

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expect(page.locator("#status")).toBeHidden({ timeout: 45_000 });
  await expect(page.locator("#qualityToggle")).toBeVisible();
  await expect(page.locator("#qualityToggle")).toHaveAttribute("aria-pressed", "false");
  await expectNoHorizontalOverflow(page);
  expect(presentationRequests).toBe(0);
  expect(runtimeRequests).toBe(0);

  await page.locator("#qualityToggle").tap();
  await page.waitForURL((url) => url.searchParams.get("quality") === "1", { timeout: 45_000 });
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().state), { timeout: 45_000 }).toBe("active");
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().lastDrawnRings), { timeout: 45_000 }).toBe(3);
  expect(presentationRequests).toBe(1);
  expect(runtimeRequests).toBe(1);
  await expectNoHorizontalOverflow(page);

  await page.evaluate(() => updateDetails(state.byId.get("repository:interactive-project-map")));
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

  const evidenceDir = ".tmp/playwright-visual/public-discoverability";
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: `${evidenceDir}/quality-discoverability-${browserName}.png`, fullPage: true });
  await writeFile(
    `${evidenceDir}/quality-discoverability-${browserName}.json`,
    `${JSON.stringify({
      browserName,
      diagnostics: presentation.diagnostics,
      evidenceFreshness: presentation.evidenceFreshness,
      requests: { presentation: presentationRequests, runtime: runtimeRequests },
      panel,
    }, null, 2)}\n`,
    "utf8",
  );
});
