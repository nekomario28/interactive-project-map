import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildL0RepositoryAssessmentFromGraph } from "../scripts/repository-assessment-from-graph.mjs";
import { enrichAssessmentArtifactQuality } from "../scripts/repository-assessment-quality-enrichment.mjs";
import { buildQualityEvidenceVector } from "../scripts/repository-quality-evidence.mjs";
import { buildLiveQualitySidecarCandidates } from "../scripts/repository-quality-live-sidecar-candidate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

const policy = readJson("data/repository-assessment-policy.v1.json");
const live = readJson("fixtures/repository-assessment-live-profile-minimal-2026-08-25.json");
const applications = readJson("fixtures/repository-quality-real-calibration.v1.json");
const generatorRevision = "f6af4d01c8be331969a1389d9d2f1fee197a8755";

function app(id) {
  return applications.cases.find((entry) => entry.id === id);
}

function quality(artifacts, evidence) {
  return buildQualityEvidenceVector(policy, { artifacts, evidence });
}

function runLiveProjection() {
  return buildLiveQualitySidecarCandidates(live.graph, { generatorRevision });
}

test("frozen current profile projection reproduces full L0 diagnostics", () => {
  assert.equal(live.source.revision, "f86924fc5f713003dea2634748a7931169e638f1");
  assert.equal(live.source.graphGeneratedAt, "2026-08-24T18:19:46.396Z");
  assert.equal(live.graph.nodes.filter((node) => node.type === "repository").length, 15);

  const l0 = buildL0RepositoryAssessmentFromGraph(live.graph, { generatorRevision });
  assert.deepEqual(l0.diagnostics, {
    repositories: 15,
    owned: 14,
    contributed: 1,
    forks: 10,
    collaborationUnknown: 15,
    categoryObserved: 14,
    categoryUnknown: 1,
    artifactsObserved: 14,
    artifactsUnknown: 1,
    archived: 0,
    lifecycleUnknown: 15,
    impactPartial: 15,
    impactNotCollected: 0,
    personalContributionPartial: 1,
    personalContributionNotCollected: 14,
  });
});

test("bounded Quality enrichment keeps live membership 15 -> 15 while ten assessment sources yield nine portfolio overlays", () => {
  const result = runLiveProjection();

  assert.equal(result.assessment.repositories.length, 15);
  assert.equal(result.diagnostics.assessment.quality.repositoriesBefore, 15);
  assert.equal(result.diagnostics.assessment.quality.repositoriesAfter, 15);
  assert.equal(result.diagnostics.assessment.quality.requested, 10);
  assert.equal(result.diagnostics.assessment.quality.applied, 10);
  assert.equal(result.diagnostics.assessment.quality.partial, 10);

  assert.equal(result.presentation.repositories.length, 15);
  assert.equal(result.presentation.repositories.filter((entry) => entry.overlayState === "available").length, 9);
  assert.equal(result.presentation.repositories.filter((entry) => entry.overlayState === "unavailable").length, 6);
  assert.equal(result.diagnostics.expectedPresentationAvailable, 9);
});

