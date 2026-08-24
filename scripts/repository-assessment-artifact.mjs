import {
  normalizeRepositoryRelation,
  relationAttributionProfile,
  relationIsDirectOwnedSoloOriginal,
  relationRequiresPersonalContribution,
} from "./repository-relation.mjs";

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
const REVISION_RE = /^[0-9a-f]{40}$/i;
const LIFECYCLES = new Set(["active", "maintenance", "stable", "frozen", "snapshot", "archived", "experimental", "unknown"]);
const ACQUISITION_LEVELS = new Set(["L0", "L1", "L2"]);
const SECTION_STATES = new Set(["observed", "partial", "not-collected", "not-applicable", "unknown"]);
const SECTION_NAMES = ["quality", "impact", "scale", "lifecycle", "personalContribution", "prominence"];
const MAX_REPOSITORIES = 400;

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function iso(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error(`${label} must be an ISO timestamp`);
  return value;
}

function nullableProviderId(value, label) {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive safe integer or null`);
  return value;
}

function unitOrNull(value, label) {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be in [0, 1] or null`);
  return value;
}

function section(value, label) {
  const candidate = object(value, label);
  if (!SECTION_STATES.has(candidate.state)) throw new Error(`${label}.state is unsupported`);
  const hasValue = candidate.value != null;
  if ((candidate.state === "observed" || candidate.state === "partial") && !hasValue) {
    throw new Error(`${label}.value is required for ${candidate.state}`);
  }
  if (candidate.state !== "observed" && candidate.state !== "partial" && hasValue) {
    throw new Error(`${label}.value must be null for ${candidate.state}`);
  }
  if (hasValue) object(candidate.value, `${label}.value`);
  return candidate;
}

export function canonicalRepositoryKey(owner, name) {
  if (!OWNER_RE.test(owner)) throw new Error("repository owner is invalid");
  if (!REPO_RE.test(name)) throw new Error("repository name is invalid");
  return `${owner}/${name}`.toLowerCase();
}

export function expectedGraphNodeId(rootOwner, repositoryOwner, repositoryName, relationValue) {
  if (!OWNER_RE.test(rootOwner)) throw new Error("root owner is invalid");
  const relation = normalizeRepositoryRelation(relationValue, "relation");
  const key = canonicalRepositoryKey(repositoryOwner, repositoryName);
  if (relation.ownership === "contributed") {
    if (repositoryOwner.toLowerCase() === rootOwner.toLowerCase()) throw new Error("contributed repository must be externally owned");
    return `repository:${key}`;
  }
  if (repositoryOwner.toLowerCase() !== rootOwner.toLowerCase()) throw new Error("owned repository must be owned by artifact owner");
  return `repository:${repositoryName}`;
}

export function makeAssessmentRepositorySkeleton(rootOwner, input) {
  object(input, "repository input");
  const relation = normalizeRepositoryRelation(input.relation, "repository input.relation");
  if (!LIFECYCLES.has(input.lifecycle)) throw new Error(`unsupported lifecycle: ${String(input.lifecycle)}`);
  if (!Array.isArray(input.artifacts) || input.artifacts.length === 0 || input.artifacts.some((item) => typeof item !== "string" || !item)) {
    throw new Error("artifacts must be a non-empty string array");
  }
  if (typeof input.categoryId !== "string" || !input.categoryId) throw new Error("categoryId is required");
  const repositoryKey = canonicalRepositoryKey(input.owner, input.name);
  const graphNodeId = expectedGraphNodeId(rootOwner, input.owner, input.name, relation);
  const observedAt = iso(input.observedAt, "observedAt");
  const direct = relationIsDirectOwnedSoloOriginal(relation);
  return {
    identity: {
      repositoryKey,
      graphNodeId,
      owner: input.owner,
      name: input.name,
      githubRepositoryId: nullableProviderId(input.githubRepositoryId, "githubRepositoryId"),
    },
    context: {
      categoryId: input.categoryId,
      artifacts: [...new Set(input.artifacts)],
      lifecycle: input.lifecycle,
      relation,
    },
    acquisition: {
      level: "L0",
      observedAt,
    },
    quality: { state: "not-collected", value: null },
    impact: { state: "not-collected", value: null },
    scale: { state: "not-collected", value: null },
    lifecycle: { state: "not-collected", value: null },
    personalContribution: direct
      ? { state: "not-applicable", value: null }
      : { state: "not-collected", value: null },
    prominence: { state: "not-collected", value: null },
    productionScore: null,
  };
}

