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
const calibration = readJson("fixtures/repository-fork-quality-sable-calibration.v1.json");
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

test("sable calibration binds current default main while preserving tested-code provenance", () => {
  assert.equal(calibration.snapshotDate, "2026-08-21");
  assert.equal(calibration.calibrationObservedAt, "2026-08-25");
  assert.equal(entry.revision, "14397866926b06770da05c0c0304fae32d6e26b7");
  assert.equal(entry.upstream.revision, "6966d2928340de7631abcecf8549904b877df0a8");
  assert.equal(entry.upstream.mergeBaseRevision, "8ec2afab2253a2e2a6854cbef1ea815551cb4c88");
  assert.equal(entry.carrier.validatedRevision, "d15a5ddccae399ae1e46cceea70c3e80e3111406");
  assert.equal(entry.carrier.validatedMergeRevision, "069d88fdceee399827e2eab0b3652c11a83c9e65");
  assert.equal(entry.carrier.validatedTree, "d96d98dcf1df8d870d6f33483c92b2c6daa94964");
  assert.deepEqual(entry.carrier.currentDeltaFromValidatedMerge, ["AGENTS.md"]);

  const authority = evaluateEvidenceCarrierAuthority(entry);
  assert.equal(authority.declared, true);
  assert.equal(authority.authorityScope, "repository-default-branch");
  assert.equal(authority.branch, "main");
  assert.equal(authority.defaultBranch, "main");
  assert.equal(authority.liveAdmissionAllowed, true);
  assert.deepEqual(authority.reasonCodes, []);
});

test("sable portfolio Quality uses only local fork evidence", () => {
  const bundle = build();
  const selected = selectForkPortfolioQualityVector(bundle);

  assert.equal(bundle.contractId, calibration.forkQualityContractId);
  assert.equal(bundle.relation.lineage, "fork");
  assert.equal(bundle.upstreamContext.repositoryKey, "ryanhcode/sable");
  assert.equal(bundle.snapshotQuality.personSideEligible, false);
  assert.equal(bundle.localDelta.observation.state, "observed");
  assert.equal(bundle.localDelta.observation.presence, "present");
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

test("sable game-mod target coverage stays 5/6 with optional Security/Safety", () => {
  const quality = selectForkPortfolioQualityVector(build()).value;
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

test("sable verification does not claim current-default direct Actions execution", () => {
  const quality = selectForkPortfolioQualityVector(build()).value;
  const verification = quality.dimensions.verification.evidence.map((item) => item.claim).join(" ");
  const sourceIds = quality.dimensions.verification.evidence.map((item) => item.sourceId).join(" ");

  assert.match(sourceIds, /32501210866/);
  assert.match(sourceIds, /32501210848/);
  assert.match(sourceIds, /d15a5ddccae399ae1e46cceea70c3e80e3111406/);
  assert.match(sourceIds, /d96d98dcf1df8d870d6f33483c92b2c6daa94964/);
  assert.match(verification, /current default main differs.*only by adding AGENTS\.md/);
  assert.match(verification, /not a claim that Actions directly executed current commit/);
  assert.equal(entry.claimBoundaries.currentDefaultCommitDirectActionsExecution, "not-observed");
  assert.equal(entry.claimBoundaries.evidenceFreshness, "2026-08-21");
});

test("sable calibration excludes upstream and open PR 84 personal credit", () => {
  const quality = selectForkPortfolioQualityVector(build()).value;

  assert.equal(entry.claimBoundaries.qualityAttribution, "local-delta-only");
  assert.equal(entry.claimBoundaries.upstreamQualityPersonalCredit, "excluded");
  assert.equal(entry.claimBoundaries.openPr84Evidence, "excluded");
  assert.equal(entry.claimBoundaries.byteIdenticalNativeRebuild, "not-verified");
  assert.equal(entry.claimBoundaries.fullReconstructionCommitPath, "not-claimed");
  assert.equal(quality.compositeQualityScore, null);
  assert.equal(Object.hasOwn(entry.localDeltaEvidence, "stars"), false);
  assert.equal(Object.hasOwn(entry.localDeltaEvidence, "forks"), false);
  assert.equal(Object.hasOwn(entry.localDeltaEvidence, "recentCommitActivity"), false);
});
