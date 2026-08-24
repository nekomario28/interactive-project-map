import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-25T00:00:00Z",
  repositoryCount: 2,
  groupCount: 1,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:apps", label: "Apps", type: "group", repositoryCount: 2 },
    { id: "repository:alpha", label: "alpha", type: "repository", url: "https://github.com/example/alpha", description: "Quality fixture", language: "JavaScript", topics: [], stars: 4, forks: 1, fork: false, archived: false, updatedAt: "2026-08-25T00:00:00Z", groupId: "apps", groupLabel: "Apps" },
    { id: "repository:beta", label: "beta", type: "repository", url: "https://github.com/example/beta", description: "Unassessed fixture", language: "Python", topics: [], stars: 1, forks: 0, fork: false, archived: false, updatedAt: "2026-08-25T00:00:00Z", groupId: "apps", groupLabel: "Apps" },
  ],
  edges: [
    { source: "user:example", target: "group:apps", type: "ownership" },
    { source: "group:apps", target: "repository:alpha", type: "membership" },
    { source: "group:apps", target: "repository:beta", type: "membership" },
  ],
};

const findings = ["supports", "neutral", "weakens", "mixed", "unknown"];
const detailSegments = [
  ["understandability", true, "supports"],
  ["verification", true, "supports"],
  ["reproducibility", true, "supports"],
  ["maintainability", true, "unknown"],
  ["integrity", false, "unknown"],
  ["interoperability", true, "supports"],
  ["security-safety", false, "unknown"],
  ["stewardship", true, "weakens"],
].map(([id, target, findingState], slot) => ({ id, slot, target, findingState, token: `quality-${findingState}` }));

const compactCounts = { supports: 4, neutral: 0, weakens: 1, mixed: 0, unknown: 1 };
const availableEntry = {
  graphNodeId: "repository:alpha",
  repositoryKey: "example/alpha",
  label: "alpha",
  qualitySectionState: "partial",
  overlayState: "available",
  unavailableReason: null,
  views: {
    detail: {
      mode: "full-fixed-dimension-ring",
      segments: detailSegments,
      coverage: { targetDimensions: 6, directionalDimensions: 5, label: "5/6 interpreted" },
      attentionState: "weakening-evidence",
      compositeQualityScore: null,
      dimensionIdentityPreserved: true,
    },
    compact: {
      mode: "target-finding-distribution",
      denominator: 6,
      findingOrder: findings,
      segments: findings.map((findingState) => ({ findingState, count: compactCounts[findingState], ratio: compactCounts[findingState] / 6, token: `quality-${findingState}` })),
      dimensionIdentityPreserved: false,
      requiresDetailForDimensionIdentity: true,
      coverage: { targetDimensions: 6, directionalDimensions: 5, label: "5/6 interpreted" },
      attentionState: "weakening-evidence",
      compositeQualityScore: null,
    },
  },
  visualPolicy: { repositoryCore: "inherit-structure-renderer", placementEffect: "none", nodeSizeEffect: "none", labelPriorityEffect: "none", impactHaloEffect: "none" },
};

const unavailableView = { mode: "unavailable", token: "quality-unavailable", reason: "not-collected", compositeQualityScore: null, dimensionIdentityPreserved: false };
const unavailableEntry = {
  graphNodeId: "repository:beta",
  repositoryKey: "example/beta",
  label: "beta",
  qualitySectionState: "not-collected",
  overlayState: "unavailable",
  unavailableReason: "not-collected",
  views: { detail: unavailableView, compact: unavailableView },
  visualPolicy: { repositoryCore: "inherit-structure-renderer", placementEffect: "none", nodeSizeEffect: "none", labelPriorityEffect: "none", impactHaloEffect: "none" },
};

const presentation = {
  schemaVersion: 1,
  presentationId: "ipm-repository-quality-presentation-v1",
  status: "experimental-non-default",
  source: { graphOwner: "example", graphGeneratedAt: graph.generatedAt, assessment: { contractId: "ipm-repository-assessment-artifact-v1" } },
  modePolicy: {
    defaultProductModeRemains: "structure",
    qualityMode: "experimental-non-default",
    compactContextUses: "target-finding-distribution",
    detailContextUses: "fixed-dimension-identity",
    unavailableUses: "quality-unavailable",
    nodeSizeSource: "existing-structure-renderer",
    qualityChangesNodeSize: false,
    qualityChangesPlacement: false,
    qualityChangesLabelPriority: false,
    qualityChangesImpactHalo: false,
  },
  repositories: [availableEntry, unavailableEntry],
  diagnostics: { graphRepositories: 2, assessmentRepositories: 2, joinedRepositories: 2, available: 1, unavailable: 1, missingAssessmentGraphNodeIds: [], orphanAssessmentGraphNodeIds: [], strictJoin: true },
  invariants: { assessmentArtifactRemainsAuthority: true, rendererDoesNotInferQuality: true, unavailableQualityDoesNotBecomeUnknownRing: true, compactAndDetailShareOneOverlaySource: true, productionRankingAllowed: false },
};

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function installPresentation(page, value = presentation) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/quality-presentation.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(value) });
  });
}

function browserErrors(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
  return failures;
}

function pageErrors(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  return failures;
}

