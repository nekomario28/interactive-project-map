import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildQualityConfidenceVector } from "../scripts/repository-quality-confidence.mjs";
import { buildQualityEvidenceVector } from "../scripts/repository-quality-evidence.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const policy = readJson("data/repository-assessment-policy.v1.json");
const calibration = readJson("fixtures/repository-quality-active-carrier-game-mod-calibration.v1.json");
const manifest = readJson("data/repository-quality-live-profile-enrichment-sources.v1.json");
const subject = calibration.cases.find((entry) => entry.id === "ftbpublicclaims-neoforge-active-carrier-12c57797");

function evaluate() {
  const quality = buildQualityEvidenceVector(policy, {
    artifacts: subject.context.artifacts,
    evidence: subject.evidence,
  });
  const confidence = buildQualityConfidenceVector(policy, quality);
  return { quality, confidence };
}

test("FTBPublicClaims calibration freezes exact active-carrier authority without pretending it is default-branch production", () => {
  assert.equal(calibration.schemaVersion, 1);
  assert.equal(calibration.policyId, policy.policyId);
  assert.equal(calibration.status, "frozen-active-carrier-calibration-non-admitted");
  assert.equal(calibration.evidenceSnapshotDate, "2026-08-04");
  assert.equal(calibration.calibrationObservedAt, "2026-08-25");
  assert.equal(calibration.cases.length, 1);

  assert.equal(subject.repository, "nekomario28/FTBPublicClaims");
  assert.equal(subject.revision, "12c57797637d1903ad7f76174e6d676364a3c339");
  assert.equal(subject.context.category, "game-modding");
  assert.deepEqual(subject.context.artifacts, ["game-mod"]);
  assert.deepEqual(subject.context.relation, {
    ownership: "owned",
    collaboration: "unknown",
    lineage: "original",
  });

  assert.equal(subject.carrier.authorityScope, "active-development-carrier");
  assert.equal(subject.carrier.branch, "neoforge-1.21.1-port");
  assert.equal(subject.carrier.pullRequest, 1);
  assert.equal(subject.carrier.pullRequestState, "open-draft");
  assert.equal(subject.carrier.defaultBranch, "public-claim-context");
  assert.equal(subject.carrier.authorityMatch, false);
  assert.equal(subject.carrier.productionAdmissionEligible, false);
  assert.match(subject.carrier.admissionBlockReason, /default branch|default-branch/i);
});

test("active-carrier game-mod route keeps six target dimensions while Security/Safety stays optional", () => {
  const { quality } = evaluate();
  const targetDimensions = Object.values(quality.dimensions).filter((dimension) => (
    dimension.applicability === "required" || dimension.applicability === "recommended"
  )).length;

  assert.equal(targetDimensions, 6);
  assert.equal(quality.dimensions.understandability.applicability, "recommended");
  assert.equal(quality.dimensions.verification.applicability, "recommended");
  assert.equal(quality.dimensions.reproducibility.applicability, "recommended");
  assert.equal(quality.dimensions.maintainability.applicability, "recommended");
  assert.equal(quality.dimensions.interoperability.applicability, "recommended");
  assert.equal(quality.dimensions.stewardship.applicability, "recommended");
  assert.equal(quality.dimensions["security-safety"].applicability, "optional");
});

test("exact-head push evidence supports five target dimensions while Maintainability remains unknown", () => {
  const { quality, confidence } = evaluate();

  for (const [dimension, expected] of Object.entries(subject.expected.findings)) {
    assert.equal(quality.dimensions[dimension].findingState, expected, dimension);
  }

  assert.equal(quality.dimensions.maintainability.findingState, "unknown");
  assert.equal(quality.dimensions["security-safety"].findingState, "supports");
  assert.equal(confidence.coverage.targetDimensions, 6);
  assert.equal(confidence.coverage.inspectedDimensions, 5);
  assert.equal(confidence.coverage.directionalDimensions, 5);
  assert.equal(confidence.coverage.inspectedCoverageRatio, 5 / 6);
  assert.equal(confidence.coverage.directionalCoverageRatio, 5 / 6);
  assert.equal(quality.compositeQualityScore, null);
  assert.equal(confidence.compositeConfidenceScore, null);
});

test("verification provenance names exact-head push runs and bounds reproducibility claims", () => {
  const verificationSourceIds = subject.evidence.verification.map((entry) => entry.sourceId);
  const verificationClaims = subject.evidence.verification.map((entry) => entry.claim).join(" ");
  const reproducibilityClaims = subject.evidence.reproducibility.map((entry) => entry.claim).join(" ");

  assert.ok(verificationSourceIds.some((sourceId) => sourceId.includes("Build#194:30899049281@12c57797637d1903ad7f76174e6d676364a3c339")));
  assert.ok(verificationSourceIds.some((sourceId) => sourceId.includes("Validate-compatible-FTB-stack#19:30899049040@12c57797637d1903ad7f76174e6d676364a3c339")));
  assert.match(verificationClaims, /exact-head push Build #194/);
  assert.match(verificationClaims, /real NeoForge client\/server Xvfb mouse-input/);
  assert.match(verificationClaims, /9 required combined GameTests/);
  assert.match(verificationClaims, /second-JVM persistence/);
  assert.match(reproducibilityClaims, /repeatable validation recipe/);
  assert.match(reproducibilityClaims, /not byte-for-byte deterministic artifact reproduction/);
  assert.equal(subject.expected.deterministicArtifactReproduction, "not-verified");
  assert.equal(subject.expected.stableRelease, "not-claimed");
});

test("live admission may select the default FTBPublicClaims snapshot without admitting the unmerged active carrier", () => {
  const liveSource = manifest.sources.find((entry) => entry.repositoryKey.toLowerCase() === subject.repository.toLowerCase());

  assert.ok(liveSource);
  assert.equal(liveSource.mode, "repository-snapshot");
  assert.equal(liveSource.fixture, "fixtures/repository-quality-game-mod-calibration.v1.json");
  assert.equal(liveSource.caseId, "ftbpublicclaims-game-mod-default-8caaab");
  assert.notEqual(liveSource.fixture, "fixtures/repository-quality-active-carrier-game-mod-calibration.v1.json");
  assert.notEqual(liveSource.caseId, subject.id);
  assert.equal(subject.carrier.productionAdmissionEligible, false);
  assert.equal(subject.expected.productionAdmissionEligible, false);
  assert.notEqual(subject.carrier.branch, subject.carrier.defaultBranch);
  assert.match(calibration.claimBoundary, /not a live-profile source/i);
});

test("carrier status and popularity remain provenance/context rather than Quality penalties or merit", () => {
  assert.equal(subject.context.relation.collaboration, "unknown");
  assert.equal(Object.hasOwn(subject.evidence, "stars"), false);
  assert.equal(Object.hasOwn(subject.evidence, "forks"), false);
  assert.equal(Object.hasOwn(subject.evidence, "releaseCount"), false);
  assert.equal(Object.hasOwn(subject.evidence, "recentCommitActivity"), false);
  assert.equal(subject.excludedSignals.stars, "Impact only");
  assert.equal(subject.excludedSignals.forks, "Impact only");
  assert.match(subject.excludedSignals.draftCarrierStatus, /not a negative Quality score/);
  assert.equal(subject.expected.compositeQualityScore, null);
  assert.equal(subject.expected.compositeConfidenceScore, null);
});
