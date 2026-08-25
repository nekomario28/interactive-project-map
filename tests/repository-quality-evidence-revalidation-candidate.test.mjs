import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { applyBoundedEvidenceRevalidation } from "../scripts/repository-quality-evidence-revalidation-candidate.mjs";
import {
  buildLiveQualitySidecarCandidates,
  loadBoundedQualityEnrichments,
} from "../scripts/repository-quality-live-sidecar-candidate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const manifestPath = path.join(root, "data/repository-quality-live-profile-enrichment-sources.v1.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const live = JSON.parse(fs.readFileSync(path.join(root, "fixtures/repository-assessment-live-profile-minimal-2026-08-25.json"), "utf8"));
const antifullbrightObservation = JSON.parse(fs.readFileSync(
  path.join(root, "fixtures/repository-quality-evidence-revalidation-antifullbright-2026-08-25.v1.json"),
  "utf8",
));
const generatorRevision = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function source(repositoryKey, caseId, fixtureSnapshotDate, presentationExpected, calibratedRevision) {
  return {
    repositoryKey,
    mode: "repository-snapshot",
    fixture: "fixtures/shared.json",
    fixtureStatus: "frozen-test-evidence",
    fixtureSnapshotDate,
    caseId,
    calibratedRevision,
    evidenceField: "evidence",
    qualityAttributionScope: "repository-snapshot",
    presentationExpected,
    artifacts: ["application"],
  };
}

function request(repositoryKey, caseId, observation, overrides = {}) {
  return {
    schemaVersion: 1,
    requestId: `revalidate-${caseId}`,
    decisionOwner: "maintainer-explicit",
    reason: "source-revision-check",
    repositoryKey,
    caseId,
    observedAt: "2026-08-25T06:20:00.000Z",
    observation,
    ...overrides,
  };
}

const revA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const revB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const revC = "cccccccccccccccccccccccccccccccccccccccc";

function syntheticSources() {
  return [
    source("example/alpha", "alpha", "2026-08-24", "available", revA),
    source("example/beta", "beta", "2026-08-24", "available", revB),
    source("example/gamma", "gamma", "2026-08-24", "unavailable", revC),
  ];
}

test("one explicitly re-observed eligible source advances independently even when peers share the same frozen date", () => {
  const result = applyBoundedEvidenceRevalidation(
    syntheticSources(),
    request("example/alpha", "alpha", {
      status: "available",
      snapshotDate: "2026-08-25",
      revision: revA,
    }),
  );

  assert.equal(result.target.disposition, "revalidated-unchanged-exact-revision");
  assert.equal(result.target.previousSnapshotDate, "2026-08-24");
  assert.equal(result.target.effectiveSnapshotDate, "2026-08-25");
  assert.equal(result.assessmentFreshnessChanged, true);
  assert.equal(result.presentationFreshnessChanged, true);
  assert.deepEqual(result.evidenceFreshness.assessment.snapshotDates, ["2026-08-24", "2026-08-25"]);
  assert.deepEqual(result.evidenceFreshness.portfolioPresentation.snapshotDates, ["2026-08-24", "2026-08-25"]);

  const byKey = new Map(result.sourceDiagnostics.map((entry) => [entry.repositoryKey, entry]));
  assert.equal(byKey.get("example/alpha").effectiveSnapshotDate, "2026-08-25");
  assert.equal(byKey.get("example/beta").effectiveSnapshotDate, "2026-08-24");
  assert.equal(byKey.get("example/gamma").effectiveSnapshotDate, "2026-08-24");
  assert.equal(byKey.get("example/alpha").revalidation.disposition, "revalidated-unchanged-exact-revision");
  assert.equal(byKey.get("example/beta").revalidation, undefined);
  assert.equal(byKey.get("example/gamma").revalidation, undefined);
});

