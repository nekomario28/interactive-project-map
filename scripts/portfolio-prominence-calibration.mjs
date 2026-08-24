import {
  normalizeRepositoryRelation,
  relationAttributionProfile,
} from "./repository-relation.mjs";

const COMPONENTS = ["quality", "impact", "scale", "maturity"];
const ATTRIBUTION_PROFILES = ["direct", "team", "fork", "contributed"];
const ALLOWED_INPUT_KEYS = new Set(["id", "relation", "components"]);
const ALLOWED_COMPONENT_KEYS = new Set([...COMPONENTS, "personalContribution", "confidence"]);

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function unit(value, label, nullable = false) {
  if (value == null && nullable) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be in [0, 1]${nullable ? " or null" : ""}`);
  }
  return value;
}

function rejectUnknownKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label}.${key} is not a calibrated prominence input`);
  }
}

export function validateProminenceCandidate(candidate) {
  object(candidate, "candidate");
  const weights = object(candidate.projectWeights, "projectWeights");
  if (Object.keys(weights).sort().join(",") !== [...COMPONENTS].sort().join(",")) {
    throw new Error("projectWeights has unexpected components");
  }
  const sum = COMPONENTS.reduce((total, key) => total + unit(weights[key], `projectWeights.${key}`), 0);
  if (Math.abs(sum - 1) > 1e-9) throw new Error("projectWeights must sum to 1");

  const profiles = object(candidate.attributionProfiles, "attributionProfiles");
  if (Object.keys(profiles).sort().join(",") !== [...ATTRIBUTION_PROFILES].sort().join(",")) {
    throw new Error("attributionProfiles has unexpected profiles");
  }
  for (const profile of ATTRIBUTION_PROFILES) {
    const rule = object(profiles[profile], `attributionProfiles.${profile}`);
    if (rule.mode !== "direct" && rule.mode !== "contribution-gated") throw new Error(`${profile} mode is unsupported`);
    const base = unit(rule.base, `${profile}.base`);
    const slope = unit(rule.personalContributionSlope, `${profile}.personalContributionSlope`);
    if (base + slope > 1 + 1e-9) throw new Error(`${profile} attribution can exceed 1`);
    if (profile === "direct" && (rule.mode !== "direct" || base !== 1 || slope !== 0)) {
      throw new Error("direct attribution profile must stay direct");
    }
    if (profile !== "direct" && rule.mode !== "contribution-gated") {
      throw new Error(`${profile} must stay contribution-gated`);
    }
  }
  return true;
}

export function scoreProminenceCandidate(candidate, input) {
  validateProminenceCandidate(candidate);
  object(input, "input");
  rejectUnknownKeys(input, ALLOWED_INPUT_KEYS, "input");
  const relation = normalizeRepositoryRelation(input.relation, "input.relation");
  const components = object(input.components, "components");
  rejectUnknownKeys(components, ALLOWED_COMPONENT_KEYS, "components");
  const values = Object.fromEntries(COMPONENTS.map((key) => [key, unit(components[key], key)]));
  const personalContribution = unit(components.personalContribution, "personalContribution", true);
  const confidence = unit(components.confidence, "confidence", true);
  const projectProminence = COMPONENTS.reduce(
    (total, key) => total + values[key] * candidate.projectWeights[key],
    0,
  );

  const profile = relationAttributionProfile(relation);
  let attributionFactor = null;
  let personalPortfolioProminence = null;
  let attributionState = profile;

  if (profile === "unresolved") {
    attributionState = "unresolved-relation";
  } else {
    const rule = candidate.attributionProfiles[profile];
    if (rule.mode === "direct") {
      attributionFactor = 1;
      personalPortfolioProminence = projectProminence;
      attributionState = "direct";
    } else if (personalContribution == null) {
      attributionState = "unknown-personal-contribution";
    } else {
      attributionFactor = rule.base + rule.personalContributionSlope * personalContribution;
      personalPortfolioProminence = projectProminence * attributionFactor;
      attributionState = "contribution-gated";
    }
  }

  return {
    schemaVersion: 1,
    relation,
    components: { ...values, personalContribution, confidence },
    projectProminence,
    personalPortfolioProminence,
    attribution: {
      state: attributionState,
      profile,
      factor: attributionFactor,
    },
    confidencePolicy: { weightedIntoMerit: false, value: confidence },
    tier: null,
  };
}

export function evaluateProminenceCandidates(candidateSet, cases) {
  object(candidateSet, "candidateSet");
  if (!Array.isArray(cases) || cases.length === 0) throw new Error("cases must be non-empty");
  return Object.fromEntries(Object.entries(candidateSet).map(([id, candidate]) => [
    id,
    Object.fromEntries(cases.map((entry) => [entry.id, scoreProminenceCandidate(candidate, entry)])),
  ]));
}
