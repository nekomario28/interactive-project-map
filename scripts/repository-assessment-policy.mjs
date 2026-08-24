import { normalizeRepositoryRelation } from "./repository-relation.mjs";

const REQUIRED_APPLICABILITY = new Set([
  "required",
  "recommended",
  "optional",
  "not-applicable",
  "unknown",
]);

const REQUIRED_AUTHORITIES = new Set([
  "repository-native",
  "project-owned",
  "external",
  "mixed",
  "unknown",
]);

const REQUIRED_EVIDENCE_STATES = new Set([
  "observed",
  "absent",
  "not-collected",
  "stale",
  "conflicting",
  "unknown",
]);

const REQUIRED_RELATION_AXES = {
  ownership: new Set(["owned", "contributed"]),
  collaboration: new Set(["solo", "team", "unknown"]),
  lineage: new Set(["original", "fork", "unknown"]),
};

const REQUIRED_AXES = new Set([
  "quality",
  "impact",
  "scale",
  "maturity",
  "activity",
  "confidence",
  "personalContribution",
  "portfolioProminence",
]);

const REQUIRED_FIXTURES = new Set([
  "frozen-dataset-without-ci",
  "high-quality-zero-star-solo",
  "popular-solo-lower-quality",
  "famous-project-tiny-contribution",
  "large-project-core-maintainer",
  "fork-with-small-local-delta",
  "mixed-research-dataset-model",
]);

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function assertUniqueStrings(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) {
    throw new Error(`${label} must be a non-empty string array`);
  }
  if (new Set(value).size !== value.length) throw new Error(`${label} must not contain duplicates`);
  return value;
}

function unique(values) {
  return [...new Set(values)];
}

export function normalizeImpactCounter(value, transformFamily = "log1p") {
  const count = typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
  if (transformFamily !== "log1p") throw new Error(`unsupported impact transform: ${transformFamily}`);
  return Math.log1p(count);
}

export function resolveArtifactModule(policy, artifact, stack = []) {
  assertObject(policy, "policy");
  const modules = assertObject(policy.artifactModules, "policy.artifactModules");
  const module = assertObject(modules[artifact], `artifact module ${artifact}`);
  if (stack.includes(artifact)) throw new Error(`artifact inheritance cycle: ${[...stack, artifact].join(" -> ")}`);

  const parent = typeof module.inherits === "string"
    ? resolveArtifactModule(policy, module.inherits, [...stack, artifact])
    : { emphasize: [], evidenceTopics: [], claimBoundaries: [] };

  const emphasize = module.emphasize == null ? [] : assertUniqueStrings(module.emphasize, `${artifact}.emphasize`);
  const evidenceTopics = module.evidenceTopics == null ? [] : assertUniqueStrings(module.evidenceTopics, `${artifact}.evidenceTopics`);
  const claimBoundaries = typeof module.claimBoundary === "string" && module.claimBoundary
    ? [module.claimBoundary]
    : [];

  return {
    emphasize: unique([...parent.emphasize, ...emphasize]),
    evidenceTopics: unique([...parent.evidenceTopics, ...evidenceTopics]),
    claimBoundaries: unique([...parent.claimBoundaries, ...claimBoundaries]),
  };
}

export function buildAssessmentRoute(policy, artifacts) {
  assertUniqueStrings(artifacts, "artifacts");
  const routes = artifacts.map((artifact) => resolveArtifactModule(policy, artifact));
  return {
    artifacts: [...artifacts],
    emphasize: unique(routes.flatMap((route) => route.emphasize)),
    evidenceTopics: unique(routes.flatMap((route) => route.evidenceTopics)),
    claimBoundaries: unique(routes.flatMap((route) => route.claimBoundaries)),
  };
}

