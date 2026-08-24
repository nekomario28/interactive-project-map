import { validateRepositoryAssessmentArtifact } from "./repository-assessment-artifact.mjs";
import { isForkQualityBundle, selectForkPortfolioQualityVector } from "./repository-fork-quality.mjs";
import { buildQualityConfidenceVector } from "./repository-quality-confidence.mjs";

const QUALITY_SECTION_STATES = new Set(["observed", "partial"]);
const LEVEL_ORDER = Object.freeze({ L0: 0, L1: 1, L2: 2 });

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function canonicalKey(value, label) {
  if (typeof value !== "string" || !value.includes("/")) throw new Error(`${label} must be owner/repository`);
  return value.toLowerCase();
}

function compatibleArtifacts(repository, artifacts, label) {
  const context = object(repository.context.artifacts, `${repository.identity.repositoryKey}.context.artifacts`);
  if (context.state === "unknown") {
    throw new Error(`${repository.identity.repositoryKey} cannot receive Quality while artifact context is unknown`);
  }
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    throw new Error(`${label} must declare non-empty artifacts`);
  }
  const allowed = new Set(context.values);
  for (const artifact of artifacts) {
    if (!allowed.has(artifact)) {
      throw new Error(`${repository.identity.repositoryKey} Quality artifact ${artifact} is not present in assessment context`);
    }
  }
}

function validateQualityValue(policy, repository, quality) {
  const lineage = repository.context.relation?.lineage;
  if (lineage === "fork") {
    if (!isForkQualityBundle(quality)) {
      throw new Error(`${repository.identity.repositoryKey} fork Quality requires provenance-aware fork bundle`);
    }
    compatibleArtifacts(repository, quality.artifacts, `${repository.identity.repositoryKey}.forkQuality.artifacts`);
    const snapshot = object(quality.snapshotQuality, `${repository.identity.repositoryKey}.forkQuality.snapshotQuality`);
    const snapshotVector = object(snapshot.value, `${repository.identity.repositoryKey}.forkQuality.snapshotQuality.value`);
    compatibleArtifacts(repository, snapshotVector.artifacts, `${repository.identity.repositoryKey}.fork snapshot Quality artifacts`);
    buildQualityConfidenceVector(policy, snapshotVector);

    const selected = selectForkPortfolioQualityVector(quality);
    if (selected.state === "available") {
      compatibleArtifacts(repository, selected.value.artifacts, `${repository.identity.repositoryKey}.fork local-delta Quality artifacts`);
      buildQualityConfidenceVector(policy, selected.value);
    }
    return;
  }

  if (isForkQualityBundle(quality)) {
    throw new Error(`${repository.identity.repositoryKey} non-fork repository cannot receive fork Quality bundle`);
  }
  compatibleArtifacts(repository, quality.artifacts, `${repository.identity.repositoryKey}.Quality artifacts`);
  buildQualityConfidenceVector(policy, quality);
}

function elevatedLevel(current, requested) {
  if (!Object.hasOwn(LEVEL_ORDER, current)) throw new Error(`unsupported current acquisition level: ${current}`);
  if (!Object.hasOwn(LEVEL_ORDER, requested)) throw new Error(`unsupported requested acquisition level: ${requested}`);
  return LEVEL_ORDER[requested] > LEVEL_ORDER[current] ? requested : current;
}

export function enrichAssessmentArtifactQuality(policyValue, artifactValue, enrichmentsValue) {
  const policy = object(policyValue, "policy");
  const artifact = object(artifactValue, "assessment artifact");
  validateRepositoryAssessmentArtifact(artifact);
  if (policy.policyId !== artifact.assessmentPolicyId) {
    throw new Error("assessment artifact policy does not match Quality enrichment policy");
  }
  if (!Array.isArray(enrichmentsValue)) throw new Error("Quality enrichments must be an array");

  const enriched = structuredClone(artifact);
  const repositoryByKey = new Map(enriched.repositories.map((repository) => [repository.identity.repositoryKey, repository]));
  const seen = new Set();
  const diagnostics = {
    requested: enrichmentsValue.length,
    applied: 0,
    observed: 0,
    partial: 0,
    acquisitionElevated: 0,
    repositoriesBefore: enriched.repositories.length,
    repositoriesAfter: null,
  };

  for (let index = 0; index < enrichmentsValue.length; index += 1) {
    const enrichment = object(enrichmentsValue[index], `enrichments[${index}]`);
    const repositoryKey = canonicalKey(enrichment.repositoryKey, `enrichments[${index}].repositoryKey`);
    if (seen.has(repositoryKey)) throw new Error(`duplicate Quality enrichment for ${repositoryKey}`);
    seen.add(repositoryKey);

    const repository = repositoryByKey.get(repositoryKey);
    if (!repository) {
      throw new Error(`Quality enrichment cannot add repository not already present in assessment artifact: ${repositoryKey}`);
    }

    const state = enrichment.state ?? "partial";
    if (!QUALITY_SECTION_STATES.has(state)) throw new Error(`unsupported Quality enrichment state for ${repositoryKey}: ${state}`);
    const quality = object(enrichment.value, `${repositoryKey}.quality`);
    validateQualityValue(policy, repository, quality);

    repository.quality = { state, value: quality };
    const requestedLevel = enrichment.acquisitionLevel ?? "L1";
    const nextLevel = elevatedLevel(repository.acquisition.level, requestedLevel);
    if (nextLevel !== repository.acquisition.level) diagnostics.acquisitionElevated += 1;
    repository.acquisition.level = nextLevel;

    diagnostics.applied += 1;
    diagnostics[state] += 1;
  }

  diagnostics.repositoriesAfter = enriched.repositories.length;
  if (diagnostics.repositoriesAfter !== diagnostics.repositoriesBefore) {
    throw new Error("Quality enrichment must not change assessment repository membership");
  }
  validateRepositoryAssessmentArtifact(enriched);
  return { artifact: enriched, diagnostics };
}
