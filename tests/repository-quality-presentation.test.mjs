import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildRepositoryAssessmentCandidate } from "../scripts/repository-assessment-candidate.mjs";
import { buildForkQualityBundle } from "../scripts/repository-fork-quality.mjs";
import { buildQualityEvidenceVector } from "../scripts/repository-quality-evidence.mjs";
import {
  buildRepositoryQualityPresentationModel,
  selectRepositoryQualityPresentation,
} from "../scripts/repository-quality-presentation.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

const policy = readJson("data/repository-assessment-policy.v1.json");
const live = readJson("fixtures/repository-assessment-live-profile-minimal-2026-08-25.json");
const applications = readJson("fixtures/repository-quality-real-calibration.v1.json");
const forks = readJson("fixtures/repository-fork-quality-provenance-calibration.v1.json");
const generatorRevision = "0b4caf1dcdd2f67fe35f772afce45b8782112209";

function app(id) {
  return applications.cases.find((entry) => entry.id === id);
}

function fork(idPart) {
  return forks.cases.find((entry) => entry.id.includes(idPart));
}

function quality(artifacts, evidence) {
  return buildQualityEvidenceVector(policy, { artifacts, evidence });
}

function forkQuality(entry) {
  return buildForkQualityBundle(policy, {
    relation: entry.context.relation,
    artifacts: entry.context.artifacts,
    upstream: entry.upstream,
    snapshotEvidence: entry.snapshotEvidence,
    localDeltaObservation: entry.localDeltaObservation,
    localDeltaEvidence: entry.localDeltaEvidence,
  });
}

function enrichments() {
  const ipm = app("interactive-project-map-application");
  const group10 = app("projexd-group10-application");
  const gz = fork("gz-sim");
  const turing = fork("turing");
  return [
    { repositoryKey: "nekomario28/interactive-project-map", state: "partial", value: quality(ipm.context.artifacts, ipm.evidence) },
    { repositoryKey: "nekomario28/projexd_group10", state: "partial", value: quality(group10.context.artifacts, group10.evidence) },
    { repositoryKey: "nekomario28/gz-sim", state: "partial", value: forkQuality(gz) },
    { repositoryKey: "nekomario28/turing-smart-screen-python-owl", state: "partial", value: forkQuality(turing) },
  ];
}

function candidate() {
  return buildRepositoryAssessmentCandidate(live.graph, {
    generatorRevision,
    qualityEnrichments: enrichments(),
  }).artifact;
}

test("current-profile Quality presentation joins graph and assessment 15/15 with three attribution-safe overlays", () => {
  const model = buildRepositoryQualityPresentationModel(policy, live.graph, candidate());

  assert.equal(model.status, "experimental-non-default");
  assert.equal(model.repositories.length, 15);
  assert.deepEqual(model.diagnostics, {
    graphRepositories: 15,
    assessmentRepositories: 15,
    joinedRepositories: 15,
    available: 3,
    unavailable: 12,
    missingAssessmentGraphNodeIds: [],
    orphanAssessmentGraphNodeIds: [],
    strictJoin: true,
  });
  assert.equal(model.modePolicy.defaultProductModeRemains, "structure");
  assert.equal(model.modePolicy.forkPortfolioQualityUses, "local-delta-only");
  assert.equal(model.modePolicy.qualityChangesNodeSize, false);
  assert.equal(model.modePolicy.qualityChangesPlacement, false);
  assert.equal(model.modePolicy.qualityChangesLabelPriority, false);
  assert.equal(model.modePolicy.qualityChangesImpactHalo, false);
});

test("available non-fork Quality exposes repository-snapshot scope", () => {
  const model = buildRepositoryQualityPresentationModel(policy, live.graph, candidate());
  const ipm = model.repositories.find((entry) => entry.repositoryKey === "nekomario28/interactive-project-map");

  assert.equal(ipm.overlayState, "available");
  assert.equal(ipm.qualityAttributionScope, "repository-snapshot");
  assert.equal(ipm.views.detail.mode, "full-fixed-dimension-ring");
  assert.equal(ipm.views.detail.dimensionIdentityPreserved, true);
  assert.equal(ipm.views.detail.segments.length, 8);
  assert.equal(ipm.views.detail.coverage.label, "4/6 interpreted");
  assert.equal(ipm.views.compact.mode, "target-finding-distribution");
  assert.equal(ipm.views.compact.dimensionIdentityPreserved, false);
  assert.equal(ipm.views.compact.requiresDetailForDimensionIdentity, true);
  assert.equal(ipm.overlay.compositeQualityScore, null);

  assert.deepEqual(selectRepositoryQualityPresentation(ipm, "detail"), ipm.views.detail);
  assert.deepEqual(selectRepositoryQualityPresentation(ipm, "compact"), ipm.views.compact);
});

