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
const calibration = readJson("fixtures/repository-fork-quality-buyclaimchunks-calibration.v1.json");
const entry = calibration.cases[0];

function build() {
  return buildForkQualityBundle(policy, {
    relation: entry.context.relation,
    artifacts: entry.context.artifacts,
    upstream: entry.upstream,
    snapshotEvidence: entry.snapshotEvidence,
    localDeltaObservation: entry.localDeltaObservation,
    localDeltaEvidence: entry.localDeltaEvidence,
    localDeltaApplicability: entry.localDeltaApplicability,
  });
}

test("BuyClaimChunks calibration binds exact default-main carrier authority", () => {
  assert.equal(calibration.snapshotDate, "2026-07-25");
  assert.equal(calibration.calibrationObservedAt, "2026-08-25");
  assert.equal(entry.revision, "22d7adcbe5f711a3bc7e2cb8593c60e19838dce1");
  assert.equal(entry.upstream.revision, "3ff3da62fd8addf319165d8018d1b795be7f5187");

  const authority = evaluateEvidenceCarrierAuthority(entry);
  assert.equal(authority.declared, true);
  assert.equal(authority.authorityScope, "repository-default-branch");
  assert.equal(authority.branch, "main");
  assert.equal(authority.defaultBranch, "main");
  assert.equal(authority.liveAdmissionAllowed, true);
  assert.deepEqual(authority.reasonCodes, []);
});

test("BuyClaimChunks portfolio Quality uses only the observed local fork delta", () => {
  const bundle = build();
  const selected = selectForkPortfolioQualityVector(bundle);

  assert.equal(bundle.contractId, calibration.forkQualityContractId);
  assert.equal(bundle.relation.lineage, "fork");
  assert.equal(bundle.upstreamContext.repositoryKey, "skyadri-mc/buyclaimchunks");
  assert.equal(bundle.snapshotQuality.evidenceOriginState, entry.expected.snapshotOrigin);
  assert.equal(bundle.snapshotQuality.personSideEligible, false);
  assert.equal(bundle.localDelta.observation.state, "observed");
  assert.equal(bundle.localDelta.observation.presence, "present");
  assert.equal(bundle.localDelta.quality.state, entry.expected.localDeltaQualityState);
  assert.equal(bundle.localDelta.evidenceOriginState, "local");
  assert.equal(bundle.personalAttribution.qualitySource, "local-delta-only");
  assert.equal(bundle.personalAttribution.upstreamInheritedEvidenceEligible, false);
  assert.equal(selected.state, "available");
  assert.equal(selected.value.compositeQualityScore, entry.expected.compositeQualityScore);

  for (const dimension of entry.expected.localDeltaSupports) {
    assert.equal(selected.value.dimensions[dimension].findingState, "supports", dimension);
    assert.equal(selected.value.dimensions[dimension].evidenceState, "observed", dimension);
  }

  assert.equal(selected.value.dimensions.maintainability.findingState, entry.expected.localDeltaMaintainability);
  assert.equal(selected.value.dimensions.maintainability.evidenceState, "unknown");
  assert.equal(selected.value.dimensions["security-safety"].applicability, entry.expected.securitySafetyApplicability);
});

test("BuyClaimChunks calibration excludes upstream Quality and the unmerged OpenPAC feature carrier", () => {
  const bundle = build();
  const selected = selectForkPortfolioQualityVector(bundle);

  assert.equal(entry.claimBoundaries.qualityAttribution, "local-delta-only");
  assert.equal(entry.claimBoundaries.upstreamQualityPersonalCredit, "excluded");
  assert.equal(entry.claimBoundaries.futureOpenPacFeaturePr, "excluded");
  assert.equal(entry.claimBoundaries.byteIdenticalRebuild, "not-verified");
  assert.equal(entry.claimBoundaries.releasePublication, "not-claimed");
  assert.equal(bundle.snapshotQuality.evidenceOriginCounts["upstream-inherited"], 0);
  assert.equal(selected.value.dimensions.verification.evidence.length, 2);
  assert.equal(selected.value.dimensions.reproducibility.evidence.length, 2);
});
