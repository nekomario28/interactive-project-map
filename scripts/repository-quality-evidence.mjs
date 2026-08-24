import { buildAssessmentRoute } from "./repository-assessment-policy.mjs";

const FORBIDDEN_IMPACT_KEYS = new Set(["stars", "forks", "downloads", "dependents", "citations", "projectStars", "upstreamStars"]);

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function assertAllowed(value, allowed, label) {
  if (!allowed.has(value)) throw new Error(`${label} has unsupported value: ${value}`);
  return value;
}

function summarizeAuthority(entries) {
  const values = new Set(entries.map((entry) => entry.authority).filter((value) => value !== "unknown"));
  if (values.size === 0) return "unknown";
  if (values.size === 1) return [...values][0];
  return "mixed";
}

function summarizeEvidenceState(entries) {
  const states = new Set(entries.map((entry) => entry.state));
  if (states.has("conflicting")) return "conflicting";
  if (states.has("observed")) return "observed";
  if (states.has("stale")) return "stale";
  if (states.has("absent")) return "absent";
  if (states.has("not-collected")) return "not-collected";
  return "unknown";
}

function summarizeFinding(entries) {
  const findingCounts = {
    supports: 0,
    weakens: 0,
    neutral: 0,
    unknown: 0,
  };
  for (const entry of entries) findingCounts[entry.finding] += 1;

  const directional = ["supports", "weakens", "neutral"].filter((direction) => findingCounts[direction] > 0);
  let findingState = "unknown";
  if (directional.length === 1) findingState = directional[0];
  else if (directional.length > 1) findingState = "mixed";

  return { findingState, findingCounts };
}

function normalizeEvidenceEntry(entry, policy, label) {
  assertObject(entry, label);
  const authorities = new Set(policy.assessmentAuthorities);
  const states = new Set(policy.evidenceStates);
  const directions = new Set(policy.qualityFindingDirections);
  const classes = new Set(Object.keys(policy.evidenceClasses));
  const authority = assertAllowed(entry.authority ?? "unknown", authorities, `${label}.authority`);
  const state = assertAllowed(entry.state ?? "unknown", states, `${label}.state`);
  const finding = assertAllowed(entry.finding ?? "unknown", directions, `${label}.finding`);
  const evidenceClass = assertAllowed(entry.evidenceClass ?? "U", classes, `${label}.evidenceClass`);
  if ((state === "not-collected" || state === "unknown") && finding !== "unknown") {
    throw new Error(`${label}.finding must remain unknown when evidence state is ${state}`);
  }
  const sourceId = entry.sourceId == null ? null : String(entry.sourceId);
  const claim = entry.claim == null ? null : String(entry.claim);
  return { authority, state, finding, evidenceClass, sourceId, claim };
}

export function buildQualityEvidenceVector(policy, input) {
  assertObject(policy, "policy");
  assertObject(input, "input");
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_IMPACT_KEYS.has(key)) throw new Error(`${key} is an Impact signal and cannot be Quality evidence`);
  }

  const artifacts = Array.isArray(input.artifacts) ? input.artifacts : [];
  if (artifacts.length === 0) throw new Error("input.artifacts must be non-empty");
  const route = buildAssessmentRoute(policy, artifacts);
  const applicabilityStates = new Set(policy.applicabilityStates);
  const overrides = input.applicability ?? {};
  const evidence = input.evidence ?? {};
  assertObject(overrides, "input.applicability");
  assertObject(evidence, "input.evidence");

  const emphasized = new Set(route.emphasize);
  const defaults = policy.qualityEvidenceContract;
  const dimensions = {};

  for (const dimension of policy.qualityDimensions) {
    const fallback = emphasized.has(dimension)
      ? defaults.defaultEmphasizedApplicability
      : defaults.defaultOtherApplicability;
    const applicability = assertAllowed(overrides[dimension] ?? fallback, applicabilityStates, `${dimension}.applicability`);
    const rawEntries = evidence[dimension] ?? [];
    if (!Array.isArray(rawEntries)) throw new Error(`${dimension}.evidence must be an array`);
    const entries = rawEntries.map((entry, index) => normalizeEvidenceEntry(entry, policy, `${dimension}.evidence[${index}]`));
    const authority = summarizeAuthority(entries);
    const evidenceState = summarizeEvidenceState(entries);
    const { findingState, findingCounts } = summarizeFinding(entries);
    const observed = entries.some((entry) => entry.state === "observed");

    let disposition = "unevidenced";
    if (applicability === "not-applicable") disposition = "excluded";
    else if (applicability === "unknown") disposition = "unresolved-applicability";
    else if (evidenceState === "conflicting") disposition = "conflicting";
    else if (observed) disposition = "evidenced";
    else if (evidenceState === "stale") disposition = "stale";

    dimensions[dimension] = {
      applicability,
      authority,
      evidenceState,
      findingState,
      findingCounts,
      disposition,
      evidenceCount: entries.length,
      evidence: entries,
    };
  }

  return {
    schemaVersion: 1,
    artifacts: [...artifacts],
    claimBoundaries: [...route.claimBoundaries],
    dimensions,
    compositeQualityScore: null,
  };
}
