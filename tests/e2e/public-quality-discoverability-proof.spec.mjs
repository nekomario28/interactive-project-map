import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const BASE_URL = "https://nekomario28.github.io/interactive-project-map/u/?username=nekomario28&style=galaxy-systems";
const RUNTIME_URL = "https://nekomario28.github.io/interactive-project-map/quality-view.js";
const GRAPH_URL = "https://raw.githubusercontent.com/nekomario28/nekomario28/HEAD/project-map/graph.json";
const PRESENTATION_URL = "https://raw.githubusercontent.com/nekomario28/nekomario28/HEAD/project-map/quality-presentation.json";
const EXPECTED_GENERATOR = "a05e1cc31a0a82b42af16e6e2c13c584577792be";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("deployed experimental Quality control preserves zero-cost Structure and consumes live frozen sidecars", async ({ page, request, browserName }) => {
  test.setTimeout(90_000);

  const [runtimeResponse, graphResponse, presentationResponse] = await Promise.all([
    request.get(RUNTIME_URL),
    request.get(GRAPH_URL),
    request.get(PRESENTATION_URL),
  ]);
  expect(runtimeResponse.ok()).toBe(true);
  expect(graphResponse.ok()).toBe(true);
  expect(presentationResponse.ok()).toBe(true);

  const [deployedRuntime, graphText, presentationText, localRuntime] = await Promise.all([
    runtimeResponse.text(),
    graphResponse.text(),
    presentationResponse.text(),
    readFile("scripts/public-quality-view.js", "utf8"),
  ]);
  expect(deployedRuntime).toBe(localRuntime);

  const graph = JSON.parse(graphText);
  const presentation = JSON.parse(presentationText);
  expect(presentation.source.graphGeneratedAt).toBe(graph.generatedAt);
  expect(presentation.source.assessment.generatorRevision).toBe(EXPECTED_GENERATOR);
  expect(presentation.diagnostics).toMatchObject({ joinedRepositories: 15, available: 3, unavailable: 12, strictJoin: true });
  expect(presentation.invariants.productionRankingAllowed).toBe(false);
  expect(presentation.invariants.forkPortfolioQualityUsesLocalDeltaOnly).toBe(true);
  expect(presentation.evidenceFreshness).toEqual({
    mode: "bounded-frozen-snapshots",
    scope: "portfolio-quality-presented-sources",
    automaticRefresh: false,
    sourceCount: 3,
    snapshotDates: ["2026-08-25"],
    oldestSnapshotDate: "2026-08-25",
    newestSnapshotDate: "2026-08-25",
  });
  const gz = presentation.repositories.find((entry) => entry.repositoryKey === "nekomario28/gz-sim");
  expect(gz).toMatchObject({
    qualityAttributionScope: "local-delta",
    overlayState: "unavailable",
    unavailableReason: "no-local-delta-observed-in-comparison-scope",
  });

  let runtimeRequests = 0;
  let presentationRequests = 0;
  page.on("request", (requestEvent) => {
    if (requestEvent.url().endsWith("/quality-view.js")) runtimeRequests += 1;
    if (requestEvent.url().endsWith("/project-map/quality-presentation.json")) presentationRequests += 1;
  });

  await page.goto(`${BASE_URL}&q=interactive`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expect(page.locator("#status")).toBeHidden({ timeout: 45_000 });
  await expect(page.locator("#qualityToggle")).toBeVisible();
  await expect(page.locator("#qualityToggle")).toHaveText("Quality (experimental)");
  await expect(page.locator("#qualityToggle")).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().state)).toBe("disabled");
  await page.waitForTimeout(150);
  expect(runtimeRequests).toBe(0);
  expect(presentationRequests).toBe(0);

  await page.locator("#qualityToggle").click();
  await page.waitForURL((url) => url.searchParams.get("quality") === "1", { timeout: 45_000 });
  expect(new URL(page.url()).searchParams.get("q")).toBe("interactive");
  await expect(page.locator("#qualityToggle")).toHaveText("Quality On (experimental)");
  await expect(page.locator("#qualityToggle")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().state), { timeout: 45_000 }).toBe("active");
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().lastDrawnRings), { timeout: 45_000 }).toBe(3);
  expect(runtimeRequests).toBe(1);
  expect(presentationRequests).toBe(1);

  const observed = await page.evaluate(() => ({
    snapshot: window.ProjectMapQualityView.snapshot(),
    graphGeneratedAt: state.graph.generatedAt,
    repositoryCount: [...state.byId.values()].filter((node) => node.type === "repository").length,
    qualityInjectedIntoGraph: [...state.byId.values()].some((node) => Object.hasOwn(node, "quality")),
  }));
  expect(observed.graphGeneratedAt).toBe(graph.generatedAt);
  expect(observed.repositoryCount).toBe(15);
  expect(observed.snapshot.available).toBe(3);
  expect(observed.snapshot.unavailable).toBe(12);
  expect(observed.snapshot.productionRankingAllowed).toBe(false);
  expect(observed.qualityInjectedIntoGraph).toBe(false);

  await page.evaluate(() => updateDetails(state.byId.get("repository:interactive-project-map")));
  await expect(page.locator("#detailsMeta")).toContainText("Quality evidence snapshot");
  await expect(page.locator("#detailsMeta")).toContainText("2026-08-25");
  await expect(page.locator("#detailsMeta")).toContainText("frozen");
  await expect(page.locator("#detailsMeta")).toContainText("not automatically refreshed");

  const evidenceDir = ".tmp/playwright-visual/public-discoverability";
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: `${evidenceDir}/quality-discoverability-${browserName}.png`, fullPage: true });
  await writeFile(
    `${evidenceDir}/quality-discoverability-${browserName}.json`,
    `${JSON.stringify({
      browserName,
      baseUrl: BASE_URL,
      deployedRuntimeSha256: sha256(deployedRuntime),
      localRuntimeSha256: sha256(localRuntime),
      graphSha256: sha256(graphText),
      presentationSha256: sha256(presentationText),
      graphGeneratedAt: graph.generatedAt,
      generatorRevision: presentation.source.assessment.generatorRevision,
      diagnostics: presentation.diagnostics,
      evidenceFreshness: presentation.evidenceFreshness,
      observed,
      defaultRequests: { runtime: 0, presentation: 0 },
      activeRequests: { runtime: runtimeRequests, presentation: presentationRequests },
    }, null, 2)}\n`,
    "utf8",
  );
});
