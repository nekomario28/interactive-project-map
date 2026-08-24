const PURE_FINDING_VALUES = Object.freeze({
  weakens: -1,
  neutral: 0,
  supports: 1,
});

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

function targetIds(confidence) {
  if (!Array.isArray(confidence.targetDimensionIds)) throw new Error("confidence.targetDimensionIds must be an array");
  return [...confidence.targetDimensionIds];
}

function validatePair(qualityValue, confidenceValue) {
  const quality = object(qualityValue, "quality");
  const confidence = object(confidenceValue, "confidence");
  if (quality.schemaVersion !== 1) throw new Error("unsupported Quality vector schemaVersion");
  if (confidence.schemaVersion !== 1) throw new Error("unsupported Confidence vector schemaVersion");
  object(quality.dimensions, "quality.dimensions");
  return { quality, confidence };
}

export function buildQualityAggregationExperiment(qualityValue, confidenceValue) {
  const { quality, confidence } = validatePair(qualityValue, confidenceValue);
  const ids = targetIds(confidence);
  const findingCounts = { supports: 0, weakens: 0, neutral: 0, mixed: 0, unknown: 0 };
  const pureDirectionalDimensionIds = [];
  const mixedDimensionIds = [];
  const unknownDimensionIds = [];
  const componentSignature = {};
  let netDirection = 0;

  for (const id of ids) {
    const dimension = object(quality.dimensions[id], `quality.dimensions.${id}`);
    const finding = dimension.findingState;
    if (!Object.hasOwn(findingCounts, finding)) throw new Error(`unsupported findingState for ${id}: ${finding}`);
    findingCounts[finding] += 1;
    componentSignature[id] = finding;

    if (Object.hasOwn(PURE_FINDING_VALUES, finding)) {
      pureDirectionalDimensionIds.push(id);
      netDirection += PURE_FINDING_VALUES[finding];
    } else if (finding === "mixed") {
      mixedDimensionIds.push(id);
    } else {
      unknownDimensionIds.push(id);
    }
  }

  const pureDirectionalDimensions = pureDirectionalDimensionIds.length;
  const targetDimensions = ids.length;

  return {
    schemaVersion: 1,
    targetDimensionIds: ids,
    componentSignature,
    findingCounts,
    paretoCandidate: {
      mode: "bounded-common-known-dimensions",
      targetDimensionIds: ids,
      productionRankingAllowed: false,
    },
    directionalBalanceCandidate: {
      value: ratio(netDirection, pureDirectionalDimensions),
      netDirection,
      pureDirectionalDimensions,
      targetDimensions,
      pureDirectionalCoverageRatio: ratio(pureDirectionalDimensions, targetDimensions),
      confidenceDirectionalCoverageRatio: confidence.coverage?.directionalCoverageRatio ?? null,
      pureDirectionalDimensionIds,
      mixedDimensionIds,
      unknownDimensionIds,
      productionRankingAllowed: false,
      claimBoundary: "A directional balance can match across repositories with materially different evidence coverage; it is diagnostic only and must not rank by itself.",
    },
    compositeQualityScore: null,
    recommendedProductionAggregation: "component-vector",
  };
}

export function compareKnownQualityPareto(leftValue, rightValue) {
  const left = object(leftValue, "left");
  const right = object(rightValue, "right");
  if (left.schemaVersion !== 1 || right.schemaVersion !== 1) throw new Error("unsupported aggregation experiment schemaVersion");

  const leftIds = Array.isArray(left.targetDimensionIds) ? left.targetDimensionIds : [];
  const rightIds = Array.isArray(right.targetDimensionIds) ? right.targetDimensionIds : [];
  if (leftIds.length !== rightIds.length || leftIds.some((id, index) => id !== rightIds[index])) {
    return {
      relation: "incomparable-target-set",
      comparedDimensionIds: [],
      omittedDimensionIds: [...new Set([...leftIds, ...rightIds])],
      productionRankingAllowed: false,
    };
  }

  const comparedDimensionIds = [];
  const omittedDimensionIds = [];
  let leftBetter = false;
  let rightBetter = false;

  for (const id of leftIds) {
    const leftFinding = left.componentSignature?.[id];
    const rightFinding = right.componentSignature?.[id];
    if (!Object.hasOwn(PURE_FINDING_VALUES, leftFinding) || !Object.hasOwn(PURE_FINDING_VALUES, rightFinding)) {
      omittedDimensionIds.push(id);
      continue;
    }
    comparedDimensionIds.push(id);
    const leftValueNumber = PURE_FINDING_VALUES[leftFinding];
    const rightValueNumber = PURE_FINDING_VALUES[rightFinding];
    if (leftValueNumber > rightValueNumber) leftBetter = true;
    if (rightValueNumber > leftValueNumber) rightBetter = true;
  }

  let relation = "incomparable-no-common-known";
  if (comparedDimensionIds.length > 0) {
    if (leftBetter && rightBetter) relation = "tradeoff-on-common-known";
    else if (leftBetter) relation = "left-dominates-on-common-known";
    else if (rightBetter) relation = "right-dominates-on-common-known";
    else relation = "equal-on-common-known";
  }

  return {
    relation,
    comparedDimensionIds,
    omittedDimensionIds,
    boundedToCommonKnown: true,
    productionRankingAllowed: false,
  };
}
