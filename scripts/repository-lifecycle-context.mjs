const LIFECYCLES = new Set(["active", "maintenance", "stable", "frozen", "snapshot", "archived", "experimental", "unknown"]);

function optionalCount(value, label) {
  if (value == null) return { state: "unknown", raw: null };
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number when observed`);
  }
  return { state: "observed", raw: Math.floor(value) };
}

function optionalBoolean(value, label) {
  if (value == null) return { state: "unknown", value: null };
  if (typeof value !== "boolean") throw new Error(`${label} must be boolean when observed`);
  return { state: "observed", value };
}

function activityExpectation(lifecycle) {
  if (lifecycle === "frozen" || lifecycle === "snapshot" || lifecycle === "archived") {
    return {
      mode: "activity-not-required-by-lifecycle",
      inactivityIsAutomaticQualityPenalty: false,
      inactivityIsAutomaticHealthFailure: false,
    };
  }
  if (lifecycle === "stable" || lifecycle === "maintenance") {
    return {
      mode: "activity-context-dependent",
      inactivityIsAutomaticQualityPenalty: false,
      inactivityIsAutomaticHealthFailure: false,
    };
  }
  if (lifecycle === "active" || lifecycle === "experimental") {
    return {
      mode: "activity-may-be-informative",
      inactivityIsAutomaticQualityPenalty: false,
      inactivityIsAutomaticHealthFailure: false,
    };
  }
  return {
    mode: "unknown",
    inactivityIsAutomaticQualityPenalty: false,
    inactivityIsAutomaticHealthFailure: false,
  };
}

export function buildRepositoryLifecycleContext(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("lifecycle input must be an object");
  if (!LIFECYCLES.has(input.lifecycle)) throw new Error(`unsupported lifecycle: ${String(input.lifecycle)}`);

  const activity = {
    daysSincePush: optionalCount(input.daysSincePush, "daysSincePush"),
    commitsPast90Days: optionalCount(input.commitsPast90Days, "commitsPast90Days"),
    releasesPast12Months: optionalCount(input.releasesPast12Months, "releasesPast12Months"),
    issueResponsesPast90Days: optionalCount(input.issueResponsesPast90Days, "issueResponsesPast90Days"),
  };

  const maturityEvidence = {
    releaseCount: optionalCount(input.releaseCount, "releaseCount"),
    stableVersionDeclared: optionalBoolean(input.stableVersionDeclared, "stableVersionDeclared"),
    productionAcceptance: optionalBoolean(input.productionAcceptance, "productionAcceptance"),
    frozenIdentity: optionalBoolean(input.frozenIdentity, "frozenIdentity"),
    versionedArtifact: optionalBoolean(input.versionedArtifact, "versionedArtifact"),
    experimentalDeclaration: optionalBoolean(input.experimentalDeclaration, "experimentalDeclaration"),
  };

  return {
    schemaVersion: 1,
    lifecycle: input.lifecycle,
    activity,
    maturityEvidence,
    interpretation: activityExpectation(input.lifecycle),
    boundaries: {
      activityIsNotQuality: true,
      activityIsNotMaturity: true,
      releaseCountAloneIsNotMaturity: true,
      frozenOrSnapshotCanBeHealthyWithoutRecentActivity: input.lifecycle === "frozen" || input.lifecycle === "snapshot",
    },
    compositeMaturity: null,
    compositeActivity: null,
    healthInference: null,
  };
}
