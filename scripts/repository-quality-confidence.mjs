const TARGET_APPLICABILITY = new Set(["required", "recommended"]);
const INSPECTED_EVIDENCE_STATES = new Set(["observed", "absent", "stale", "conflicting"]);

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

export function buildQualityConfidenceVector(policyValue, qualityVectorValue) {
  const policy = object(policyValue, "policy");
  const qualityVector = object(qualityVectorValue, "qualityVector");
  if (qualityVector.schemaVersion !== 1) throw new Error("unsupported Quality vector schemaVersion");

  const dimensions = object(qualityVector.dimensions, "qualityVector.dimensions");
  const evidenceClassIds = Object.keys(object(policy.evidenceClasses, "policy.evidenceClasses"));
  const authorityIds = Array.isArray(policy.assessmentAuthorities) ? policy.assessmentAuthorities : [];
  const evidenceClassCounts = Object.fromEntries(evidenceClassIds.map((id) => [id, 0]));
  const authorityCounts = Object.fromEntries(authorityIds.map((id) => [id, 0]));
  const targetDimensionIds = [];
  const dimensionCoverage = {};

  let inspectedDimensions = 0;
  let directionalDimensions = 0;
  let conflictingDimensions = 0;
  let staleDimensions = 0;

  for (const dimensionId of policy.qualityDimensions ?? []) {
    const dimension = object(dimensions[dimensionId], `qualityVector.dimensions.${dimensionId}`);
    const target = TARGET_APPLICABILITY.has(dimension.applicability);
    const entries = Array.isArray(dimension.evidence) ? dimension.evidence : [];
    const inspected = entries.some((entry) => INSPECTED_EVIDENCE_STATES.has(entry.state));
    const directional = dimension.findingState !== "unknown";

    dimensionCoverage[dimensionId] = {
      applicability: dimension.applicability,
      target,
      inspected,
      directional,
      evidenceState: dimension.evidenceState,
      findingState: dimension.findingState,
      evidenceCount: entries.length,
    };

    if (!target) continue;
    targetDimensionIds.push(dimensionId);
    if (inspected) inspectedDimensions += 1;
    if (directional) directionalDimensions += 1;
    if (dimension.evidenceState === "conflicting") conflictingDimensions += 1;
    if (dimension.evidenceState === "stale") staleDimensions += 1;

    for (const entry of entries) {
      if (Object.hasOwn(evidenceClassCounts, entry.evidenceClass)) evidenceClassCounts[entry.evidenceClass] += 1;
      if (Object.hasOwn(authorityCounts, entry.authority)) authorityCounts[entry.authority] += 1;
    }
  }

  const targetDimensions = targetDimensionIds.length;
  return {
    schemaVersion: 1,
    targetApplicability: ["required", "recommended"],
    coverage: {
      targetDimensions,
      inspectedDimensions,
      directionalDimensions,
      unresolvedInspectionDimensions: targetDimensions - inspectedDimensions,
      unresolvedDirectionDimensions: targetDimensions - directionalDimensions,
      conflictingDimensions,
      staleDimensions,
      inspectedCoverageRatio: ratio(inspectedDimensions, targetDimensions),
      directionalCoverageRatio: ratio(directionalDimensions, targetDimensions),
    },
    targetDimensionIds,
    dimensionCoverage,
    evidenceClassCounts,
    authorityCounts,
    compositeConfidenceScore: null,
  };
}