test("revalidating a presentation-ineligible source changes assessment freshness without leaking into portfolio freshness", () => {
  const result = applyBoundedEvidenceRevalidation(
    syntheticSources(),
    request("example/gamma", "gamma", {
      status: "available",
      snapshotDate: "2026-08-25",
      revision: revC,
    }),
  );

  assert.equal(result.target.presentationExpected, "unavailable");
  assert.equal(result.target.disposition, "revalidated-unchanged-exact-revision");
  assert.equal(result.assessmentFreshnessChanged, true);
  assert.equal(result.presentationFreshnessChanged, false);
  assert.deepEqual(result.evidenceFreshness.assessment.snapshotDates, ["2026-08-24", "2026-08-25"]);
  assert.deepEqual(result.evidenceFreshness.portfolioPresentation.snapshotDates, ["2026-08-24"]);
});

test("a changed observed revision cannot launder old Quality evidence into a newer freshness date", () => {
  const result = applyBoundedEvidenceRevalidation(
    syntheticSources(),
    request("example/alpha", "alpha", {
      status: "available",
      snapshotDate: "2026-08-25",
      revision: "dddddddddddddddddddddddddddddddddddddddd",
    }),
  );

  assert.equal(result.target.disposition, "requires-recalibration");
  assert.equal(result.target.effectiveSnapshotDate, "2026-08-24");
  assert.equal(result.assessmentFreshnessChanged, false);
  assert.equal(result.presentationFreshnessChanged, false);
  assert.deepEqual(result.evidenceFreshness.assessment.snapshotDates, ["2026-08-24"]);
  assert.equal(result.invariants.changedRevisionRequiresRecalibration, true);
  assert.equal(result.invariants.qualityInterpretationChanged, false);
});

test("missing calibrated revision fails closed instead of inferring revision identity from evidence text", () => {
  const sources = syntheticSources();
  sources[1].calibratedRevision = null;
  const result = applyBoundedEvidenceRevalidation(
    sources,
    request("example/beta", "beta", {
      status: "available",
      snapshotDate: "2026-08-25",
      revision: revB,
    }),
  );

  assert.equal(result.target.disposition, "requires-calibration-revision");
  assert.equal(result.target.effectiveSnapshotDate, "2026-08-24");
  assert.equal(result.assessmentFreshnessChanged, false);
  assert.equal(result.presentationFreshnessChanged, false);
});

test("temporarily unavailable source retains its last frozen snapshot and remains fail-open", () => {
  const result = applyBoundedEvidenceRevalidation(
    syntheticSources(),
    request("example/alpha", "alpha", { status: "unavailable" }),
  );

  assert.equal(result.target.disposition, "source-unavailable-retain-frozen");
  assert.equal(result.target.effectiveSnapshotDate, "2026-08-24");
  assert.equal(result.assessmentFreshnessChanged, false);
  assert.equal(result.presentationFreshnessChanged, false);
  assert.equal(result.invariants.unavailableSourceRetainsFrozenSnapshot, true);
});

test("revalidation request is single-target, identity-bound and cannot move freshness backwards or into the future", () => {
  const sources = syntheticSources();
  assert.throws(
    () => applyBoundedEvidenceRevalidation(sources, request("example/missing", "missing", { status: "unavailable" })),
    /target is not selected/,
  );
  assert.throws(
    () => applyBoundedEvidenceRevalidation(sources, request("example/alpha", "beta", { status: "unavailable" })),
    /case mismatch/,
  );
  assert.throws(
    () => applyBoundedEvidenceRevalidation(sources, request("example/alpha", "alpha", {
      status: "available",
      snapshotDate: "2026-08-23",
      revision: revA,
    })),
    /cannot move backwards/,
  );
  assert.throws(
    () => applyBoundedEvidenceRevalidation(sources, request("example/alpha", "alpha", {
      status: "available",
      snapshotDate: "2026-08-26",
      revision: revA,
    })),
    /cannot be later than observedAt/,
  );
});

