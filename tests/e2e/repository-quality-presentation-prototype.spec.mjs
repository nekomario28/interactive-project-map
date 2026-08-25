import { mkdir } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

import { buildLiveQualitySidecarCandidates } from "../../scripts/repository-quality-live-sidecar-candidate.mjs";
import {
  REPOSITORY_QUALITY_PRESENTATION_THEMES,
  renderRepositoryQualityPresentationPrototypeSvg,
} from "../../scripts/repository-quality-presentation-prototype-svg.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const live = readJson("fixtures/repository-assessment-live-profile-minimal-2026-08-25.json");
const generatorRevision = "0b4caf1dcdd2f67fe35f772afce45b8782112209";

function currentModel() {
  return buildLiveQualitySidecarCandidates(live.graph, { generatorRevision }).presentation;
}

async function mountSvg(page, svg, frameWidth, pageBackground) {
  await page.setViewportSize({ width: Math.max(720, frameWidth + 40), height: 1100 });
  await page.setContent(`<body style="margin:0;background:${pageBackground};padding:20px"><div id="frame" style="width:${frameWidth}px">${svg}</div></body>`);
  await page.locator("svg").evaluate((element) => {
    element.style.width = "100%";
    element.style.height = "auto";
    element.style.display = "block";
  });
  await expect(page.locator("svg")).toBeVisible();
}

async function cardLayoutMetrics(page) {
  return page.locator(".quality-card").evaluateAll((cards) => cards.map((card) => {
    const background = card.querySelector(".card-bg").getBoundingClientRect();
    const core = card.querySelector(".repository-core").getBoundingClientRect();
    const label = card.querySelector(".repo-label").getBoundingClientRect();
    const artifact = card.querySelector(".artifact-label").getBoundingClientRect();
    const coverage = card.querySelector(".coverage-label").getBoundingClientRect();
    return {
      labelInside: label.right <= background.right - 5 && label.left >= background.left + 5,
      labelClearsCore: label.left >= core.right + 10,
      artifactInside: artifact.right <= background.right - 5,
      coverageInside: coverage.right <= background.right - 5,
      verticalOrder: label.bottom <= artifact.top + 2 && artifact.bottom <= coverage.top + 4,
    };
  }));
}

async function expectCompleteLayout(page, expectedDimensions) {
  await expect(page.locator(".quality-card")).toHaveCount(15);
  await expect(page.locator('[data-quality-state="available"]')).toHaveCount(5);
  await expect(page.locator('[data-quality-state="unavailable"]')).toHaveCount(10);
  await expect(page.locator(".quality-unavailable-ring")).toHaveCount(10);
  await expect(page.locator("[data-dimension]")).toHaveCount(expectedDimensions);
  await expect(page.locator('[data-repository-key="nekomario28/antifullbright"][data-quality-state="available"]')).toHaveCount(1);
  await expect(page.locator('[data-repository-key="nekomario28/ftbpublicclaims"][data-quality-state="available"]')).toHaveCount(1);

  const metrics = await cardLayoutMetrics(page);
  for (const metric of metrics) {
    expect(metric.labelInside).toBe(true);
    expect(metric.labelClearsCore).toBe(true);
    expect(metric.artifactInside).toBe(true);
    expect(metric.coverageInside).toBe(true);
    expect(metric.verticalOrder).toBe(true);
  }
}

test.beforeAll(async () => {
  await Promise.all([
    mkdir(".tmp/playwright-visual/dark", { recursive: true }),
    mkdir(".tmp/playwright-visual/light", { recursive: true }),
  ]);
});

test("compact Quality presentation remains attribution-safe and non-overlapping at profile scale", async ({ page }) => {
  const theme = REPOSITORY_QUALITY_PRESENTATION_THEMES.dark;
  const svg = renderRepositoryQualityPresentationPrototypeSvg(currentModel(), { view: "compact", columns: 3, theme: "dark" });
  fs.writeFileSync(".tmp/playwright-visual/dark/repository-quality-compact.svg", svg, "utf8");
  await mountSvg(page, svg, 720, theme.page);

  await expect(page.locator('svg[data-theme="dark"]')).toBeVisible();
  await expectCompleteLayout(page, 0);
  await expect(page.locator('[data-pattern="supports-solid"]')).toHaveCount(5);
  await expect(page.locator('[data-pattern="unavailable-sparse-dash"]')).toHaveCount(10);

  await page.locator("#frame").screenshot({ path: ".tmp/playwright-visual/dark/repository-quality-compact.png" });
});

test("detail Quality presentation keeps dimension identity only on attribution-safe overlays", async ({ page }) => {
  const theme = REPOSITORY_QUALITY_PRESENTATION_THEMES.dark;
  const svg = renderRepositoryQualityPresentationPrototypeSvg(currentModel(), { view: "detail", columns: 3, theme: "dark" });
  fs.writeFileSync(".tmp/playwright-visual/dark/repository-quality-detail.svg", svg, "utf8");
  await mountSvg(page, svg, 900, theme.page);

  await expect(page.locator('svg[data-theme="dark"]')).toBeVisible();
  await expectCompleteLayout(page, 40);
  await expect(page.getByText("5 available · 10 unavailable · Structure remains default")).toBeVisible();

  await page.locator("#frame").screenshot({ path: ".tmp/playwright-visual/dark/repository-quality-detail.png" });
});

test("light compact Quality presentation preserves attribution-safe semantics, patterns, and layout", async ({ page }) => {
  const theme = REPOSITORY_QUALITY_PRESENTATION_THEMES.light;
  const svg = renderRepositoryQualityPresentationPrototypeSvg(currentModel(), { view: "compact", columns: 3, theme: "light" });
  fs.writeFileSync(".tmp/playwright-visual/light/repository-quality-compact.svg", svg, "utf8");
  await mountSvg(page, svg, 720, theme.page);

  await expect(page.locator('svg[data-theme="light"]')).toBeVisible();
  await expectCompleteLayout(page, 0);
  await expect(page.locator('[data-pattern="supports-solid"]')).toHaveCount(5);
  await expect(page.locator('[data-pattern="unavailable-sparse-dash"]')).toHaveCount(10);

  await page.locator("#frame").screenshot({ path: ".tmp/playwright-visual/light/repository-quality-compact.png" });
});

test("light detail Quality presentation preserves fixed dimensions and fork-safe unavailable rings", async ({ page }) => {
  const theme = REPOSITORY_QUALITY_PRESENTATION_THEMES.light;
  const svg = renderRepositoryQualityPresentationPrototypeSvg(currentModel(), { view: "detail", columns: 3, theme: "light" });
  fs.writeFileSync(".tmp/playwright-visual/light/repository-quality-detail.svg", svg, "utf8");
  await mountSvg(page, svg, 900, theme.page);

  await expect(page.locator('svg[data-theme="light"]')).toBeVisible();
  await expectCompleteLayout(page, 40);
  await expect(page.getByText("5 available · 10 unavailable · Structure remains default")).toBeVisible();

  await page.locator("#frame").screenshot({ path: ".tmp/playwright-visual/light/repository-quality-detail.png" });
});