test("default Structure URL makes zero Quality-specific network requests", async ({ page }) => {
  await installGraph(page);
  const failures = browserErrors(page);
  let presentationRequests = 0;
  let runtimeRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/project-map/quality-presentation.json")) presentationRequests += 1;
    if (request.url().endsWith("/quality-view.js")) runtimeRequests += 1;
  });

  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().state)).toBe("disabled");
  await page.waitForTimeout(120);
  expect(presentationRequests).toBe(0);
  expect(runtimeRequests).toBe(0);
  expect(await page.evaluate(() => document.body.dataset.qualityMode)).toBe("disabled");
  expect(failures).toEqual([]);
});

test("quality=1 consumes renderer-neutral presentation without mutating Structure geometry authority", async ({ page }) => {
  await installGraph(page);
  await installPresentation(page);
  const failures = browserErrors(page);
  let presentationRequests = 0;
  let runtimeRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/project-map/quality-presentation.json")) presentationRequests += 1;
    if (request.url().endsWith("/quality-view.js")) runtimeRequests += 1;
  });

  await page.goto("/u/?username=example&style=galaxy-systems&quality=1");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().state)).toBe("active");
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().lastDrawnRings)).toBe(1);

  const snapshot = await page.evaluate(() => window.ProjectMapQualityView.snapshot());
  expect(presentationRequests).toBe(1);
  expect(runtimeRequests).toBe(1);
  expect(snapshot.available).toBe(1);
  expect(snapshot.unavailable).toBe(1);
  expect(snapshot.semanticSource).toBe("renderer-neutral-presentation");
  expect(snapshot.geometryAuthority).toBe("overlay-only");
  expect(snapshot.productionRankingAllowed).toBe(false);
  expect(await page.evaluate(() => Object.hasOwn(state.byId.get("repository:alpha"), "quality"))).toBe(false);

  await mkdir(".tmp/playwright-visual/dark", { recursive: true });
  await page.locator("#galaxy").screenshot({ path: ".tmp/playwright-visual/dark/query-gated-quality-view.png" });

  await page.evaluate(() => updateDetails(state.byId.get("repository:alpha")));
  await expect(page.locator("#detailsMeta")).toContainText("5/6 interpreted");
  await expect(page.locator("#detailsMeta")).toContainText("supports 4");
  await expect(page.locator("#detailsMeta")).toContainText("weakens 1");
  await expect(page.locator("#detailsMeta")).toContainText("stewardship: weakens");

  await page.evaluate(() => updateDetails(state.byId.get("repository:beta")));
  await expect(page.locator("#detailsMeta")).toContainText("Not collected");
  expect(failures).toEqual([]);
});

test("missing Quality presentation fails open to Structure without page exceptions", async ({ page }) => {
  await installGraph(page);
  const failures = pageErrors(page);
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/quality-presentation.json", async (route) => {
    await route.fulfill({ status: 404, contentType: "text/plain", body: "not found" });
  });

  await page.goto("/u/?username=example&style=galaxy-systems&quality=1");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().state)).toBe("unavailable");
  expect(await page.evaluate(() => window.ProjectMapQualityView.snapshot().lastDrawnRings)).toBe(0);
  await expect(page.locator("#error")).not.toBeVisible();
  expect(failures).toEqual([]);
});

test("stale Quality presentation fails open when graphGeneratedAt does not match", async ({ page }) => {
  await installGraph(page);
  const stale = structuredClone(presentation);
  stale.source.graphGeneratedAt = "2026-08-24T00:00:00Z";
  await installPresentation(page, stale);
  const failures = browserErrors(page);

  await page.goto("/u/?username=example&style=galaxy-systems&quality=1");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().state)).toBe("unavailable");
  const snapshot = await page.evaluate(() => window.ProjectMapQualityView.snapshot());
  expect(snapshot.lastDrawnRings).toBe(0);
  expect(snapshot.error).toContain("graphGeneratedAt");
  await expect(page.locator("#error")).not.toBeVisible();
  expect(failures).toEqual([]);
});

test("compact distribution with inconsistent ratio fails open", async ({ page }) => {
  await installGraph(page);
  const inconsistent = structuredClone(presentation);
  inconsistent.repositories[0].views.compact.segments[0].ratio = 0.5;
  await installPresentation(page, inconsistent);
  const failures = browserErrors(page);

  await page.goto("/u/?username=example&style=galaxy-systems&quality=1");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().state)).toBe("unavailable");
  const snapshot = await page.evaluate(() => window.ProjectMapQualityView.snapshot());
  expect(snapshot.lastDrawnRings).toBe(0);
  expect(snapshot.error).toContain("ratio");
  await expect(page.locator("#error")).not.toBeVisible();
  expect(failures).toEqual([]);
});

test("presentation that claims node-size authority is rejected fail-open", async ({ page }) => {
  await installGraph(page);
  const unsafe = structuredClone(presentation);
  unsafe.modePolicy.qualityChangesNodeSize = true;
  await installPresentation(page, unsafe);

  await page.goto("/u/?username=example&style=galaxy-systems&quality=1");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().state)).toBe("unavailable");
  await expect(page.locator("#error")).not.toBeVisible();
});
