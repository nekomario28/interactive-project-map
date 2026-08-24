import {
  normalizeRepositoryRelation,
  relationAttributionProfile,
  relationRequiresLocalDelta,
  relationRequiresPersonalContribution,
} from "./repository-relation.mjs";

const FORBIDDEN_PROJECT_SIDE_KEYS = [
  "projectStars",
  "projectForks",
  "projectContributors",
  "projectQuality",
  "projectImpact",
  "projectScale",
];

const LOCAL_DELTA_STATES = new Set(["observed", "unknown"]);
const LOCAL_DELTA_PRESENCE = new Set(["present", "absent", "unknown"]);

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

function boundedText(value, label) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${label} must be string when supplied`);
  return value.slice(0, 240);
}

function normalizeLocalDelta(input) {
  if (input.localDeltaObservation != null && input.localDeltaEvidence != null) {
    throw new Error("use localDeltaObservation or legacy localDeltaEvidence, not both");
  }

  if (input.localDeltaObservation == null) {
    const legacy = boundedText(input.localDeltaEvidence, "localDeltaEvidence");
    if (legacy == null) {
      return { state: "unknown", presence: "unknown", scope: null, evidence: null };
    }
    return { state: "observed", presence: "present", scope: "unspecified", evidence: legacy };
  }

  const observation = input.localDeltaObservation;
  if (!observation || typeof observation !== "object" || Array.isArray(observation)) {
    throw new Error("localDeltaObservation must be an object when supplied");
  }
  const state = observation.state ?? "unknown";
  const presence = observation.presence ?? "unknown";
  if (!LOCAL_DELTA_STATES.has(state)) throw new Error("localDeltaObservation.state is unsupported");
  if (!LOCAL_DELTA_PRESENCE.has(presence)) throw new Error("localDeltaObservation.presence is unsupported");

  const scope = boundedText(observation.scope, "localDeltaObservation.scope");
  const evidence = boundedText(observation.evidence, "localDeltaObservation.evidence");

  if (state === "unknown") {
    if (presence !== "unknown") throw new Error("unknown local delta observation cannot claim present or absent delta");
    if (evidence != null) throw new Error("unknown local delta observation cannot carry result evidence");
    return { state, presence, scope, evidence: null };
  }

  if (presence === "unknown") throw new Error("observed local delta observation must resolve presence");
  if (scope == null) throw new Error("observed local delta observation requires comparison scope");
  return { state, presence, scope, evidence };
}

function attributionForRelation(relation) {
  const profile = relationAttributionProfile(relation);
  if (profile === "direct") {
    return {
      profile,
      mode: "direct-solo-original-context",
      requiresPersonalContributionGate: false,
      requiresLocalDeltaEvidence: false,
    };
  }
  if (profile === "fork") {
    return {
      profile,
      mode: "fork-local-delta",
      requiresPersonalContributionGate: true,
      requiresLocalDeltaEvidence: true,
    };
  }
  if (profile === "contributed") {
    return {
      profile,
      mode: "external-project-contribution-gated",
      requiresPersonalContributionGate: true,
      requiresLocalDeltaEvidence: relationRequiresLocalDelta(relation),
    };
  }
  if (profile === "team") {
    return {
      profile,
      mode: "team-contribution-gated",
      requiresPersonalContributionGate: true,
      requiresLocalDeltaEvidence: false,
    };
  }
  return {
    profile,
    mode: "unresolved-attribution",
    requiresPersonalContributionGate: true,
    requiresLocalDeltaEvidence: relationRequiresLocalDelta(relation),
  };
}

export function buildPersonalContributionEvidence(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("contribution input must be an object");
  const relation = normalizeRepositoryRelation(input.relation, "contribution input.relation");

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

  const localDelta = normalizeLocalDelta(input);
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

  const attribution = attributionForRelation(relation);

  return {
    schemaVersion: 1,
    relation,
    activity,
    responsibility,
    localDelta,
    scopeEvidence,
    signals: {
      activity: activitySignals,
      responsibility: responsibilitySignals,
      localDelta: localDelta.state === "observed" && localDelta.presence === "present" ? ["local-delta-present"] : [],
    },
    attribution: {
      ...attribution,
      localDeltaState: relationRequiresLocalDelta(relation) ? localDelta.state : "not-applicable",
      localDeltaPresence: relationRequiresLocalDelta(relation) ? localDelta.presence : "not-applicable",
      directPersonalMeritPermitted: !relationRequiresPersonalContribution(relation),
    },
    compositePersonalContribution: null,
    portfolioProminenceEffect: null,
  };
}
