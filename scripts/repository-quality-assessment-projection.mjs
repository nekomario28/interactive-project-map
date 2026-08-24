import { validateRepositoryAssessmentArtifact } from "./repository-assessment-artifact.mjs";
import { isForkQualityBundle, selectForkPortfolioQualityVector } from "./repository-fork-quality.mjs";
import { buildQualityConfidenceVector } from "./repository-quality-confidence.mjs";
import { buildQualityOverlayModel } from "./repository-quality-overlay.mjs";

const AVAILABLE_QUALITY_STATES = new Set(["observed", "partial"]);

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function ensureQualityContextMatches(repository, qualityVector) {
  const artifacts = object(repository.context.artifacts, "repository.context.artifacts");
  if (artifacts.state === "unknown") {
    throw new Error(`${repository.identity.repositoryKey} cannot expose Quality overlay while artifact context is unknown`);
  }
  if (!Array.isArray(qualityVector.artifacts) || qualityVector.artifacts.length === 0) {
    throw new Error(`${repository.identity.repositoryKey} Quality vector must declare non-empty artifacts`);
  }
  const contextArtifacts = new Set(artifacts.values);
  for (const artifact of qualityVector.artifacts) {
    if (!contextArtifacts.has(artifact)) {
      throw new Error(`${repository.identity.repositoryKey} Quality vector artifact ${artifact} is not present in assessment context`);
    }
  }
}

function unavailableRepositoryProjection(repository, reason = repository.quality.state, qualityAttributionScope = null) {
  return {
    repositoryKey: repository.identity.repositoryKey,
    graphNodeId: repository.identity.graphNodeId,
    qualitySectionState: repository.quality.state,
    qualityAttributionScope,
    overlayState: "unavailable",
    unavailableReason: reason,
    overlay: null,
  };
}

function overlayProjection(policy, repository, qualityVector, qualityAttributionScope) {
  ensureQualityContextMatches(repository, qualityVector);
  const confidenceVector = buildQualityConfidenceVector(policy, qualityVector);
  const overlay = buildQualityOverlayModel(policy, qualityVector, confidenceVector);
  return {
    repositoryKey: repository.identity.repositoryKey,
    graphNodeId: repository.identity.graphNodeId,
    qualitySectionState: repository.quality.state,
    qualityAttributionScope,
    overlayState: "available",
    unavailableReason: null,
    overlay,
  };
}

function availableRepositoryProjection(policy, repository) {
  const qualityValue = object(repository.quality.value, `${repository.identity.repositoryKey}.quality.value`);
  if (repository.context.relation?.lineage === "fork") {
    if (!isForkQualityBundle(qualityValue)) {
      return unavailableRepositoryProjection(repository, "fork-quality-requires-provenance-bundle", "local-delta");
    }
    const selected = selectForkPortfolioQualityVector(qualityValue);
    if (selected.state !== "available") {
      return unavailableRepositoryProjection(repository, selected.reason, "local-delta");
    }
    return overlayProjection(policy, repository, selected.value, "local-delta");
  }

  if (isForkQualityBundle(qualityValue)) {
    throw new Error(`${repository.identity.repositoryKey} non-fork repository cannot expose fork Quality bundle`);
  }
  return overlayProjection(policy, repository, qualityValue, "repository-snapshot");
}

export function buildRepositoryQualityOverlayProjection(policyValue, artifactValue) {
  const policy = object(policyValue, "policy");
  const artifact = object(artifactValue, "assessment artifact");
  validateRepositoryAssessmentArtifact(artifact);
  if (policy.policyId !== artifact.assessmentPolicyId) {
    throw new Error("assessment artifact policy does not match Quality overlay policy");
  }

  const repositories = artifact.repositories.map((repository) => {
    if (!AVAILABLE_QUALITY_STATES.has(repository.quality.state)) {
      return unavailableRepositoryProjection(repository);
    }
    return availableRepositoryProjection(policy, repository);
  });

  return {
    schemaVersion: 1,
    projectionId: "ipm-repository-quality-overlay-projection-v1",
    source: {
      contractId: artifact.contractId,
      owner: artifact.owner,
      generatedAt: artifact.generatedAt,
      generatorRevision: artifact.generatorRevision,
      assessmentPolicyId: artifact.assessmentPolicyId,
    },
    repositories,
    invariants: {
      assessmentArtifactRemainsAuthority: true,
      uncollectedQualityDoesNotBecomeUnknownRing: true,
      confidenceDerivedFromQualityVector: true,
      fullAndCompactShareOneSemanticSource: true,
      forkPortfolioQualityUsesLocalDeltaOnly: true,
      forkSnapshotQualityDoesNotBecomePersonalQualityRing: true,
      productionRankingAllowed: false,
    },
  };
}
