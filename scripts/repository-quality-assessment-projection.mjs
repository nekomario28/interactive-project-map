import { validateRepositoryAssessmentArtifact } from "./repository-assessment-artifact.mjs";
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

function unavailableRepositoryProjection(repository) {
  return {
    repositoryKey: repository.identity.repositoryKey,
    graphNodeId: repository.identity.graphNodeId,
    qualitySectionState: repository.quality.state,
    overlayState: "unavailable",
    unavailableReason: repository.quality.state,
    overlay: null,
  };
}

function availableRepositoryProjection(policy, repository) {
  const qualityVector = object(repository.quality.value, `${repository.identity.repositoryKey}.quality.value`);
  ensureQualityContextMatches(repository, qualityVector);
  const confidenceVector = buildQualityConfidenceVector(policy, qualityVector);
  const overlay = buildQualityOverlayModel(policy, qualityVector, confidenceVector);
  return {
    repositoryKey: repository.identity.repositoryKey,
    graphNodeId: repository.identity.graphNodeId,
    qualitySectionState: repository.quality.state,
    overlayState: "available",
    unavailableReason: null,
    overlay,
  };
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
      productionRankingAllowed: false,
    },
  };
}
