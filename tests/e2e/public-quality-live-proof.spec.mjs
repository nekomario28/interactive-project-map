import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const LIVE_URL = "https://nekomario28.github.io/interactive-project-map/u/?username=nekomario28&style=galaxy-systems&quality=1";
const RUNTIME_URL = "https://nekomario28.github.io/interactive-project-map/quality-view.js";
const GRAPH_URL = "https://raw.githubusercontent.com/nekomario28/nekomario28/HEAD/project-map/graph.json";
const PRESENTATION_URL = "https://raw.githubusercontent.com/nekomario28/nekomario28/HEAD/project-map/quality-presentation.json";
const EXPECTED_RUNTIME_SOURCE = "d6b4b36b531b005795bb3b24ee3383b741bd8a56";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("deployed query-gated viewer consumes the actual published Quality sidecar pair", async ({ page, request, browserName }) => {
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
  expect(presentation.presentationId).toBe("ipm-repository-quality-presentation-v1");
  expect(presentation.status).toBe("experimental-non-default");
  expect(presentation.source.graphGeneratedAt).toBe(graph.generatedAt);
  expect(presentation.source.assessment.generatorRevision).toBe(EXPECTED_RUNTIME_SOURCE);
  expect(presentation.diagnostics.joinedRepositories).toBe(15);
  expect(presentation.diagnostics.available).toBe(4);
  expect(presentation.diagnostics.unavailable).toBe(11);
  expect(presentation.diagnostics.strictJoin).toBe(true);
  expect(presentation.invariants.assessmentArtifactRemainsAuthority).toBe(true);
  expect(presentation.invariants.rendererDoesNotInferQuality).toBe(true);
  expect(presentation.invariants.productionRankingAllowed).toBe(false);

  await page.goto(LIVE_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expect(page.locator("#status")).toBeHidden({ timeout: 45_000 });
  await expect.poll(
    () => page.evaluate(() => window.ProjectMapQualityView?.snapshot().state),
    { timeout: 45_000 },
  ).toBe("active");
  await expect.poll(
    () => page.evaluate(() => window.ProjectMapQualityView?.snapshot().lastDrawnRings),
    { timeout: 45_000 },
  ).toBe(4);

  const observed = await page.evaluate(() => ({
    snapshot: window.ProjectMapQualityView.snapshot(),
    graphGeneratedAt: state.graph.generatedAt,
    repositoryCount: [...state.byId.values()].filter((node) => node.type === "repository").length,
    qualityInjectedIntoGraph: [...state.byId.values()].some((node) => Object.hasOwn(node, "quality")),
  }));
  expect(observed.graphGeneratedAt).toBe(graph.generatedAt);
  expect(observed.repositoryCount).toBe(15);
  expect(observed.snapshot.available).toBe(4);
  expect(observed.snapshot.unavailable).toBe(11);
  expect(observed.snapshot.semanticSource).toBe("renderer-neutral-presentation");
  expect(observed.snapshot.geometryAuthority).toBe("overlay-only");
  expect(observed.snapshot.productionRankingAllowed).toBe(false);
  expect(observed.qualityInjectedIntoGraph).toBe(false);

  await page.evaluate(() => updateDetails(state.byId.get("repository:interactive-project-map")));
  await expect(page.locator("#detailsMeta")).toContainText("interpreted");
  await expect(page.locator("#detailsMeta")).toContainText("supports 4");

  const evidenceDir = ".tmp/playwright-visual/public-live";
  await mkdir(evidenceDir, { recursive: true });
  await page.locator("#galaxy").screenshot({
    path: `${evidenceDir}/query-gated-quality-view-${browserName}.png`,
  });
  await writeFile(
    `${evidenceDir}/query-gated-quality-view-${browserName}.json`,
    `${JSON.stringify({
      liveUrl: LIVE_URL,
      runtimeUrl: RUNTIME_URL,
      expectedRuntimeSource: EXPECTED_RUNTIME_SOURCE,
      browserName,
      deployedRuntimeSha256: sha256(deployedRuntime),
      localRuntimeSha256: sha256(localRuntime),
      graphSha256: sha256(graphText),
      presentationSha256: sha256(presentationText),
      graphGeneratedAt: graph.generatedAt,
      presentationGraphGeneratedAt: presentation.source.graphGeneratedAt,
      presentationGeneratorRevision: presentation.source.assessment.generatorRevision,
      diagnostics: presentation.diagnostics,
      invariants: presentation.invariants,
      observed,
    }, null, 2)}\n`,
    "utf8",
  );
});
