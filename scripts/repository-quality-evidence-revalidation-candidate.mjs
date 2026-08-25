const REVALIDATION_REASONS = new Set([
  "explicit-review-request",
  "source-revision-check",
  "known-evidence-invalidated",
  "calibration-contract-change",
]);

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function normalizedRepositoryKey(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!/^[^/]+\/[^/]+$/.test(key)) throw new Error(`invalid repository key: ${String(value)}`);
  return key;
}

function snapshotDate(value, label) {
  const date = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${label} must be an explicit YYYY-MM-DD date`);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`${label} must be an explicit calendar-valid YYYY-MM-DD date`);
  }
  return date;
}

function observedAt(value) {
  const raw = String(value || "");
  const parsed = new Date(raw);
  if (!raw || Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== raw) {
    throw new Error("revalidation observedAt must be an exact ISO-8601 UTC timestamp");
  }
  return raw;
}

function exactRevision(value, label) {
  const revision = String(value || "").trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error(`${label} must be an exact 40-hex Git revision`);
  return revision;
}

function effectiveSnapshotDate(source) {
  return snapshotDate(source.effectiveSnapshotDate ?? source.fixtureSnapshotDate, `${source.repositoryKey} effective snapshot date`);
}

function summarizeFreshness(sources, scope, dateSelector = effectiveSnapshotDate) {
  if (!Array.isArray(sources) || sources.length === 0) throw new Error(`freshness sources are unavailable for ${scope}`);
  const snapshotDates = [...new Set(sources.map((source) => dateSelector(source)))].sort();
  return {
    mode: "bounded-frozen-snapshots",
    scope,
    automaticRefresh: false,
    sourceCount: sources.length,
    snapshotDates,
    oldestSnapshotDate: snapshotDates[0],
    newestSnapshotDate: snapshotDates.at(-1),
  };
}

function freshnessPair(sources, dateSelector = effectiveSnapshotDate) {
  return {
    assessment: summarizeFreshness(sources, "all-bounded-assessment-sources", dateSelector),
    portfolioPresentation: summarizeFreshness(
      sources.filter((source) => source.presentationExpected === "available"),
      "portfolio-quality-presented-sources",
      dateSelector,
    ),
  };
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cloneSourceDiagnostics(sourceDiagnostics) {
  if (!Array.isArray(sourceDiagnostics) || sourceDiagnostics.length === 0) {
    throw new Error("bounded Quality source diagnostics must be a non-empty array");
  }
  return sourceDiagnostics.map((sourceValue, index) => {
    const source = object(sourceValue, `sourceDiagnostics[${index}]`);
    return {
      ...structuredClone(source),
      repositoryKey: normalizedRepositoryKey(source.repositoryKey),
      fixtureSnapshotDate: snapshotDate(source.fixtureSnapshotDate, `${source.repositoryKey} fixture snapshot date`),
      effectiveSnapshotDate: snapshotDate(source.fixtureSnapshotDate, `${source.repositoryKey} fixture snapshot date`),
    };
  });
}

export function applyBoundedEvidenceRevalidation(sourceDiagnostics, requestValue) {
  const sources = cloneSourceDiagnostics(sourceDiagnostics);
  const request = object(requestValue, "bounded evidence revalidation request");
  if (request.schemaVersion !== 1) throw new Error("bounded evidence revalidation request schemaVersion must be 1");
  if (typeof request.requestId !== "string" || !request.requestId.trim()) throw new Error("bounded evidence revalidation requestId is required");
  if (request.decisionOwner !== "maintainer-explicit") throw new Error("bounded evidence revalidation decisionOwner must remain maintainer-explicit");
  if (!REVALIDATION_REASONS.has(request.reason)) throw new Error(`unsupported bounded evidence revalidation reason: ${String(request.reason)}`);

  const repositoryKey = normalizedRepositoryKey(request.repositoryKey);
  const caseId = String(request.caseId || "").trim();
  if (!caseId) throw new Error("bounded evidence revalidation caseId is required");
  const target = sources.find((source) => source.repositoryKey === repositoryKey);
  if (!target) throw new Error(`bounded evidence revalidation target is not selected by the source manifest: ${repositoryKey}`);
  if (target.caseId !== caseId) throw new Error(`bounded evidence revalidation case mismatch for ${repositoryKey}: ${caseId} != ${target.caseId}`);

  const observation = object(request.observation, "bounded evidence revalidation observation");
  const seenAt = observedAt(request.observedAt);
  const baselineFreshness = freshnessPair(sources, (source) => snapshotDate(source.fixtureSnapshotDate, `${source.repositoryKey} fixture snapshot date`));

  let disposition;
  let observedRevision = null;
  let observedSnapshotDate = null;
  if (observation.status === "unavailable") {
    if (observation.revision != null || observation.snapshotDate != null) {
      throw new Error("unavailable revalidation observation must not invent a revision or snapshot date");
    }
    disposition = "source-unavailable-retain-frozen";
  } else if (observation.status === "available") {
    observedRevision = exactRevision(observation.revision, "revalidation observed revision");
    observedSnapshotDate = snapshotDate(observation.snapshotDate, "revalidation observed snapshot date");
    const observedUtcDate = seenAt.slice(0, 10);
    if (observedSnapshotDate > observedUtcDate) throw new Error("revalidation snapshot date cannot be later than observedAt");
    if (observedSnapshotDate < target.fixtureSnapshotDate) throw new Error("revalidation snapshot date cannot move backwards from the frozen source");

    if (target.calibratedRevision == null) {
      disposition = "requires-calibration-revision";
    } else {
      const calibratedRevision = exactRevision(target.calibratedRevision, `${repositoryKey} calibrated revision`);
      if (observedRevision !== calibratedRevision) {
        disposition = "requires-recalibration";
      } else {
        disposition = "revalidated-unchanged-exact-revision";
        target.effectiveSnapshotDate = observedSnapshotDate;
      }
    }
  } else {
    throw new Error(`unsupported bounded evidence revalidation observation status: ${String(observation.status)}`);
  }

  target.revalidation = {
    requestId: request.requestId,
    decisionOwner: request.decisionOwner,
    reason: request.reason,
    observedAt: seenAt,
    observedRevision,
    observedSnapshotDate,
    calibratedRevision: target.calibratedRevision ?? null,
    disposition,
    automaticRefresh: false,
    evidenceInterpretationChanged: false,
    publicationPerformed: false,
  };

  const evidenceFreshness = freshnessPair(sources);
  return {
    schemaVersion: 1,
    candidateId: "ipm-bounded-quality-evidence-revalidation-v1",
    status: "experimental-not-published",
    target: {
      repositoryKey,
      caseId,
      presentationExpected: target.presentationExpected,
      previousSnapshotDate: target.fixtureSnapshotDate,
      effectiveSnapshotDate: target.effectiveSnapshotDate,
      calibratedRevision: target.calibratedRevision ?? null,
      observedRevision,
      disposition,
    },
    baselineFreshness,
    evidenceFreshness,
    assessmentFreshnessChanged: !sameJson(baselineFreshness.assessment, evidenceFreshness.assessment),
    presentationFreshnessChanged: !sameJson(baselineFreshness.portfolioPresentation, evidenceFreshness.portfolioPresentation),
    sourceDiagnostics: sources,
    invariants: {
      oneSourcePerRequest: true,
      refreshDecisionOwner: "maintainer-explicit",
      automaticSourceDiscoveryPerformed: false,
      automaticEvidenceRefreshPerformed: false,
      exactRevisionRequiredForFreshnessAdvance: true,
      changedRevisionRequiresRecalibration: true,
      missingCalibrationRevisionCannotAdvanceFreshness: true,
      unavailableSourceRetainsFrozenSnapshot: true,
      qualityInterpretationChanged: false,
      publicationPerformed: false,
    },
  };
}
