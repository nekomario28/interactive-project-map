import {
  normalizeRepositoryRelation,
  relationAttributionProfile,
  relationRequiresLocalDelta,
} from "./repository-relation.mjs";

const FORBIDDEN_PERSON_KEYS = new Set([
  "mergedPullRequests",
  "commitsByPerson",
  "reviewsByPerson",
  "maintainerRoleByPerson",
  "personalContribution",
]);

function optionalCount(value, label) {
  if (value == null) return { state: "unknown", raw: null, transformed: null };
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number when observed`);
  }
  const raw = Math.floor(value);
  return { state: "observed", raw, transformed: Math.log1p(raw) };
}

function optionalText(value, label) {
  if (value == null || value === "") return { state: "unknown", value: null };
  if (typeof value !== "string") throw new Error(`${label} must be string when observed`);
  return { state: "observed", value: value.slice(0, 400) };
}

function buildSide(input, prefix = "") {
  return {
    technicalBreadth: {
      subsystems: optionalCount(input.subsystems, `${prefix}subsystems`),
      supportedPlatforms: optionalCount(input.supportedPlatforms, `${prefix}supportedPlatforms`),
      integrations: optionalCount(input.integrations, `${prefix}integrations`),
      operationalSurfaces: optionalCount(input.operationalSurfaces, `${prefix}operationalSurfaces`),
    },
    organizationalBreadth: {
      contributors: optionalCount(input.contributors, `${prefix}contributors`),
      maintainers: optionalCount(input.maintainers, `${prefix}maintainers`),
    },
    scopeEvidence: optionalText(input.scopeEvidence, `${prefix}scopeEvidence`),
  };
}

function collectSignals(side) {
  const signals = [];
  const { technicalBreadth: technical, organizationalBreadth: organization } = side;
  if (technical.subsystems.state === "observed" && technical.subsystems.raw > 1) signals.push("multi-subsystem");
  if (technical.supportedPlatforms.state === "observed" && technical.supportedPlatforms.raw > 1) signals.push("multi-platform");
  if (technical.integrations.state === "observed" && technical.integrations.raw > 1) signals.push("multi-integration");
  if (technical.operationalSurfaces.state === "observed" && technical.operationalSurfaces.raw > 1) signals.push("multi-operational-surface");
  if (organization.contributors.state === "observed" && organization.contributors.raw > 1) signals.push("multi-contributor");
  if (organization.maintainers.state === "observed" && organization.maintainers.raw > 1) signals.push("multi-maintainer");
  if (side.scopeEvidence.state === "observed") signals.push("scope-evidence");
  return signals;
}

export function buildRepositoryScaleEvidence(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("scale input must be an object");
  const relation = normalizeRepositoryRelation(input.relation, "scale input.relation");
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_PERSON_KEYS.has(key)) throw new Error(`${key} is person-side evidence and must not enter project Scale extraction`);
  }

  const projectSide = buildSide(input);
  const isFork = relationRequiresLocalDelta(relation);
  if (!isFork && input.parent != null) throw new Error("parent scale context is only valid when relation.lineage is fork");

  let upstreamContext = null;
  if (isFork) {
    if (input.parent == null) {
      upstreamContext = { state: "unknown", contextOnly: true, eligibleForLocalScale: false };
    } else {
      if (!input.parent || typeof input.parent !== "object" || Array.isArray(input.parent)) throw new Error("parent must be an object when observed");
      const upstream = buildSide(input.parent, "parent.");
      upstreamContext = {
        state: "observed",
        contextOnly: true,
        eligibleForLocalScale: false,
        ...upstream,
        signals: collectSignals(upstream),
      };
    }
  }

  return {
    schemaVersion: 1,
    relation,
    projectSide: {
      ...projectSide,
      signals: collectSignals(projectSide),
      locUsedAsScale: false,
      commitCountUsedAsScale: false,
      workflowCountUsedAsScale: false,
    },
    upstreamContext,
    attribution: {
      profile: relationAttributionProfile(relation),
      upstreamScaleIsContextOnly: isFork,
      personalContributionInferred: false,
      collaborationState: relation.collaboration,
      lineageState: relation.lineage,
    },
    compositeScale: null,
    portfolioProminenceEffect: null,
  };
}
