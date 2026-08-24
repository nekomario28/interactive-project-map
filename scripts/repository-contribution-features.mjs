const RELATIONS = new Set(["owned-solo", "owned-team", "owned-fork", "contributed"]);
const FORBIDDEN_PROJECT_SIDE_KEYS = [
  "projectStars",
  "projectForks",
  "projectContributors",
  "projectQuality",
  "projectImpact",
  "projectScale",
];

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

function optionalText(value, label) {
  if (value == null || value === "") return { state: "unknown", value: null };
  if (typeof value !== "string") throw new Error(`${label} must be string when observed`);
  return { state: "observed", value: value.slice(0, 240) };
}

function attributionForRelation(relation) {
  if (relation === "owned-solo") {
    return {
      mode: "direct-solo-context",
      requiresPersonalContributionGate: false,
      requiresLocalDeltaEvidence: false,
    };
  }
  if (relation === "owned-fork") {
    return {
      mode: "fork-local-delta",
      requiresPersonalContributionGate: true,
      requiresLocalDeltaEvidence: true,
    };
  }
  if (relation === "contributed") {
    return {
      mode: "external-project-contribution-gated",
      requiresPersonalContributionGate: true,
      requiresLocalDeltaEvidence: false,
    };
  }
  return {
    mode: "team-contribution-gated",
    requiresPersonalContributionGate: true,
    requiresLocalDeltaEvidence: false,
  };
}

export function buildPersonalContributionEvidence(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("contribution input must be an object");
  if (!RELATIONS.has(input.relation)) throw new Error(`unsupported relation: ${String(input.relation)}`);

  for (const key of FORBIDDEN_PROJECT_SIDE_KEYS) {
    if (Object.hasOwn(input, key)) throw new Error(`${key} is project-side evidence and must not enter Personal Contribution extraction`);
  }

  const activity = {
    mergedPullRequests: optionalCount(input.mergedPullRequests, "mergedPullRequests"),
    commits: optionalCount(input.commits, "commits"),
    reviews: optionalCount(input.reviews, "reviews"),
    issues: optionalCount(input.issues, "issues"),
    activeDurationMonths: optionalCount(input.activeDurationMonths, "activeDurationMonths"),
  };

  const responsibility = {
    maintainerRole: optionalBoolean(input.maintainerRole, "maintainerRole"),
    releaseInvolvement: optionalBoolean(input.releaseInvolvement, "releaseInvolvement"),
    maintainedCoreComponent: optionalBoolean(input.maintainedCoreComponent, "maintainedCoreComponent"),
  };

  const localDelta = optionalText(input.localDeltaEvidence, "localDeltaEvidence");
  const scopeEvidence = optionalText(input.scopeEvidence, "scopeEvidence");

  const activitySignals = [];
  if (activity.mergedPullRequests.state === "observed" && activity.mergedPullRequests.raw > 0) activitySignals.push("merged-prs");
  if (activity.commits.state === "observed" && activity.commits.raw > 0) activitySignals.push("commits");
  if (activity.reviews.state === "observed" && activity.reviews.raw > 0) activitySignals.push("reviews");
  if (activity.issues.state === "observed" && activity.issues.raw > 0) activitySignals.push("issues");
  if (activity.activeDurationMonths.state === "observed" && activity.activeDurationMonths.raw > 0) activitySignals.push("sustained-duration");

  const responsibilitySignals = [];
  if (responsibility.maintainerRole.state === "observed" && responsibility.maintainerRole.value) responsibilitySignals.push("maintainer-role");
  if (responsibility.releaseInvolvement.state === "observed" && responsibility.releaseInvolvement.value) responsibilitySignals.push("release-involvement");
  if (responsibility.maintainedCoreComponent.state === "observed" && responsibility.maintainedCoreComponent.value) responsibilitySignals.push("maintained-core-component");

  const attribution = attributionForRelation(input.relation);

  return {
    schemaVersion: 1,
    relation: input.relation,
    activity,
    responsibility,
    localDelta,
    scopeEvidence,
    signals: {
      activity: activitySignals,
      responsibility: responsibilitySignals,
    },
    attribution: {
      ...attribution,
      localDeltaState: input.relation === "owned-fork" ? localDelta.state : "not-applicable",
    },
    compositePersonalContribution: null,
    portfolioProminenceEffect: null,
  };
}