test("fork presentation exposes only local-delta Quality and leaves inherited-only fork unavailable", () => {
  const model = buildRepositoryQualityPresentationModel(policy, live.graph, candidate());
  const gz = model.repositories.find((entry) => entry.repositoryKey === "nekomario28/gz-sim");
  const turing = model.repositories.find((entry) => entry.repositoryKey === "nekomario28/turing-smart-screen-python-owl");

  assert.equal(gz.qualityAttributionScope, "local-delta");
  assert.equal(gz.overlayState, "unavailable");
  assert.equal(gz.unavailableReason, "no-local-delta-observed-in-comparison-scope");

  assert.equal(turing.qualityAttributionScope, "local-delta");
  assert.equal(turing.overlayState, "available");
  assert.equal(turing.views.detail.segments.find((segment) => segment.id === "understandability").findingState, "supports");
  assert.equal(turing.views.detail.segments.find((segment) => segment.id === "reproducibility").findingState, "supports");
  assert.equal(turing.views.detail.segments.find((segment) => segment.id === "stewardship").findingState, "unknown");
});

test("unassessed repositories remain explicit unavailable presentations instead of synthetic unknown rings", () => {
  const model = buildRepositoryQualityPresentationModel(policy, live.graph, candidate());
  const ftb = model.repositories.find((entry) => entry.repositoryKey === "nekomario28/ftbpublicclaims");

  assert.equal(ftb.qualitySectionState, "not-collected");
  assert.equal(ftb.qualityAttributionScope, null);
  assert.equal(ftb.overlayState, "unavailable");
  assert.equal(ftb.overlay, null);
  assert.deepEqual(ftb.views.detail, {
    mode: "unavailable",
    token: "quality-unavailable",
    reason: "not-collected",
    compositeQualityScore: null,
    dimensionIdentityPreserved: false,
  });
  assert.deepEqual(ftb.views.compact, ftb.views.detail);
  assert.deepEqual(selectRepositoryQualityPresentation(ftb, "compact"), ftb.views.compact);
});

test("presentation model keeps project layout and prominence channels outside Quality authority", () => {
  const model = buildRepositoryQualityPresentationModel(policy, live.graph, candidate());
  for (const entry of model.repositories) {
    assert.deepEqual(entry.visualPolicy, {
      repositoryCore: "inherit-structure-renderer",
      placementEffect: "none",
      nodeSizeEffect: "none",
      labelPriorityEffect: "none",
      impactHaloEffect: "none",
    });
  }
  assert.equal(model.invariants.forkPortfolioQualityUsesLocalDeltaOnly, true);
  assert.equal(model.invariants.forkSnapshotQualityDoesNotBecomePersonalQualityRing, true);
  assert.equal(model.invariants.productionRankingAllowed, false);
});

test("strict presentation join fails closed when graph membership and assessment membership diverge", () => {
  const assessment = candidate();
  const graph = structuredClone(live.graph);
  graph.nodes = graph.nodes.filter((node) => node.id !== "repository:FTBPublicClaims");

  assert.throws(
    () => buildRepositoryQualityPresentationModel(policy, graph, assessment),
    /Quality presentation join mismatch: missing=0 orphan=1/,
  );

  const nonStrict = buildRepositoryQualityPresentationModel(policy, graph, assessment, { strictJoin: false });
  assert.equal(nonStrict.diagnostics.joinedRepositories, 14);
  assert.deepEqual(nonStrict.diagnostics.orphanAssessmentGraphNodeIds, ["repository:FTBPublicClaims"]);
});

test("presentation model rejects owner mismatch and unsupported view selectors", () => {
  const assessment = candidate();
  const wrongOwner = structuredClone(live.graph);
  wrongOwner.owner = "someone-else";
  assert.throws(() => buildRepositoryQualityPresentationModel(policy, wrongOwner, assessment), /owner does not match/);

  const model = buildRepositoryQualityPresentationModel(policy, live.graph, assessment);
  const ipm = model.repositories.find((entry) => entry.repositoryKey === "nekomario28/interactive-project-map");
  assert.throws(() => selectRepositoryQualityPresentation(ipm, "tiny"), /unsupported Quality presentation view/);
});
