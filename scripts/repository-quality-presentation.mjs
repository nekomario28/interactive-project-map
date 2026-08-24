import { buildRepositoryQualityOverlayProjection } from "./repository-quality-assessment-projection.mjs";

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function uniqueIndex(values, keyOf, label) {
  const index = new Map();
  for (const value of values) {
    const key = keyOf(value);
    if (typeof key !== "string" || !key) throw new Error(`${label} contains an invalid key`);
    if (index.has(key)) throw new Error(`${label} contains duplicate key: ${key}`);
    index.set(key, value);
  }
  return index;
}

function unavailableView(reason) {
  return {
    mode: "unavailable",
    token: "quality-unavailable",
    reason,
    compositeQualityScore: null,
    dimensionIdentityPreserved: false,
  };
}

function detailView(overlay) {
  return {
    mode: "full-fixed-dimension-ring",
    segments: overlay.segments,
    coverage: overlay.coverage,
    attentionState: overlay.attentionState,
    compositeQualityScore: null,
    dimensionIdentityPreserved: true,
  };
}

function compactView(overlay) {
  return {
    ...overlay.compactDistribution,
    coverage: overlay.coverage,
    attentionState: overlay.attentionState,
    compositeQualityScore: null,
  };
}

export function selectRepositoryQualityPresentation(entryValue, view) {
  const entry = object(entryValue, "presentation entry");
  if (entry.overlayState !== "available") return unavailableView(entry.unavailableReason ?? "not-collected");
  if (view === "detail") return detailView(entry.overlay);
  if (view === "compact") return compactView(entry.overlay);
  throw new Error(`unsupported Quality presentation view: ${String(view)}`);
}

export function buildRepositoryQualityPresentationModel(policyValue, graphValue, artifactValue, options = {}) {
  const policy = object(policyValue, "policy");
  const graph = object(graphValue, "graph");
  const artifact = object(artifactValue, "assessment artifact");
  if (typeof graph.owner !== "string" || !graph.owner) throw new Error("graph.owner is required");
  if (!Array.isArray(graph.nodes)) throw new Error("graph.nodes must be an array");
  if (typeof artifact.owner !== "string" || graph.owner.toLowerCase() !== artifact.owner.toLowerCase()) {
    throw new Error("graph owner does not match assessment artifact owner");
  }

  const repositoryNodes = graph.nodes.filter((node) => node && typeof node === "object" && node.type === "repository");
  const graphById = uniqueIndex(repositoryNodes, (node) => node.id, "graph repositories");
  const projection = buildRepositoryQualityOverlayProjection(policy, artifact);
  const projectionById = uniqueIndex(projection.repositories, (entry) => entry.graphNodeId, "assessment projection repositories");
  const artifactById = uniqueIndex(artifact.repositories, (entry) => entry.identity.graphNodeId, "assessment repositories");

  const missingAssessmentGraphNodeIds = [...graphById.keys()].filter((id) => !projectionById.has(id));
  const orphanAssessmentGraphNodeIds = [...projectionById.keys()].filter((id) => !graphById.has(id));
  const strictJoin = options.strictJoin !== false;
  if (strictJoin && (missingAssessmentGraphNodeIds.length || orphanAssessmentGraphNodeIds.length)) {
    throw new Error(`Quality presentation join mismatch: missing=${missingAssessmentGraphNodeIds.length} orphan=${orphanAssessmentGraphNodeIds.length}`);
  }

  const repositories = repositoryNodes.flatMap((node) => {
    const projected = projectionById.get(node.id);
    const assessed = artifactById.get(node.id);
    if (!projected || !assessed) return [];
    const available = projected.overlayState === "available";
    return [{
      graphNodeId: node.id,
      repositoryKey: projected.repositoryKey,
      label: node.label,
      graphRelation: node.relation ?? null,
      context: {
        category: assessed.context.category,
        artifacts: assessed.context.artifacts,
        lifecycle: assessed.context.lifecycle,
        relation: assessed.context.relation,
      },
      qualitySectionState: projected.qualitySectionState,
      qualityAttributionScope: projected.qualityAttributionScope,
      overlayState: projected.overlayState,
      unavailableReason: projected.unavailableReason,
      overlay: projected.overlay,
      views: {
        detail: available ? detailView(projected.overlay) : unavailableView(projected.unavailableReason),
        compact: available ? compactView(projected.overlay) : unavailableView(projected.unavailableReason),
      },
      visualPolicy: {
        repositoryCore: "inherit-structure-renderer",
        placementEffect: "none",
        nodeSizeEffect: "none",
        labelPriorityEffect: "none",
        impactHaloEffect: "none",
      },
    }];
  });

  const available = repositories.filter((entry) => entry.overlayState === "available").length;
  const unavailable = repositories.length - available;

  return {
    schemaVersion: 1,
    presentationId: "ipm-repository-quality-presentation-v1",
    status: "experimental-non-default",
    source: {
      graphOwner: graph.owner,
      graphGeneratedAt: graph.generatedAt ?? null,
      assessment: projection.source,
    },
    modePolicy: {
      defaultProductModeRemains: "structure",
      qualityMode: "experimental-non-default",
      compactContextUses: "target-finding-distribution",
      detailContextUses: "fixed-dimension-identity",
      forkPortfolioQualityUses: "local-delta-only",
      unavailableUses: "quality-unavailable",
      nodeSizeSource: "existing-structure-renderer",
      qualityChangesNodeSize: false,
      qualityChangesPlacement: false,
      qualityChangesLabelPriority: false,
      qualityChangesImpactHalo: false,
    },
    repositories,
    diagnostics: {
      graphRepositories: repositoryNodes.length,
      assessmentRepositories: projection.repositories.length,
      joinedRepositories: repositories.length,
      available,
      unavailable,
      missingAssessmentGraphNodeIds,
      orphanAssessmentGraphNodeIds,
      strictJoin,
    },
    invariants: {
      assessmentArtifactRemainsAuthority: true,
      rendererDoesNotInferQuality: true,
      unavailableQualityDoesNotBecomeUnknownRing: true,
      compactAndDetailShareOneOverlaySource: true,
      forkPortfolioQualityUsesLocalDeltaOnly: true,
      forkSnapshotQualityDoesNotBecomePersonalQualityRing: true,
      productionRankingAllowed: false,
    },
  };
}