test("current-profile Quality overlay summaries keep fork attribution safe and admit FreeToken, OffHandCombat, and Sable with bounded local-delta evidence", () => {
  const result = runLiveProjection();
  const byKey = new Map(result.presentation.repositories.map((entry) => [entry.repositoryKey, entry]));

  const ipm = byKey.get("nekomario28/interactive-project-map");
  assert.equal(ipm.qualityAttributionScope, "repository-snapshot");
  assert.equal(ipm.overlay.coverage.label, "4/6 interpreted");
  assert.equal(ipm.overlay.targetFindingCounts.supports, 4);
  assert.equal(ipm.overlay.targetFindingCounts.unknown, 2);

  const group10 = byKey.get("nekomario28/projexd_group10");
  assert.equal(group10.qualityAttributionScope, "repository-snapshot");
  assert.equal(group10.overlay.targetFindingCounts.supports, 2);
  assert.equal(group10.overlay.targetFindingCounts.weakens, 1);
  assert.equal(group10.overlay.targetFindingCounts.unknown, 3);

  const antifullbright = byKey.get("nekomario28/antifullbright");
  assert.equal(antifullbright.qualityAttributionScope, "repository-snapshot");
  assert.equal(antifullbright.overlayState, "available");
  assert.equal(antifullbright.overlay.coverage.targetDimensions, 6);
  assert.equal(antifullbright.overlay.coverage.inspectedDimensions, 5);
  assert.equal(antifullbright.overlay.targetFindingCounts.supports, 5);
  assert.equal(antifullbright.overlay.targetFindingCounts.unknown, 1);
  assert.equal(antifullbright.overlay.segments.find((segment) => segment.id === "maintainability").findingState, "unknown");
  assert.equal(antifullbright.overlay.segments.find((segment) => segment.id === "security-safety").applicability, "optional");

  const ftb = byKey.get("nekomario28/ftbpublicclaims");
  assert.equal(ftb.qualityAttributionScope, "repository-snapshot");
  assert.equal(ftb.overlayState, "available");
  assert.equal(ftb.overlay.coverage.targetDimensions, 6);
  assert.equal(ftb.overlay.coverage.inspectedDimensions, 5);
  assert.equal(ftb.overlay.targetFindingCounts.supports, 5);
  assert.equal(ftb.overlay.targetFindingCounts.unknown, 1);
  assert.equal(ftb.overlay.segments.find((segment) => segment.id === "verification").findingState, "unknown");
  assert.equal(ftb.overlay.segments.find((segment) => segment.id === "maintainability").findingState, "supports");
  const ftbSecurity = ftb.overlay.segments.find((segment) => segment.id === "security-safety");
  assert.equal(ftbSecurity.applicability, "optional");
  assert.equal(ftbSecurity.findingState, "supports");
  assert.equal(ftb.evidenceFreshness.snapshotDate, "2026-08-25");

  const gz = byKey.get("nekomario28/gz-sim");
  assert.equal(gz.qualityAttributionScope, "local-delta");
  assert.equal(gz.overlayState, "unavailable");
  assert.equal(gz.unavailableReason, "no-local-delta-observed-in-comparison-scope");

  const turing = byKey.get("nekomario28/turing-smart-screen-python-owl");
  assert.equal(turing.qualityAttributionScope, "local-delta");
  assert.equal(turing.overlayState, "available");
  assert.equal(turing.overlay.coverage.targetDimensions, 6);
  assert.equal(turing.overlay.targetFindingCounts.supports, 2);
  assert.equal(turing.overlay.targetFindingCounts.unknown, 4);

  const buyclaim = byKey.get("nekomario28/buyclaimchunks");
  assert.equal(buyclaim.qualityAttributionScope, "local-delta");
  assert.equal(buyclaim.overlayState, "available");
  assert.equal(buyclaim.overlay.coverage.targetDimensions, 6);
  assert.equal(buyclaim.overlay.coverage.inspectedDimensions, 5);
  assert.equal(buyclaim.overlay.targetFindingCounts.supports, 5);
  assert.equal(buyclaim.overlay.targetFindingCounts.unknown, 1);
  assert.equal(buyclaim.overlay.segments.find((segment) => segment.id === "maintainability").findingState, "unknown");
  const buyclaimSecurity = buyclaim.overlay.segments.find((segment) => segment.id === "security-safety");
  assert.equal(buyclaimSecurity.applicability, "optional");
  assert.equal(buyclaimSecurity.findingState, "supports");
  assert.equal(buyclaim.evidenceFreshness.snapshotDate, "2026-07-25");

  const freetoken = byKey.get("nekomario28/freetoken");
  const offhand = byKey.get("nekomario28/offhandcombat");
  const sable = byKey.get("nekomario28/sable");
  assert.equal(freetoken.qualityAttributionScope, "local-delta");
  assert.equal(freetoken.overlayState, "available");
  assert.equal(freetoken.overlay.coverage.targetDimensions, 6);
  assert.equal(freetoken.overlay.coverage.inspectedDimensions, 3);
  assert.equal(freetoken.overlay.targetFindingCounts.supports, 3);
  assert.equal(freetoken.overlay.targetFindingCounts.unknown, 3);
  for (const id of ["understandability", "verification", "reproducibility"]) {
    assert.equal(freetoken.overlay.segments.find((segment) => segment.id === id).findingState, "supports", id);
  }
  for (const id of ["maintainability", "security-safety", "stewardship"]) {
    assert.equal(freetoken.overlay.segments.find((segment) => segment.id === id).findingState, "unknown", id);
  }
  assert.equal(freetoken.evidenceFreshness.snapshotDate, "2026-08-24");

  assert.equal(offhand.qualityAttributionScope, "local-delta");
  assert.equal(offhand.overlayState, "available");
  assert.equal(offhand.overlay.coverage.targetDimensions, 6);
  assert.equal(offhand.overlay.coverage.inspectedDimensions, 5);
  assert.equal(offhand.overlay.targetFindingCounts.supports, 5);
  assert.equal(offhand.overlay.targetFindingCounts.unknown, 1);
  assert.equal(offhand.overlay.segments.find((segment) => segment.id === "maintainability").findingState, "unknown");
  const offhandSecurity = offhand.overlay.segments.find((segment) => segment.id === "security-safety");
  assert.equal(offhandSecurity.applicability, "optional");
  assert.equal(offhandSecurity.findingState, "supports");
  assert.equal(offhand.evidenceFreshness.snapshotDate, "2026-08-04");

  assert.equal(sable.qualityAttributionScope, "local-delta");
  assert.equal(sable.overlayState, "available");
  assert.equal(sable.overlay.coverage.targetDimensions, 6);
  assert.equal(sable.overlay.coverage.inspectedDimensions, 5);
  assert.equal(sable.overlay.targetFindingCounts.supports, 5);
  assert.equal(sable.overlay.targetFindingCounts.unknown, 1);
  assert.equal(sable.overlay.segments.find((segment) => segment.id === "maintainability").findingState, "unknown");
  const sableSecurity = sable.overlay.segments.find((segment) => segment.id === "security-safety");
  assert.equal(sableSecurity.applicability, "optional");
  assert.equal(sableSecurity.findingState, "supports");
  assert.equal(sable.evidenceFreshness.snapshotDate, "2026-08-21");
});

