import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateEvidenceCarrierAuthority } from "../scripts/repository-evidence-carrier-authority.mjs";
import { buildForkQualityBundle, selectForkPortfolioQualityVector } from "../scripts/repository-fork-quality.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const policy = readJson("data/repository-assessment-policy.v1.json");
const calibration = readJson("fixtures/repository-fork-quality-freetoken-calibration.v1.json");
const entry = calibration.cases[0];

function build() {
  return buildForkQualityBundle(policy, {
    relation: entry.context.relation,
    artifacts: entry.context.artifacts,
    upstream: entry.upstream,
    snapshotEvidence: entry.snapshotEvidence,
    localDeltaObservation: entry.localDeltaObservation,
    localDeltaEvidence: entry.localDeltaEvidence,
  });
}

test("FreeToken calibration binds exact fork default-main authority without borrowing current upstream state", () => {
  assert.equal(calibration.snapshotDate, "2026-08-24");
  assert.equal(calibration.calibrationObservedAt, "2026-08-25");
  assert.equal(entry.revision, "b2c0f162ae74c22898fb61b7369b4d7a3474bbfa");
  assert.equal(entry.upstream.revision, "2757bb5f91156fc8a44d88ec4b302a81f10c9e81");
  assert.equal(entry.upstream.mergeBaseRevision, "f0abe587a11cca53bb3c37a9596fad24973ace62");
  assert.equal(entry.context.category, "ai-ml");
  assert.deepEqual(entry.context.artifacts, ["application"]);

  const authority = evaluateEvidenceCarrierAuthority(entry);
  assert.equal(authority.declared, true);
  assert.equal(authority.authorityScope, "repository-default-branch");
  assert.equal(authority.branch, "main");
  assert.equal(authority.defaultBranch, "main");
  assert.equal(authority.liveAdmissionAllowed, true);
  assert.deepEqual(authority.reasonCodes, []);
});

test("FreeToken portfolio Quality uses only the observed local telemetry delta", () => {
  const bundle = build();
  const selected = selectForkPortfolioQualityVector(bundle);

  assert.equal(bundle.contractId, calibration.forkQualityContractId);
  assert.equal(bundle.relation.lineage, "fork");
  assert.equal(bundle.upstreamContext.repositoryKey, "flashml-org/freetoken");
  assert.equal(bundle.snapshotQuality.evidenceOriginState, entry.expected.snapshotOrigin);
  assert.equal(bundle.snapshotQuality.personSideEligible, false);
  assert.equal(bundle.snapshotQuality.evidenceOriginCounts["upstream-inherited"], 0);
  assert.equal(bundle.localDelta.observation.state, "observed");
  assert.equal(bundle.localDelta.observation.presence, "present");
  assert.equal(bundle.localDelta.quality.state, entry.expected.localDeltaQualityState);
  assert.equal(bundle.localDelta.evidenceOriginState, "local");
  assert.equal(bundle.personalAttribution.qualitySource, "local-delta-only");
  assert.equal(bundle.personalAttribution.upstreamInheritedEvidenceEligible, false);
  assert.equal(selected.state, "available");
  assert.equal(selected.value.compositeQualityScore, entry.expected.compositeQualityScore);

  const targetDimensions = Object.values(selected.value.dimensions).filter((dimension) => (
    dimension.applicability === "required" || dimension.applicability === "recommended"
  ));
  assert.equal(targetDimensions.length, entry.expected.targetDimensions);

  for (const dimension of entry.expected.localDeltaSupports) {
    assert.equal(selected.value.dimensions[dimension].findingState, "supports", dimension);
    assert.equal(selected.value.dimensions[dimension].evidenceState, "observed", dimension);
  }

  assert.equal(selected.value.dimensions.maintainability.findingState, entry.expected.localDeltaMaintainability);
  assert.equal(selected.value.dimensions.maintainability.evidenceState, "unknown");
  assert.equal(selected.value.dimensions["security-safety"].findingState, entry.expected.localDeltaSecuritySafety);
  assert.equal(selected.value.dimensions["security-safety"].evidenceState, "unknown");
  assert.equal(selected.value.dimensions.stewardship.findingState, entry.expected.localDeltaStewardship);
  assert.equal(selected.value.dimensions.stewardship.evidenceState, "unknown");
});

test("FreeToken calibration keeps validation and unsupported runtime claims bounded", () => {
  const selected = selectForkPortfolioQualityVector(build());

  assert.equal(entry.claimBoundaries.qualityAttribution, "local-delta-only");
  assert.equal(entry.claimBoundaries.upstreamQualityPersonalCredit, "excluded");
  assert.equal(entry.claimBoundaries.upstreamLicenseStewardshipPersonalCredit, "excluded");
  assert.equal(entry.claimBoundaries.exactHeadAutomatedActions, "none-observed");
  assert.equal(entry.claimBoundaries.fullCheckpointServeOnSupportedNvidiaCuda, "not-run");
  assert.equal(entry.claimBoundaries.rocmDeviceCheck, "counter-path-only-not-full-checkpoint-serve");
  assert.equal(entry.claimBoundaries.h2dPayloadAsMeasuredBandwidth, "excluded");
  assert.equal(entry.claimBoundaries.byteIdenticalRebuild, "not-verified");
  assert.equal(entry.claimBoundaries.releasePublication, "not-claimed");
  assert.equal(entry.claimBoundaries.liveQualityAdmission, "not-claimed-by-calibration");

  const verificationEvidence = selected.value.dimensions.verification.evidence;
  assert.equal(verificationEvidence.length, 2);
  assert.equal(verificationEvidence[0].authority, "project-owned");
  assert.match(verificationEvidence[0].sourceId, /^pull-request:nekomario28\/FreeToken#1@/);
  assert.equal(verificationEvidence[1].authority, "repository-native");
  assert.match(verificationEvidence[1].sourceId, /^tests\/server\/test_moe_stats\.py\+/);

  const reproducibilityEvidence = selected.value.dimensions.reproducibility.evidence;
  assert.equal(reproducibilityEvidence.length, 1);
  assert.equal(reproducibilityEvidence[0].authority, "project-owned");
  assert.match(reproducibilityEvidence[0].sourceId, /:validation-recipe@/);
});
