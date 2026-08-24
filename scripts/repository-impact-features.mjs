const RELATIONS = new Set(["owned-solo", "owned-team", "owned-fork", "contributed"]);

function observedCount(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be an observed non-negative number`);
  }
  return Math.floor(value);
}

function optionalCount(value, label) {
  if (value == null) return { state: "unknown", raw: null, transformed: null };
  const raw = observedCount(value, label);
  return { state: "observed", raw, transformed: Math.log1p(raw) };
}

function requiredCount(value, label) {
  const raw = observedCount(value, label);
  return { state: "observed", raw, transformed: Math.log1p(raw) };
}

function attributionMode(relation) {
  if (relation === "owned-fork") return "fork-local-only";
  if (relation === "contributed") return "project-context-requires-contribution-gating";
  return "direct-project";
}

export function buildRepositoryImpactEvidence(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("impact input must be an object");
  if (!RELATIONS.has(input.relation)) throw new Error(`unsupported relation: ${String(input.relation)}`);
  if (typeof input.fork !== "boolean") throw new Error("fork must be boolean");
  if (input.relation === "owned-fork" && input.fork !== true) throw new Error("owned-fork relation requires fork=true");
  if (input.relation !== "owned-fork" && input.fork === true) throw new Error("fork=true requires owned-fork relation in v1 input");

  const stars = requiredCount(input.stars, "stars");
  const forks = requiredCount(input.forks, "forks");
  const dependents = optionalCount(input.dependents, "dependents");
  const downloads = optionalCount(input.downloads, "downloads");
  const citations = optionalCount(input.citations, "citations");
  const contributors = optionalCount(input.contributors, "contributors");

  let upstreamContext = null;
  if (input.fork) {
    if (!input.parent || typeof input.parent !== "object" || Array.isArray(input.parent)) {
      upstreamContext = {
        state: "unknown",
        contextOnly: true,
        eligibleForLocalImpact: false,
        recognition: { state: "unknown", raw: null, transformed: null },
        reuseDerivativeInterest: { state: "unknown", raw: null, transformed: null },
      };
    } else {
      upstreamContext = {
        state: "observed",
        contextOnly: true,
        eligibleForLocalImpact: false,
        recognition: requiredCount(input.parent.stars, "parent.stars"),
        reuseDerivativeInterest: requiredCount(input.parent.forks, "parent.forks"),
      };
    }
  }

  return {
    schemaVersion: 1,
    relation: input.relation,
    projectSide: {
      recognition: {
        ...stars,
        source: "stars",
        directQualityEffect: false,
      },
      reuseDerivativeInterest: {
        ...forks,
        source: "forks",
        interpretation: "reuse-derivative-interest",
        independentAdopterCount: null,
        directQualityEffect: false,
      },
      adoption: {
        dependents,
        downloads,
      },
      researchDomainUptake: {
        citations,
      },
      collaborationContext: {
        contributors,
        personalContributionInferred: false,
      },
    },
    upstreamContext,
    attribution: {
      mode: attributionMode(input.relation),
      requiresPersonalContributionGate: input.relation === "contributed",
      upstreamMetricsAreContextOnly: input.fork,
    },
    compositeImpact: null,
    portfolioProminenceEffect: null,
  };
}

export function compareRecognition(left, right) {
  const a = buildRepositoryImpactEvidence(left).projectSide.recognition.transformed;
  const b = buildRepositoryImpactEvidence(right).projectSide.recognition.transformed;
  return a === b ? 0 : a < b ? -1 : 1;
}
