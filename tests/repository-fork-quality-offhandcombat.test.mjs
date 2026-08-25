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
const calibration = readJson("fixtures/repository-fork-quality-offhandcombat-calibration.v1.json");
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

test("OffHandCombat calibration binds current default authority through an identical validated tree", () => {
  assert.equal(calibration.snapshotDate, "2026-08-04");
  assert.equal(calibration.calibrationObservedAt, "2026-08-25");
  assert.equal(entry.revision, "317c2ec2e40325d8dd41f6dc5e730e95c97ae7e1");
  assert.equal(entry.upstream.revision, "e7df3ad2eec858407dd371cdfde574b35d0322c4");
  assert.equal(entry.carrier.validatedRevision, "5633ab1e6d4482a015192e81b8b7c7789537dd63");
  assert.equal(entry.carrier.currentDefaultTree, "a5b60f6c9af607be5ecba3d678a0e4bb665cb7a7");
  assert.equal(entry.carrier.validatedTree, entry.carrier.currentDefaultTree);
  assert.equal(entry.carrier.equivalenceBasis, "identical-git-tree");

  const authority = evaluateEvidenceCarrierAuthority(entry);
  assert.equal(authority.declared, true);
  assert.equal(authority.authorityScope, "repository-default-branch");
  assert.equal(authority.branch, "master");
  assert.equal(authority.defaultBranch, "master");
  assert.equal(authority.liveAdmissionAllowed, true);
  assert.deepEqual(authority.reasonCodes, []);
});

test("OffHandCombat portfolio Quality uses only the observed local fork delta", () => {
  const bundle = build();
  const selected = selectForkPortfolioQualityVector(bundle);

  assert.equal(bundle.contractId, calibration.forkQualityContractId);
  assert.equal(bundle.relation.lineage, "fork");
  assert.equal(bundle.upstreamContext.repositoryKey, "bunnycinnamon/offhandcombat");
  assert.equal(bundle.snapshotQuality.evidenceOriginState, entry.expected.snapshotOrigin);
  assert.equal(bundle.snapshotQuality.personSideEligible, false);
  assert.equal(bundle.localDelta.observation.state, "observed");
  assert.equal(bundle.localDelta.observation.presence, "present");
  assert.equal(bundle.localDelta.quality.state, entry.expected.localDeltaQualityState);
  assert.equal(bundle.localDelta.evidenceOriginState, "local");
  assert.equal(bundle.personalAttribution.qualitySource, "local-delta-only");
  assert.equal(bundle.personalAttribution.upstreamInheritedEvidenceEligible, false);
  assert.equal(selected.state, "available");
  assert.equal(selected.value.compositeQualityScore, null);

  for (const dimension of entry.expected.localDeltaSupports) {
    assert.equal(selected.value.dimensions[dimension].findingState, "supports", dimension);
    assert.equal(selected.value.dimensions[dimension].evidenceState, "observed", dimension);
  }

  assert.equal(selected.value.dimensions.maintainability.findingState, "unknown");
  assert.equal(selected.value.dimensions.maintainability.evidenceState, "unknown");
  assert.equal(selected.value.dimensions["security-safety"].applicability, "optional");
});

test("OffHandCombat game-mod target coverage stays 5/6 with optional Security/Safety", () => {
  const selected = selectForkPortfolioQualityVector(build());
  const quality = selected.value;
  const target = Object.values(quality.dimensions).filter((dimension) => (
    dimension.applicability === "required" || dimension.applicability === "recommended"
  ));
  const inspected = target.filter((dimension) => dimension.evidenceState === "observed");

  assert.equal(target.length, 6);
  assert.equal(inspected.length, 5);
  assert.equal(quality.dimensions.understandability.findingState, "supports");
  assert.equal(quality.dimensions.verification.findingState, "supports");
  assert.equal(quality.dimensions.reproducibility.findingState, "supports");
  assert.equal(quality.dimensions.maintainability.findingState, "unknown");
  assert.equal(quality.dimensions.interoperability.findingState, "supports");
  assert.equal(quality.dimensions.stewardship.findingState, "supports");
  assert.equal(quality.dimensions["security-safety"].applicability, "optional");
  assert.equal(quality.dimensions["security-safety"].findingState, "supports");
});

test("OffHandCombat verification keeps commit identity distinct from identical-tree content equivalence", () => {
  const selected = selectForkPortfolioQualityVector(build());
  const verification = selected.value.dimensions.verification.evidence.map((item) => item.claim).join(" ");
  const sourceIds = selected.value.dimensions.verification.evidence.map((item) => item.sourceId).join(" ");

  assert.match(sourceIds, /30934082130/);
  assert.match(sourceIds, /5633ab1e6d4482a015192e81b8b7c7789537dd63/);
  assert.match(sourceIds, /a5b60f6c9af607be5ecba3d678a0e4bb665cb7a7/);
  assert.match(verification, /identical Git tree/);
  assert.match(verification, /not a claim that Actions directly executed current merge commit/);
  assert.equal(entry.claimBoundaries.currentDefaultCommitDirectActionsExecution, "not-observed");
  assert.equal(entry.claimBoundaries.validatedCarrierCurrentDefaultEquivalence, "identical-git-tree");
  assert.equal(entry.claimBoundaries.evidenceFreshness, "2026-08-04");
});

test("OffHandCombat calibration excludes upstream personal credit and broad proxy claims", () => {
  const selected = selectForkPortfolioQualityVector(build());

  assert.equal(entry.claimBoundaries.qualityAttribution, "local-delta-only");
  assert.equal(entry.claimBoundaries.upstreamQualityPersonalCredit, "excluded");
  assert.equal(entry.claimBoundaries.byteIdenticalRebuild, "not-verified");
  assert.equal(entry.claimBoundaries.releasePublication, "not-claimed");
  assert.equal(selected.value.compositeQualityScore, null);
  assert.equal(Object.hasOwn(entry.localDeltaEvidence, "stars"), false);
  assert.equal(Object.hasOwn(entry.localDeltaEvidence, "forks"), false);
  assert.equal(Object.hasOwn(entry.localDeltaEvidence, "releaseCount"), false);
  assert.equal(Object.hasOwn(entry.localDeltaEvidence, "recentCommitActivity"), false);
});
