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

test("bounded Quality enrichment keeps live membership 15 -> 15 while fork attribution yields three portfolio overlays", () => {
  const result = runLiveProjection();

  assert.equal(result.assessment.repositories.length, 15);
  assert.equal(result.diagnostics.assessment.quality.repositoriesBefore, 15);
  assert.equal(result.diagnostics.assessment.quality.repositoriesAfter, 15);
  assert.equal(result.diagnostics.assessment.quality.requested, 4);
  assert.equal(result.diagnostics.assessment.quality.applied, 4);
  assert.equal(result.diagnostics.assessment.quality.partial, 4);

  assert.equal(result.presentation.repositories.length, 15);
  assert.equal(result.presentation.repositories.filter((entry) => entry.overlayState === "available").length, 3);
  assert.equal(result.presentation.repositories.filter((entry) => entry.overlayState === "unavailable").length, 12);
  assert.equal(result.diagnostics.expectedPresentationAvailable, 3);
});

test("current-profile Quality overlay summaries use local-delta-only scope for forks", () => {
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
});

test("Quality enrichment does not smuggle L1 relation knowledge into the live L0 sidecar", () => {
  const result = runLiveProjection();
  const byKey = new Map(result.assessment.repositories.map((entry) => [entry.identity.repositoryKey, entry]));

  assert.deepEqual(byKey.get("nekomario28/projexd_group10").context.relation, {
    ownership: "owned",
    collaboration: "unknown",
    lineage: "original",
  });
  assert.deepEqual(byKey.get("nekomario28/gz-sim").context.relation, {
    ownership: "owned",
    collaboration: "unknown",
    lineage: "fork",
  });
  assert.deepEqual(byKey.get("nekomario28/turing-smart-screen-python-owl").context.relation, {
    ownership: "owned",
    collaboration: "unknown",
    lineage: "fork",
  });
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