test("real AntiFullbright re-observation matches the frozen exact revision without changing Quality interpretation", () => {
  const loaded = loadBoundedQualityEnrichments(manifest, { manifestPath });
  const antiSource = loaded.sourceDiagnostics.find((entry) => entry.repositoryKey === "nekomario28/antifullbright");
  const ipmSource = loaded.sourceDiagnostics.find((entry) => entry.repositoryKey === "nekomario28/interactive-project-map");
  const ftbSource = loaded.sourceDiagnostics.find((entry) => entry.repositoryKey === "nekomario28/ftbpublicclaims");
  const buyclaimSource = loaded.sourceDiagnostics.find((entry) => entry.repositoryKey === "nekomario28/buyclaimchunks");
  const freetokenSource = loaded.sourceDiagnostics.find((entry) => entry.repositoryKey === "nekomario28/freetoken");
  const offhandSource = loaded.sourceDiagnostics.find((entry) => entry.repositoryKey === "nekomario28/offhandcombat");
  assert.equal(antiSource.calibratedRevision, "154bd1a1085412ca7a5abe797abf253a43dd29a8");
  assert.equal(ipmSource.calibratedRevision, null);
  assert.equal(ftbSource.calibratedRevision, "8caaab65266a94e7bdedc6ad2f66030c7e394edf");
  assert.equal(ftbSource.fixtureSnapshotDate, "2026-08-25");
  assert.equal(ftbSource.presentationExpected, "available");
  assert.equal(buyclaimSource.calibratedRevision, "22d7adcbe5f711a3bc7e2cb8593c60e19838dce1");
  assert.equal(buyclaimSource.fixtureSnapshotDate, "2026-07-25");
  assert.equal(freetokenSource.calibratedRevision, "b2c0f162ae74c22898fb61b7369b4d7a3474bbfa");
  assert.equal(freetokenSource.fixtureSnapshotDate, "2026-08-24");
  assert.equal(freetokenSource.presentationExpected, "available");
  assert.equal(freetokenSource.qualityAttributionScope, "local-delta");
  assert.equal(offhandSource.calibratedRevision, "317c2ec2e40325d8dd41f6dc5e730e95c97ae7e1");
  assert.equal(offhandSource.fixtureSnapshotDate, "2026-08-04");
  assert.equal(offhandSource.presentationExpected, "available");
  assert.equal(offhandSource.qualityAttributionScope, "local-delta");

  const candidate = applyBoundedEvidenceRevalidation(loaded.sourceDiagnostics, antifullbrightObservation);
  assert.equal(candidate.target.disposition, "revalidated-unchanged-exact-revision");
  assert.equal(candidate.target.previousSnapshotDate, "2026-08-25");
  assert.equal(candidate.target.effectiveSnapshotDate, "2026-08-25");
  assert.equal(candidate.assessmentFreshnessChanged, false);
  assert.equal(candidate.presentationFreshnessChanged, false);
  assert.deepEqual(candidate.evidenceFreshness.assessment.snapshotDates, ["2026-07-25", "2026-08-04", "2026-08-24", "2026-08-25"]);
  assert.deepEqual(candidate.evidenceFreshness.portfolioPresentation.snapshotDates, ["2026-07-25", "2026-08-04", "2026-08-24", "2026-08-25"]);

  const baseline = buildLiveQualitySidecarCandidates(live.graph, { generatorRevision });
  const revalidated = buildLiveQualitySidecarCandidates(live.graph, {
    generatorRevision,
    revalidationRequest: antifullbrightObservation,
  });

  assert.deepEqual(revalidated.assessment, baseline.assessment);
  assert.equal(revalidated.presentation.diagnostics.available, 8);
  assert.equal(revalidated.presentation.diagnostics.unavailable, 7);
  assert.equal(revalidated.diagnostics.revalidation.target.disposition, "revalidated-unchanged-exact-revision");
  assert.equal(revalidated.diagnostics.invariants.automaticEvidenceRefreshPerformed, false);
  assert.equal(revalidated.diagnostics.invariants.explicitBoundedRevalidationPerformed, true);
  assert.equal(revalidated.diagnostics.invariants.revalidationChangesQualityInterpretation, false);

  for (const baselineEntry of baseline.presentation.repositories) {
    const current = revalidated.presentation.repositories.find((entry) => entry.repositoryKey === baselineEntry.repositoryKey);
    assert.equal(current.overlayState, baselineEntry.overlayState);
    assert.deepEqual(current.overlay, baselineEntry.overlay);
    assert.deepEqual(current.views, baselineEntry.views);
    assert.deepEqual(current.visualPolicy, baselineEntry.visualPolicy);
  }

  const anti = revalidated.presentation.repositories.find((entry) => entry.repositoryKey === "nekomario28/antifullbright");
  assert.equal(anti.evidenceFreshness.snapshotDate, "2026-08-25");
  assert.equal(anti.evidenceFreshness.revalidatedAt, "2026-08-25T06:20:00.000Z");
  assert.equal(anti.evidenceFreshness.observedRevision, "154bd1a1085412ca7a5abe797abf253a43dd29a8");

  const ftb = revalidated.presentation.repositories.find((entry) => entry.repositoryKey === "nekomario28/ftbpublicclaims");
  assert.equal(ftb.overlayState, "available");
  assert.equal(ftb.evidenceFreshness.snapshotDate, "2026-08-25");
  assert.equal(ftb.evidenceFreshness.revalidatedAt, undefined);
  assert.equal(ftb.evidenceFreshness.observedRevision, undefined);

  const buyclaim = revalidated.presentation.repositories.find((entry) => entry.repositoryKey === "nekomario28/buyclaimchunks");
  assert.equal(buyclaim.overlayState, "available");
  assert.equal(buyclaim.evidenceFreshness.snapshotDate, "2026-07-25");
  assert.equal(buyclaim.evidenceFreshness.revalidatedAt, undefined);
  assert.equal(buyclaim.evidenceFreshness.observedRevision, undefined);

  const freetoken = revalidated.presentation.repositories.find((entry) => entry.repositoryKey === "nekomario28/freetoken");
  assert.equal(freetoken.overlayState, "available");
  assert.equal(freetoken.qualityAttributionScope, "local-delta");
  assert.equal(freetoken.evidenceFreshness.snapshotDate, "2026-08-24");
  assert.equal(freetoken.evidenceFreshness.revalidatedAt, undefined);
  assert.equal(freetoken.evidenceFreshness.observedRevision, undefined);

  const offhand = revalidated.presentation.repositories.find((entry) => entry.repositoryKey === "nekomario28/offhandcombat");
  assert.equal(offhand.overlayState, "available");
  assert.equal(offhand.qualityAttributionScope, "local-delta");
  assert.equal(offhand.evidenceFreshness.snapshotDate, "2026-08-04");
  assert.equal(offhand.evidenceFreshness.revalidatedAt, undefined);
  assert.equal(offhand.evidenceFreshness.observedRevision, undefined);

  const otherAvailable = revalidated.presentation.repositories.filter(
    (entry) => entry.overlayState === "available" && entry.repositoryKey !== "nekomario28/antifullbright",
  );
  assert.ok(otherAvailable.every((entry) => entry.evidenceFreshness.revalidatedAt == null));
  assert.ok(otherAvailable.every((entry) => entry.evidenceFreshness.observedRevision == null));
});

test("normal live and CLI-facing path remains non-revalidating by default", () => {
  const result = buildLiveQualitySidecarCandidates(live.graph, { generatorRevision });
  assert.equal(result.diagnostics.revalidation, null);
  assert.equal(result.diagnostics.invariants.explicitBoundedRevalidationPerformed, false);
  assert.equal(result.diagnostics.invariants.automaticEvidenceRefreshPerformed, false);
  assert.equal(result.presentation.status, "experimental-non-default");
  const anti = result.presentation.repositories.find((entry) => entry.repositoryKey === "nekomario28/antifullbright");
  assert.equal(anti.evidenceFreshness.revalidatedAt, undefined);
  assert.equal(anti.evidenceFreshness.observedRevision, undefined);
});
