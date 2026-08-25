export const graph = {
  owner: "example",
  generatedAt: "2026-08-25T00:00:00Z",
  repositoryCount: 1,
  groupCount: 1,
  nodes: [
    { id: "user:example", label: "example", type: "owner", url: "https://github.com/example" },
    { id: "group:apps", label: "Apps", type: "group", repositoryCount: 1 },
    {
      id: "repository:alpha",
      label: "alpha",
      type: "repository",
      url: "https://github.com/example/alpha",
      description: "Quality discoverability fixture",
      language: "JavaScript",
      topics: ["quality", "evidence"],
      stars: 4,
      forks: 1,
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
  ],
};

const findingOrder = ["supports", "neutral", "weakens", "mixed", "unknown"];
const counts = { supports: 2, neutral: 0, weakens: 1, mixed: 0, unknown: 3 };
const detailSegments = [
  ["understandability", true, "supports"],
  ["verification", true, "unknown"],
  ["reproducibility", true, "supports"],
  ["maintainability", true, "unknown"],
  ["integrity", false, "unknown"],
  ["interoperability", false, "unknown"],
  ["security-safety", true, "unknown"],
  ["stewardship", true, "weakens"],
].map(([id, target, findingState], slot) => ({ id, slot, target, findingState, token: `quality-${findingState}` }));

export const presentation = {
  schemaVersion: 1,
  presentationId: "ipm-repository-quality-presentation-v1",
  status: "experimental-non-default",
  source: {
    graphOwner: "example",
    graphGeneratedAt: graph.generatedAt,
    assessment: { contractId: "ipm-repository-assessment-artifact-v1" },
  },
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
  repositories: [
    {
      graphNodeId: "repository:alpha",
      repositoryKey: "example/alpha",
      label: "alpha",
      qualitySectionState: "partial",
      overlayState: "available",
      unavailableReason: null,
      evidenceFreshness: {
        state: "frozen-snapshot",
        snapshotDate: "2026-08-25",
        automaticRefresh: false,
      },
      views: {
        detail: {
          mode: "full-fixed-dimension-ring",
          segments: detailSegments,
          coverage: { targetDimensions: 6, directionalDimensions: 3, label: "3/6 interpreted" },
          attentionState: "weakening-evidence",
          compositeQualityScore: null,
          dimensionIdentityPreserved: true,
        },
        compact: {
          mode: "target-finding-distribution",
          denominator: 6,
          findingOrder,
          segments: findingOrder.map((findingState) => ({
            findingState,
            count: counts[findingState],
            ratio: counts[findingState] / 6,
            token: `quality-${findingState}`,
          })),
          dimensionIdentityPreserved: false,
          requiresDetailForDimensionIdentity: true,
          coverage: { targetDimensions: 6, directionalDimensions: 3, label: "3/6 interpreted" },
          attentionState: "weakening-evidence",
          compositeQualityScore: null,
        },
      },
      visualPolicy: {
        repositoryCore: "inherit-structure-renderer",
        placementEffect: "none",
        nodeSizeEffect: "none",
        labelPriorityEffect: "none",
        impactHaloEffect: "none",
      },
    },
  ],
  diagnostics: {
    graphRepositories: 1,
    assessmentRepositories: 1,
    joinedRepositories: 1,
    available: 1,
    unavailable: 0,
    missingAssessmentGraphNodeIds: [],
    orphanAssessmentGraphNodeIds: [],
    strictJoin: true,
  },
  invariants: {
    assessmentArtifactRemainsAuthority: true,
    rendererDoesNotInferQuality: true,
    unavailableQualityDoesNotBecomeUnknownRing: true,
    compactAndDetailShareOneOverlaySource: true,
    productionRankingAllowed: false,
  },
  evidenceFreshness: {
    mode: "bounded-frozen-snapshots",
    scope: "portfolio-quality-presented-sources",
    automaticRefresh: false,
    sourceCount: 1,
    snapshotDates: ["2026-08-25"],
    oldestSnapshotDate: "2026-08-25",
    newestSnapshotDate: "2026-08-25",
  },
};

export async function installQualityDiscoverabilityFixture(page, counters = null) {
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/graph.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(graph) });
  });
  await page.route("https://raw.githubusercontent.com/example/example/HEAD/project-map/quality-presentation.json", async (route) => {
    if (counters) counters.presentation += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(presentation) });
  });
}
