import { expect, test } from "@playwright/test";

const graph = {
  owner: "example",
  generatedAt: "2026-08-25T00:00:00Z",
  repositoryCount: 2,
  groupCount: 1,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:apps", label: "Apps", type: "group", repositoryCount: 2 },
    {
      id: "repository:alpha",
      label: "alpha",
      type: "repository",
      url: "https://github.com/example/alpha",
      description: "Quality evidence fixture",
      language: "JavaScript",
      topics: ["quality"],
      stars: 4,
      forks: 1,
      fork: false,
      archived: false,
      updatedAt: "2026-08-25T00:00:00Z",
      groupId: "apps",
      groupLabel: "Apps",
    },
    {
      id: "repository:beta",
      label: "beta",
      type: "repository",
      url: "https://github.com/example/beta",
      description: "Unassessed fixture",
      language: "Python",
      topics: [],
      stars: 1,
      forks: 0,
      fork: false,
      archived: false,
      updatedAt: "2026-08-25T00:00:00Z",
      groupId: "apps",
      groupLabel: "Apps",
    },
  ],
  edges: [
    { source: "user:example", target: "group:apps", type: "ownership" },
    { source: "group:apps", target: "repository:alpha", type: "membership" },
    { source: "group:apps", target: "repository:beta", type: "membership" },
  ],
};

function evidence(state = "observed") {
  return [{ state, evidenceClass: "C", authority: "repository-native", source: "fixture" }];
}

function dimension(applicability, findingState, state = findingState === "unknown" ? "unknown" : "observed") {
  return {
    applicability,
    evidenceState: state,
    findingState,
    evidence: state === "unknown" ? [] : evidence(state),
  };
}

const qualityVector = {
  schemaVersion: 1,
  artifacts: ["application"],
  dimensions: {
    understandability: dimension("required", "supports"),
    verification: dimension("required", "supports"),
    reproducibility: dimension("recommended", "supports"),
    maintainability: dimension("recommended", "unknown"),
    integrity: dimension("optional", "unknown"),
    interoperability: dimension("recommended", "supports"),
    "security-safety": dimension("optional", "unknown"),
    stewardship: dimension("recommended", "weakens"),
  },
  compositeQualityScore: null,
};

function repositoryAssessment(name, quality) {
  return {
    identity: {
      repositoryKey: `example/${name}`,
      graphNodeId: `repository:${name}`,
      owner: "example",
      name,
      githubRepositoryId: null,
    },
    context: {
      category: { state: "observed", id: "applications-services" },
      artifacts: { state: "observed", values: ["application"] },
      lifecycle: "unknown",
      relation: { ownership: "owned", collaboration: "unknown", lineage: "original" },
    },
    acquisition: { level: quality.state === "partial" ? "L1" : "L0", observedAt: "2026-08-25T00:00:00Z" },
    quality,
    impact: { state: "not-collected", value: null },
    scale: { state: "not-collected", value: null },
    lifecycle: { state: "not-collected", value: null },
    personalContribution: { state: "not-collected", value: null },
    prominence: { state: "not-collected", value: null },
    productionScore: null,
  };
}

const assessment = {
  schemaVersion: 1,
  contractId: "ipm-repository-assessment-artifact-v1",
  owner: "example",
  generatedAt: "2026-08-25T00:00:00Z",
  generatorRevision: "1111111111111111111111111111111111111111",
  taxonomyId: "ipm-standard-v1",
  assessmentPolicyId: "ipm-repository-assessment-v1",
  productionScoring: false,
  prominenceCandidateId: null,
  repositories: [
    repositoryAssessment("alpha", { state: "partial", value: qualityVector }),
    repositoryAssessment("beta", { state: "not-collected", value: null }),
  ],
};

async function installGraph(page) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
}

async function installAssessment(page, value = assessment) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/assessment.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(value) });
  });
}

function browserErrors(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
  return failures;
}

test("default viewer makes no assessment request and keeps Quality disabled", async ({ page }) => {
  await installGraph(page);
  const failures = browserErrors(page);
  let assessmentRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/project-map/assessment.json")) assessmentRequests += 1;
  });

  await page.goto("/u/?username=example&style=galaxy-systems");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().state)).toBe("disabled");
  await page.waitForTimeout(150);

  expect(assessmentRequests).toBe(0);
  expect(await page.evaluate(() => document.body.dataset.qualityMode)).toBe("disabled");
  expect(failures).toEqual([]);
});

test("quality=1 loads sidecar, draws compact evidence ring, and exposes dimension detail without changing node geometry authority", async ({ page }) => {
  await installGraph(page);
  await installAssessment(page);
  const failures = browserErrors(page);

  await page.goto("/u/?username=example&style=galaxy-systems&quality=1");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().state)).toBe("active");
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().lastDrawnRings)).toBe(1);

  const snapshot = await page.evaluate(() => window.ProjectMapQualityView.snapshot());
  expect(snapshot.available).toBe(1);
  expect(snapshot.unavailable).toBe(1);
  expect(snapshot.geometryAuthority).toBe("overlay-only");
  expect(snapshot.productionRankingAllowed).toBe(false);
  expect(await page.evaluate(() => Object.hasOwn(state.byId.get("repository:alpha"), "quality"))).toBe(false);

  await page.evaluate(() => updateDetails(state.byId.get("repository:alpha")));
  await expect(page.locator("#detailsMeta")).toContainText("Quality evidence");
  await expect(page.locator("#detailsMeta")).toContainText("5/6 interpreted");
  await expect(page.locator("#detailsMeta")).toContainText("supports 4");
  await expect(page.locator("#detailsMeta")).toContainText("weakens 1");
  await expect(page.locator("#detailsMeta")).toContainText("unknown 1");
  await expect(page.locator("#detailsMeta")).toContainText("Stewardship: weakens");

  await page.evaluate(() => updateDetails(state.byId.get("repository:beta")));
  await expect(page.locator("#detailsMeta")).toContainText("Quality evidence");
  await expect(page.locator("#detailsMeta")).toContainText("Not collected");
  expect(failures).toEqual([]);
});

test("missing assessment sidecar fails open to Structure without surfacing a graph error", async ({ page }) => {
  await installGraph(page);
  const failures = browserErrors(page);
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/assessment.json", async (route) => {
    await route.fulfill({ status: 404, contentType: "text/plain", body: "not found" });
  });

  await page.goto("/u/?username=example&style=galaxy-systems&quality=1");
  await expect(page.locator("#status")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ProjectMapQualityView?.snapshot().state)).toBe("unavailable");
  expect(await page.evaluate(() => window.ProjectMapQualityView.snapshot().lastDrawnRings)).toBe(0);
  await expect(page.locator("#error")).not.toBeVisible();
  expect(failures).toEqual([]);
});