test("Quality enrichment does not smuggle L1 relation knowledge into the live L0 sidecar", () => {
  const result = runLiveProjection();
  const byKey = new Map(result.assessment.repositories.map((entry) => [entry.identity.repositoryKey, entry]));

  assert.deepEqual(byKey.get("nekomario28/antifullbright").context.relation, {
    ownership: "owned",
    collaboration: "unknown",
    lineage: "original",
  });
  assert.deepEqual(byKey.get("nekomario28/ftbpublicclaims").context.relation, {
    ownership: "owned",
    collaboration: "unknown",
    lineage: "original",
  });
  assert.deepEqual(byKey.get("nekomario28/projexd_group10").context.relation, {
    ownership: "owned",
    collaboration: "unknown",
    lineage: "original",
  });
  for (const key of [
    "nekomario28/gz-sim",
    "nekomario28/turing-smart-screen-python-owl",
    "nekomario28/buyclaimchunks",
    "nekomario28/freetoken",
    "nekomario28/offhandcombat",
    "nekomario28/sable",
  ]) {
    assert.deepEqual(byKey.get(key).context.relation, {
      ownership: "owned",
      collaboration: "unknown",
      lineage: "fork",
    });
  }
});

test("current contributed ProjExD_4 remains semantic-context unresolved and cannot be Quality-enriched through the L0 path", () => {
  const l0 = buildL0RepositoryAssessmentFromGraph(live.graph, { generatorRevision });
  const contributed = l0.artifact.repositories.find((entry) => entry.identity.repositoryKey === "c0c25034/projexd_4");

  assert.deepEqual(contributed.context.category, { state: "unknown", id: null });
  assert.deepEqual(contributed.context.artifacts, { state: "unknown", values: [] });
  assert.equal(contributed.personalContribution.state, "partial");
  assert.equal(contributed.personalContribution.value.activity.commits.raw, 1);
  assert.equal(contributed.personalContribution.value.activity.mergedPullRequests.raw, 1);

  const contributedCalibration = app("projexd4-contributed-application");
  assert.throws(
    () => enrichAssessmentArtifactQuality(policy, l0.artifact, [{
      repositoryKey: "c0c25034/projexd_4",
      value: quality(contributedCalibration.context.artifacts, contributedCalibration.evidence),
    }]),
    /cannot receive Quality while artifact context is unknown/,
  );
});

test("live profile snapshot contains no external calibration donor membership", () => {
  const result = runLiveProjection();
  assert.equal(result.assessment.repositories.some((entry) => entry.identity.repositoryKey === "fivethirtyeight/data"), false);
});