export function validateRepositoryAssessmentPolicy(policy, standardTaxonomy) {
  assertObject(policy, "policy");
  assertObject(standardTaxonomy, "standardTaxonomy");
  if (policy.schemaVersion !== 1) throw new Error("unsupported repository assessment schemaVersion");
  if (policy.policyId !== "ipm-repository-assessment-v1") throw new Error("unexpected policyId");
  if (policy.taxonomyDependency !== "ipm-standard-v1") throw new Error("unexpected taxonomy dependency");

  const applicability = new Set(assertUniqueStrings(policy.applicabilityStates, "applicabilityStates"));
  for (const state of REQUIRED_APPLICABILITY) {
    if (!applicability.has(state)) throw new Error(`missing applicability state: ${state}`);
  }
  if (applicability.has("external")) throw new Error("external is an assessment authority, not an applicability state");

  const authorities = new Set(assertUniqueStrings(policy.assessmentAuthorities, "assessmentAuthorities"));
  for (const authority of REQUIRED_AUTHORITIES) {
    if (!authorities.has(authority)) throw new Error(`missing assessment authority: ${authority}`);
  }

  const evidenceStates = new Set(assertUniqueStrings(policy.evidenceStates, "evidenceStates"));
  for (const state of REQUIRED_EVIDENCE_STATES) {
    if (!evidenceStates.has(state)) throw new Error(`missing evidence state: ${state}`);
  }

  const lifecycle = new Set(assertUniqueStrings(policy.lifecycleStates, "lifecycleStates"));
  if (!lifecycle.has("frozen") || !lifecycle.has("active") || !lifecycle.has("unknown")) {
    throw new Error("lifecycle states must preserve active/frozen/unknown distinctions");
  }

  const relationAxes = assertObject(policy.repositoryRelationAxes, "repositoryRelationAxes");
  for (const [axis, requiredValues] of Object.entries(REQUIRED_RELATION_AXES)) {
    const values = new Set(assertUniqueStrings(relationAxes[axis], `repositoryRelationAxes.${axis}`));
    for (const value of requiredValues) {
      if (!values.has(value)) throw new Error(`missing repository relation ${axis}: ${value}`);
    }
  }
  if (policy.relationStates != null) throw new Error("compound relationStates are deprecated; use repositoryRelationAxes");
  const relationContract = assertObject(policy.repositoryRelationContract, "repositoryRelationContract");
  if (relationContract.axesAreOrthogonal !== true) throw new Error("repository relation axes must remain orthogonal");
  if (relationContract.l0OwnedCollaborationDefault !== "unknown") throw new Error("L0 must not assume owned repositories are solo");
  if (relationContract.forkIsLineageNotOwnership !== true) throw new Error("fork must remain a lineage axis");

  const axes = assertObject(policy.axes, "axes");
  for (const axis of REQUIRED_AXES) {
    if (!axes[axis]) throw new Error(`missing assessment axis: ${axis}`);
  }

  const qualityDimensions = new Set(assertUniqueStrings(policy.qualityDimensions, "qualityDimensions"));
  for (const required of ["verification", "reproducibility", "integrity", "stewardship"]) {
    if (!qualityDimensions.has(required)) throw new Error(`missing quality dimension: ${required}`);
  }

  const qualityEvidenceContract = assertObject(policy.qualityEvidenceContract, "qualityEvidenceContract");
  if (qualityEvidenceContract.mechanismPresenceIsNotOutcome !== true) throw new Error("quality evidence must assess outcomes rather than mechanism presence");
  if (qualityEvidenceContract.forbidImpactSignalsAsQualityEvidence !== true) throw new Error("impact signals must remain outside Quality evidence");
  if (qualityEvidenceContract.externalAuthorityDoesNotChangeApplicability !== true) throw new Error("external authority must remain orthogonal to applicability");
  for (const key of ["defaultEmphasizedApplicability", "defaultOtherApplicability"]) {
    if (!applicability.has(qualityEvidenceContract[key])) throw new Error(`${key} must name a valid applicability state`);
  }

  const artifactValues = standardTaxonomy?.facets?.artifact?.values;
  assertUniqueStrings(artifactValues, "standard taxonomy artifact values");
  for (const artifact of artifactValues) resolveArtifactModule(policy, artifact);

  const impactSignals = assertObject(policy.impactSignals, "impactSignals");
  for (const signalName of ["stars", "forks"]) {
    const signal = assertObject(impactSignals[signalName], `impact signal ${signalName}`);
    if (signal.axis !== "impact") throw new Error(`${signalName} must route to Impact`);
    if (signal.directQualityEffect !== false) throw new Error(`${signalName} must not directly change Quality`);
    if (signal.defaultTransformFamily !== "log1p") throw new Error(`${signalName} must use bounded nonlinear count normalization by default`);
  }

  const ranking = assertObject(policy.ranking, "ranking");
  if (ranking.qualityAndProminenceAreDistinct !== true) throw new Error("Quality and portfolio prominence must remain distinct");
  if (ranking.weights !== null) throw new Error("v1 must not freeze prominence weights before calibration");
  if (ranking.tierThresholds !== null) throw new Error("v1 must not freeze tier thresholds before calibration");
  if (ranking.globalPercentilesWithoutCorpus !== false) throw new Error("global percentiles require a real corpus");

  const collaboration = assertObject(policy.collaboration, "collaboration");
  if (collaboration.separateProjectAndPersonSide !== true) throw new Error("project-side and person-side assessment must stay separate");

  return true;
}

export function validateRepositoryAssessmentFixtures(fixtures, policy, standardTaxonomy) {
  assertObject(fixtures, "fixtures");
  if (fixtures.schemaVersion !== 1) throw new Error("unsupported fixture schemaVersion");
  const cases = Array.isArray(fixtures.cases) ? fixtures.cases : null;
  if (!cases || cases.length === 0) throw new Error("fixtures.cases must be non-empty");

  const categories = new Set((standardTaxonomy.categories ?? []).map((category) => category.id));
  const lifecycles = new Set(policy.lifecycleStates);
  const ids = new Set();

  for (const testCase of cases) {
    assertObject(testCase, "fixture case");
    if (typeof testCase.id !== "string" || !testCase.id) throw new Error("fixture case id is required");
    if (ids.has(testCase.id)) throw new Error(`duplicate fixture id: ${testCase.id}`);
    ids.add(testCase.id);

    const context = assertObject(testCase.context, `${testCase.id}.context`);
    if (!categories.has(context.category)) throw new Error(`${testCase.id} uses unknown category: ${context.category}`);
    if (!lifecycles.has(context.lifecycle)) throw new Error(`${testCase.id} uses unknown lifecycle: ${context.lifecycle}`);
    normalizeRepositoryRelation(context.relation, `${testCase.id}.context.relation`);
    buildAssessmentRoute(policy, context.artifacts);

    assertObject(testCase.evidence, `${testCase.id}.evidence`);
    assertUniqueStrings(testCase.expectedInvariants, `${testCase.id}.expectedInvariants`);
  }

  for (const fixtureId of REQUIRED_FIXTURES) {
    if (!ids.has(fixtureId)) throw new Error(`missing required contract fixture: ${fixtureId}`);
  }

  assertUniqueStrings(fixtures.crossCaseInvariants, "crossCaseInvariants");
  return true;
}
