import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const BASE_URL = "https://nekomario28.github.io/interactive-project-map/u/?username=nekomario28&style=galaxy-systems";
const RUNTIME_URL = "https://nekomario28.github.io/interactive-project-map/quality-view.js";
const GRAPH_URL = "https://raw.githubusercontent.com/nekomario28/nekomario28/HEAD/project-map/graph.json";
const PRESENTATION_URL = "https://raw.githubusercontent.com/nekomario28/nekomario28/HEAD/project-map/quality-presentation.json";
const EXPECTED_GENERATOR = "24460c1d28c5f90634b7aa0eb2156127971c0927";
const EXPECTED_SNAPSHOT_DATES = ["2026-07-25", "2026-08-04", "2026-08-21", "2026-08-24", "2026-08-25"];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("deployed experimental Quality consumes the current live 16/9/7 sidecars without changing default Structure", async ({ page, request, browserName }) => {
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
  expect(presentation.diagnostics).toMatchObject({
    graphRepositories: 16,
    assessmentRepositories: 16,
    joinedRepositories: 16,
    available: 9,
    unavailable: 7,
    strictJoin: true,
  });
  expect(presentation.invariants.productionRankingAllowed).toBe(false);
  expect(presentation.invariants.forkPortfolioQualityUsesLocalDeltaOnly).toBe(true);
  expect(presentation.evidenceFreshness).toEqual({
    mode: "bounded-frozen-snapshots",
    scope: "portfolio-quality-presented-sources",
    automaticRefresh: false,
    sourceCount: 9,
    snapshotDates: EXPECTED_SNAPSHOT_DATES,
    oldestSnapshotDate: "2026-07-25",
    newestSnapshotDate: "2026-08-25",
  });

  const sable = presentation.repositories.find((entry) => String(entry.repositoryKey).toLowerCase() === "nekomario28/sable");
  expect(sable).toMatchObject({
    qualityAttributionScope: "local-delta",
    overlayState: "available",
    evidenceFreshness: {
      state: "frozen-snapshot",
      snapshotDate: "2026-08-21",
      automaticRefresh: false,
    },
  });
  expect(sable.overlay.targetFindingCounts).toMatchObject({ supports: 5, unknown: 1 });
  expect(sable.overlay.segments.find((segment) => segment.id === "maintainability").findingState).toBe("unknown");
  expect(sable.overlay.segments.find((segment) => segment.id === "security-safety")).toMatchObject({ applicability: "optional", findingState: "supports" });

  const gz = presentation.repositories.find((entry) => String(entry.repositoryKey).toLowerCase() === "nekomario28/gz-sim");
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

  await page.goto(`${BASE_URL}&q=sable`, { waitUntil: "domcontentloaded", timeout: 45_000 });
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
  expect(new URL(page.url()).searchParams.get("q")).toBe("sable");
  await expect(page.locator("#qualityToggle")).toHaveText("Quality On (experimental)");
  await expect(page.locator("#qualityToggle")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().state), { timeout: 45_000 }).toBe("active");
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().lastDrawnRings), { timeout: 45_000 }).toBe(9);
  expect(runtimeRequests).toBe(1);
  expect(presentationRequests).toBe(1);

  const observed = await page.evaluate(() => ({
    snapshot: window.ProjectMapQualityView.snapshot(),
    graphGeneratedAt: state.graph.generatedAt,
    repositoryCount: [...state.byId.values()].filter((node) => node.type === "repository").length,
    qualityInjectedIntoGraph: [...state.byId.values()].some((node) => Object.hasOwn(node, "quality")),
  }));
  expect(observed.graphGeneratedAt).toBe(graph.generatedAt);
  expect(observed.repositoryCount).toBe(16);
  expect(observed.snapshot.available).toBe(9);
  expect(observed.snapshot.unavailable).toBe(7);
  expect(observed.snapshot.productionRankingAllowed).toBe(false);
  expect(observed.qualityInjectedIntoGraph).toBe(false);

  await page.evaluate(() => updateDetails(state.byId.get("repository:sable")));
  await expect(page.locator("#detailsMeta")).toContainText("Quality evidence snapshot");
  await expect(page.locator("#detailsMeta")).toContainText("2026-08-21");
  await expect(page.locator("#detailsMeta")).toContainText("frozen");
  await expect(page.locator("#detailsMeta")).toContainText("not automatically refreshed");

  const evidenceDir = ".tmp/playwright-visual/public-discoverability-current";
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: `${evidenceDir}/quality-current-${browserName}.png`, fullPage: true });
  await writeFile(
    `${evidenceDir}/quality-current-${browserName}.json`,
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
      sable,
      observed,
      defaultRequests: { runtime: 0, presentation: 0 },
      activeRequests: { runtime: runtimeRequests, presentation: presentationRequests },
    }, null, 2)}\n`,
    "utf8",
  );
});
