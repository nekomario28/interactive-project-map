import { buildPersonalContributionEvidence } from "./repository-contribution-features.mjs";
import { buildQualityEvidenceVector } from "./repository-quality-evidence.mjs";
import { normalizeRepositoryRelation } from "./repository-relation.mjs";

const CONTRACT_ID = "ipm-repository-fork-quality-v1";
const EVIDENCE_ORIGINS = new Set(["local", "upstream-inherited", "upstream-accepted", "mixed", "unknown"]);
const PERSON_SIDE_ORIGINS = new Set(["local", "upstream-accepted"]);
const AVAILABLE_STATES = new Set(["observed", "partial"]);

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function repositoryKey(value, label) {
  const key = String(value || "").trim().toLowerCase();
  if (!/^[^/]+\/[^/]+$/.test(key)) throw new Error(`${label} must be owner/repository`);
  return key;
}

function normalizeEvidenceMap(value, label, { personSide = false } = {}) {
  const evidence = object(value ?? {}, label);
  const normalized = {};
  const provenance = {};
  const originCounts = {
    local: 0,
    "upstream-inherited": 0,
    "upstream-accepted": 0,
    mixed: 0,
    unknown: 0,
  };

  for (const [dimension, rawEntries] of Object.entries(evidence)) {
    if (!Array.isArray(rawEntries)) throw new Error(`${label}.${dimension} must be an array`);
    provenance[dimension] = [];
    normalized[dimension] = rawEntries.map((raw, index) => {
      const entry = object(raw, `${label}.${dimension}[${index}]`);
      const origin = entry.origin ?? "unknown";
      if (!EVIDENCE_ORIGINS.has(origin)) throw new Error(`${label}.${dimension}[${index}].origin is unsupported`);
      if (personSide && !PERSON_SIDE_ORIGINS.has(origin)) {
        throw new Error(`${label}.${dimension}[${index}] origin ${origin} cannot enter local-delta Quality`);
      }
      originCounts[origin] += 1;
      provenance[dimension].push({ origin, sourceId: entry.sourceId == null ? null : String(entry.sourceId) });
      const { origin: _origin, ...qualityEntry } = entry;
      return qualityEntry;
    });
  }

  return { evidence: normalized, provenance, originCounts };
}

function originState(counts) {
  const observed = Object.entries(counts).filter(([, count]) => count > 0).map(([origin]) => origin);
  if (observed.length === 0) return "unknown";
  if (observed.length === 1) return observed[0];
  return "mixed";
}

function qualitySection(state, value = null, reason = null, evidenceProvenance = {}) {
  return { state, value, reason, evidenceProvenance };
}

export function isForkQualityBundle(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && value.contractId === CONTRACT_ID);
}

export function selectForkPortfolioQualityVector(value) {
  const bundle = object(value, "fork Quality bundle");
  if (bundle.contractId !== CONTRACT_ID) throw new Error("unsupported fork Quality contract");
  const local = object(bundle.localDelta, "fork Quality bundle.localDelta");
  const quality = object(local.quality, "fork Quality bundle.localDelta.quality");
  if (!AVAILABLE_STATES.has(quality.state)) {
    return { state: "unavailable", reason: quality.reason ?? "fork-local-delta-quality-not-collected", value: null };
  }
  return { state: "available", reason: null, value: object(quality.value, "fork local-delta Quality vector") };
}

export function buildForkQualityBundle(policyValue, inputValue) {
  const policy = object(policyValue, "policy");
  const input = object(inputValue, "fork Quality input");
  const relation = normalizeRepositoryRelation(input.relation, "fork Quality input.relation");
  if (relation.lineage !== "fork") throw new Error("fork Quality contract requires relation.lineage=fork");
  const artifacts = Array.isArray(input.artifacts) ? input.artifacts : [];
  if (artifacts.length === 0) throw new Error("fork Quality input.artifacts must be non-empty");

  const upstream = object(input.upstream, "fork Quality input.upstream");
  const upstreamRepositoryKey = repositoryKey(upstream.repositoryKey, "fork Quality input.upstream.repositoryKey");

  const snapshotInput = normalizeEvidenceMap(input.snapshotEvidence ?? {}, "fork Quality input.snapshotEvidence");
  const snapshotVector = buildQualityEvidenceVector(policy, {
    artifacts,
    applicability: input.snapshotApplicability ?? {},
    evidence: snapshotInput.evidence,
  });

  const contribution = buildPersonalContributionEvidence({
    relation,
    localDeltaObservation: input.localDeltaObservation,
  });
  const delta = contribution.localDelta;

  let localQuality = qualitySection("not-collected", null, "fork-local-delta-quality-not-collected", {});
  let localOriginCounts = { local: 0, "upstream-inherited": 0, "upstream-accepted": 0, mixed: 0, unknown: 0 };

  if (delta.state === "observed" && delta.presence === "absent") {
    localQuality = qualitySection("not-applicable", null, "no-local-delta-observed-in-comparison-scope", {});
  } else if (delta.state === "observed" && delta.presence === "present" && input.localDeltaEvidence != null) {
    const localInput = normalizeEvidenceMap(input.localDeltaEvidence, "fork Quality input.localDeltaEvidence", { personSide: true });
    localOriginCounts = localInput.originCounts;
    const vector = buildQualityEvidenceVector(policy, {
      artifacts,
      applicability: input.localDeltaApplicability ?? {},
      evidence: localInput.evidence,
    });
    localQuality = qualitySection(input.localDeltaQualityState ?? "partial", vector, null, localInput.provenance);
  }

  return {
    schemaVersion: 1,
    contractId: CONTRACT_ID,
    relation,
    artifacts: [...artifacts],
    upstreamContext: {
      repositoryKey: upstreamRepositoryKey,
      role: "context-only",
      projectQualityAttribution: "upstream-context-only",
      projectImpactAttribution: "upstream-context-only",
    },
    snapshotQuality: {
      state: input.snapshotQualityState ?? "partial",
      value: snapshotVector,
      evidenceProvenance: snapshotInput.provenance,
      evidenceOriginState: originState(snapshotInput.originCounts),
      evidenceOriginCounts: snapshotInput.originCounts,
      personSideEligible: false,
    },
    localDelta: {
      observation: delta,
      quality: localQuality,
      evidenceOriginState: originState(localOriginCounts),
      evidenceOriginCounts: localOriginCounts,
    },
    personalAttribution: {
      qualitySource: "local-delta-only",
      snapshotQualityEligible: false,
      upstreamInheritedEvidenceEligible: false,
      upstreamAcceptedEvidenceEligible: true,
      localDeltaRequired: true,
      localDeltaState: delta.state,
      localDeltaPresence: delta.presence,
    },
    compositeForkQualityScore: null,
    productionRankingAllowed: false,
  };
}