export function validateAssessmentRepository(rootOwner, value, label = "repository") {
  const repository = object(value, label);
  const identity = object(repository.identity, `${label}.identity`);
  const context = object(repository.context, `${label}.context`);
  const acquisition = object(repository.acquisition, `${label}.acquisition`);
  const relation = normalizeRepositoryRelation(context.relation, `${label}.context.relation`);

  if (!LIFECYCLES.has(context.lifecycle)) throw new Error(`${label}.context.lifecycle is unsupported`);
  if (typeof context.categoryId !== "string" || !context.categoryId) throw new Error(`${label}.context.categoryId is required`);
  if (!Array.isArray(context.artifacts) || context.artifacts.length === 0 || context.artifacts.some((item) => typeof item !== "string" || !item)) {
    throw new Error(`${label}.context.artifacts must be non-empty`);
  }

  const key = canonicalRepositoryKey(identity.owner, identity.name);
  if (identity.repositoryKey !== key) throw new Error(`${label}.identity.repositoryKey must be canonical`);
  const graphNodeId = expectedGraphNodeId(rootOwner, identity.owner, identity.name, relation);
  if (identity.graphNodeId !== graphNodeId) throw new Error(`${label}.identity.graphNodeId does not match current graph contract`);
  nullableProviderId(identity.githubRepositoryId, `${label}.identity.githubRepositoryId`);

  if (!ACQUISITION_LEVELS.has(acquisition.level)) throw new Error(`${label}.acquisition.level is unsupported`);
  iso(acquisition.observedAt, `${label}.acquisition.observedAt`);

  const sections = Object.fromEntries(SECTION_NAMES.map((name) => [name, section(repository[name], `${label}.${name}`)]));
  if (repository.productionScore !== null) throw new Error(`${label}.productionScore must remain null in experimental v1`);

  const profile = relationAttributionProfile(relation);
  if (profile === "direct" && sections.personalContribution.state !== "not-applicable") {
    throw new Error(`${label}.personalContribution must be not-applicable for direct owned-solo-original work`);
  }
  if (profile !== "direct" && sections.personalContribution.state === "not-applicable") {
    throw new Error(`${label}.personalContribution cannot be not-applicable while attribution is gated or unresolved`);
  }

  if (sections.prominence.value != null) {
    const prominence = sections.prominence.value;
    if (typeof prominence.candidateId !== "string" || !prominence.candidateId) throw new Error(`${label}.prominence.value.candidateId is required`);
    unitOrNull(prominence.projectProminence, `${label}.prominence.value.projectProminence`);
    const personal = unitOrNull(prominence.personalPortfolioProminence, `${label}.prominence.value.personalPortfolioProminence`);
    if (profile === "unresolved" && personal !== null) {
      throw new Error(`${label} cannot fabricate personal prominence while repository relation attribution is unresolved`);
    }
    if (relationRequiresPersonalContribution(relation) && sections.personalContribution.state !== "observed" && personal !== null) {
      throw new Error(`${label} cannot fabricate personal prominence without observed Personal Contribution`);
    }
  }

  return true;
}

export function validateRepositoryAssessmentArtifact(value) {
  const artifact = object(value, "artifact");
  if (artifact.schemaVersion !== 1) throw new Error("unsupported assessment artifact schemaVersion");
  if (artifact.contractId !== "ipm-repository-assessment-artifact-v1") throw new Error("unexpected assessment artifact contractId");
  if (!OWNER_RE.test(artifact.owner)) throw new Error("artifact.owner is invalid");
  iso(artifact.generatedAt, "artifact.generatedAt");
  if (typeof artifact.generatorRevision !== "string" || !REVISION_RE.test(artifact.generatorRevision)) throw new Error("artifact.generatorRevision must be a 40-hex revision");
  if (artifact.taxonomyId !== "ipm-standard-v1") throw new Error("artifact.taxonomyId is unsupported");
  if (artifact.assessmentPolicyId !== "ipm-repository-assessment-v1") throw new Error("artifact.assessmentPolicyId is unsupported");
  if (artifact.productionScoring !== false) throw new Error("productionScoring must remain false in v1 experimental artifact");
  if (artifact.prominenceCandidateId != null && (typeof artifact.prominenceCandidateId !== "string" || !artifact.prominenceCandidateId)) {
    throw new Error("prominenceCandidateId must be string or null");
  }
  if (!Array.isArray(artifact.repositories) || artifact.repositories.length > MAX_REPOSITORIES) throw new Error("artifact.repositories is invalid or too large");

  const keys = new Set();
  for (let index = 0; index < artifact.repositories.length; index += 1) {
    const repository = artifact.repositories[index];
    validateAssessmentRepository(artifact.owner, repository, `artifact.repositories[${index}]`);
    const key = repository.identity.repositoryKey;
    if (keys.has(key)) throw new Error(`duplicate repositoryKey: ${key}`);
    keys.add(key);
  }
  return true;
}

export function buildRepositoryAssessmentArtifact(input) {
  object(input, "input");
  const artifact = {
    schemaVersion: 1,
    contractId: "ipm-repository-assessment-artifact-v1",
    owner: input.owner,
    generatedAt: input.generatedAt,
    generatorRevision: input.generatorRevision,
    taxonomyId: "ipm-standard-v1",
    assessmentPolicyId: "ipm-repository-assessment-v1",
    productionScoring: false,
    prominenceCandidateId: input.prominenceCandidateId ?? null,
    repositories: input.repositories,
  };
  validateRepositoryAssessmentArtifact(artifact);
  return artifact;
}
