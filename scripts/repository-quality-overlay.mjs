const TARGET_APPLICABILITY = new Set(["required", "recommended"]);
const SUPPORTED_FINDINGS = new Set(["supports", "weakens", "neutral", "mixed", "unknown"]);
const COMPACT_FINDING_ORDER = Object.freeze(["supports", "neutral", "weakens", "mixed", "unknown"]);

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

function overlayToken(dimension) {
  if (dimension.applicability === "not-applicable") return "quality-not-applicable";
  if (dimension.applicability === "unknown") return "quality-unresolved-applicability";
  if (!TARGET_APPLICABILITY.has(dimension.applicability)) return "quality-optional";
  return `quality-${dimension.findingState}`;
}

function attentionState(segments) {
  const targets = segments.filter((segment) => segment.target);
  if (targets.some((segment) => segment.findingState === "mixed")) return "mixed-evidence";
  if (targets.some((segment) => segment.findingState === "weakens")) return "weakening-evidence";
  if (targets.some((segment) => segment.findingState === "unknown")) return "incomplete-evidence";
  if (targets.length > 0 && targets.every((segment) => segment.findingState === "supports")) return "all-targets-support";
  return "known-tradeoff";
}

function compactDistribution(targetFindingCounts, targetDimensions) {
  return {
    mode: "target-finding-distribution",
    denominator: targetDimensions,
    findingOrder: [...COMPACT_FINDING_ORDER],
    segments: COMPACT_FINDING_ORDER.map((findingState) => ({
      findingState,
      count: targetFindingCounts[findingState],
      ratio: ratio(targetFindingCounts[findingState], targetDimensions),
      token: `quality-${findingState}`,
    })),
    dimensionIdentityPreserved: false,
    requiresDetailForDimensionIdentity: true,
    compositeQualityScore: null,
  };
}

export function buildQualityOverlayModel(policyValue, qualityValue, confidenceValue) {
  const policy = object(policyValue, "policy");
  const quality = object(qualityValue, "quality");
  const confidence = object(confidenceValue, "confidence");
  if (quality.schemaVersion !== 1) throw new Error("unsupported Quality vector schemaVersion");
  if (confidence.schemaVersion !== 1) throw new Error("unsupported Confidence vector schemaVersion");

  const dimensions = object(quality.dimensions, "quality.dimensions");
  const dimensionCoverage = object(confidence.dimensionCoverage, "confidence.dimensionCoverage");
  const order = Array.isArray(policy.qualityDimensions) ? policy.qualityDimensions : [];
  const segments = order.map((id, index) => {
    const dimension = object(dimensions[id], `quality.dimensions.${id}`);
    if (!SUPPORTED_FINDINGS.has(dimension.findingState)) throw new Error(`unsupported findingState for ${id}: ${dimension.findingState}`);
    const coverage = object(dimensionCoverage[id], `confidence.dimensionCoverage.${id}`);
    const target = TARGET_APPLICABILITY.has(dimension.applicability);
    return {
      id,
      slot: index,
      applicability: dimension.applicability,
      target,
      findingState: dimension.findingState,
      evidenceState: dimension.evidenceState,
      inspected: Boolean(coverage.inspected),
      directional: Boolean(coverage.directional),
      token: overlayToken(dimension),
    };
  });

  const targets = segments.filter((segment) => segment.target);
  const targetFindingCounts = { supports: 0, weakens: 0, neutral: 0, mixed: 0, unknown: 0 };
  for (const segment of targets) targetFindingCounts[segment.findingState] += 1;

  const coverage = object(confidence.coverage, "confidence.coverage");
  const targetDimensions = targets.length;
  if (coverage.targetDimensions !== targetDimensions) {
    throw new Error("Quality overlay target dimension count disagrees with Confidence vector");
  }

  return {
    schemaVersion: 1,
    mode: "quality-evidence-overlay",
    dimensionOrder: [...order],
    segments,
    targetFindingCounts,
    compactDistribution: compactDistribution(targetFindingCounts, targetDimensions),
    coverage: {
      targetDimensions,
      inspectedDimensions: coverage.inspectedDimensions,
      directionalDimensions: coverage.directionalDimensions,
      inspectedCoverageRatio: coverage.inspectedCoverageRatio,
      directionalCoverageRatio: coverage.directionalCoverageRatio,
      label: `${coverage.directionalDimensions}/${targetDimensions} interpreted`,
    },
    attentionState: attentionState(segments),
    visualContract: {
      slotCount: order.length,
      fixedGlobalDimensionSlots: true,
      targetUnknownRemainsVisible: true,
      optionalDimensionsDoNotInflateCoverage: true,
      notApplicableUsesGapSemantic: true,
      nodeSizeEffect: "none",
      labelPriorityEffect: "none",
      impactHaloEffect: "none",
      fullRingEncoding: "fixed-dimension-semantic-segments",
      compactRingEncoding: "target-finding-distribution",
      compactRingPreservesDimensionIdentity: false,
      compactRingRequiresDetailForDimensionIdentity: true,
    },
    compositeQualityScore: null,
    productionRankingAllowed: false,
  };
}
