const RELATIONS = new Set(["owned-solo", "owned-team", "owned-fork", "contributed"]);
const COMPONENTS = ["quality", "impact", "scale", "maturity"];
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

  const attribution = object(candidate.relationAttribution, "relationAttribution");
  for (const relation of RELATIONS) {
    const rule = object(attribution[relation], `relationAttribution.${relation}`);
    if (rule.mode !== "direct" && rule.mode !== "contribution-gated") throw new Error(`${relation} mode is unsupported`);
    const base = unit(rule.base, `${relation}.base`);
    const slope = unit(rule.personalContributionSlope, `${relation}.personalContributionSlope`);
    if (base + slope > 1 + 1e-9) throw new Error(`${relation} attribution can exceed 1`);
    if (relation === "owned-solo" && (rule.mode !== "direct" || base !== 1 || slope !== 0)) {
      throw new Error("owned-solo attribution must stay direct");
    }
    if (relation !== "owned-solo" && rule.mode !== "contribution-gated") {
      throw new Error(`${relation} must stay contribution-gated`);
    }
  }
  return true;
}

export function scoreProminenceCandidate(candidate, input) {
  validateProminenceCandidate(candidate);
  object(input, "input");
  rejectUnknownKeys(input, ALLOWED_INPUT_KEYS, "input");
  if (!RELATIONS.has(input.relation)) throw new Error(`unsupported relation: ${String(input.relation)}`);
  const components = object(input.components, "components");
  rejectUnknownKeys(components, ALLOWED_COMPONENT_KEYS, "components");
  const values = Object.fromEntries(COMPONENTS.map((key) => [key, unit(components[key], key)]));
  const personalContribution = unit(components.personalContribution, "personalContribution", true);
  const confidence = unit(components.confidence, "confidence", true);
  const projectProminence = COMPONENTS.reduce(
    (total, key) => total + values[key] * candidate.projectWeights[key],
    0,
  );

  const rule = candidate.relationAttribution[input.relation];
  let attributionFactor = 1;
  let personalPortfolioProminence = projectProminence;
  let attributionState = "direct";
  if (rule.mode === "contribution-gated") {
    if (personalContribution == null) {
      attributionFactor = null;
      personalPortfolioProminence = null;
      attributionState = "unknown-personal-contribution";
    } else {
      attributionFactor = rule.base + rule.personalContributionSlope * personalContribution;
      personalPortfolioProminence = projectProminence * attributionFactor;
      attributionState = "contribution-gated";
    }
  }

  return {
    schemaVersion: 1,
    relation: input.relation,
    components: { ...values, personalContribution, confidence },
    projectProminence,
    personalPortfolioProminence,
    attribution: { state: attributionState, factor: attributionFactor },
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
