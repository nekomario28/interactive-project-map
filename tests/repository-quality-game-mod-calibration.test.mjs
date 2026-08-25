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
const calibration = readJson("fixtures/repository-quality-game-mod-calibration.v1.json");
const anti = calibration.cases.find((entry) => entry.id === "antifullbright-game-mod-1.1.0");
const ftb = calibration.cases.find((entry) => entry.id === "ftbpublicclaims-game-mod-default-8caaab");

function evaluate(subject) {
  const quality = buildQualityEvidenceVector(policy, {
    artifacts: subject.context.artifacts,
    evidence: subject.evidence,
  });
  const confidence = buildQualityConfidenceVector(policy, quality);
  return { quality, confidence };
}

function assertGameModRoute(subject) {
  const { quality } = evaluate(subject);
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
  assert.equal(quality.dimensions["security-safety"].applicability, subject.expected.applicability["security-safety"]);
}

test("game-mod calibration freezes two exact original repository snapshots", () => {
  assert.equal(calibration.schemaVersion, 1);
  assert.equal(calibration.policyId, policy.policyId);
  assert.equal(calibration.status, "frozen-real-game-mod-calibration");
  assert.equal(calibration.cases.length, 2);

  assert.equal(anti.repository, "nekomario28/antifullbright");
  assert.equal(anti.revision, "154bd1a1085412ca7a5abe797abf253a43dd29a8");
  assert.equal(ftb.repository, "nekomario28/FTBPublicClaims");
  assert.equal(ftb.revision, "8caaab65266a94e7bdedc6ad2f66030c7e394edf");

  for (const subject of [anti, ftb]) {
    assert.equal(subject.context.category, "game-modding");
    assert.deepEqual(subject.context.artifacts, ["game-mod"]);
    assert.deepEqual(subject.context.relation, {
      ownership: "owned",
      collaboration: "unknown",
      lineage: "original",
    });
    assertGameModRoute(subject);
  }
});

test("AntiFullbright keeps executable release evidence and Maintainability unknown", () => {
  const { quality, confidence } = evaluate(anti);

  for (const [dimension, expected] of Object.entries(anti.expected.findings)) {
    assert.equal(quality.dimensions[dimension].findingState, expected, dimension);
  }

  assert.equal(quality.dimensions.verification.findingState, "supports");
  assert.equal(quality.dimensions.maintainability.findingState, "unknown");
  assert.equal(quality.dimensions["security-safety"].findingState, "supports");
  assert.equal(confidence.coverage.targetDimensions, 6);
  assert.equal(confidence.coverage.inspectedDimensions, 5);
  assert.equal(confidence.coverage.directionalDimensions, 5);
  assert.equal(confidence.coverage.inspectedCoverageRatio, 5 / 6);
  assert.equal(quality.compositeQualityScore, null);
  assert.equal(confidence.compositeConfidenceScore, null);

  const verificationClaims = anti.evidence.verification.map((entry) => entry.claim).join(" ");
  const reproducibilityClaims = anti.evidence.reproducibility.map((entry) => entry.claim).join(" ");
  assert.match(verificationClaims, /Build, GameTest, Packaged Server, External Runtime/);
  assert.match(verificationClaims, /24 required GameTests passed/);
  assert.match(verificationClaims, /real block-break packet/);
  assert.match(reproducibilityClaims, /byte-for-byte identical/);
});

test("FTBPublicClaims default snapshot supports five target dimensions while Verification remains unknown", () => {
  const { quality, confidence } = evaluate(ftb);

  for (const [dimension, expected] of Object.entries(ftb.expected.findings)) {
    assert.equal(quality.dimensions[dimension].findingState, expected, dimension);
  }

  assert.equal(quality.dimensions.understandability.findingState, "supports");
  assert.equal(quality.dimensions.verification.findingState, "unknown");
  assert.equal(quality.dimensions.reproducibility.findingState, "supports");
  assert.equal(quality.dimensions.maintainability.findingState, "supports");
  assert.equal(quality.dimensions.interoperability.findingState, "supports");
  assert.equal(quality.dimensions.stewardship.findingState, "supports");
  assert.equal(quality.dimensions["security-safety"].applicability, "optional");
  assert.equal(quality.dimensions["security-safety"].findingState, "supports");

  assert.equal(confidence.coverage.targetDimensions, ftb.expected.confidence.targetDimensions);
  assert.equal(confidence.coverage.inspectedDimensions, ftb.expected.confidence.inspectedDimensions);
  assert.equal(confidence.coverage.directionalDimensions, ftb.expected.confidence.directionalDimensions);
  assert.equal(confidence.coverage.inspectedCoverageRatio, 5 / 6);
  assert.equal(confidence.coverage.directionalCoverageRatio, 5 / 6);
  assert.equal(quality.compositeQualityScore, null);
  assert.equal(confidence.compositeConfidenceScore, null);
});

test("FTBPublicClaims calibration excludes unmerged active-port execution evidence", () => {
  const serializedEvidence = JSON.stringify(ftb.evidence);
  const boundaries = ftb.claimBoundaries.join(" ");

  assert.equal(Object.hasOwn(ftb.evidence, "verification"), false);
  assert.equal(ftb.expected.unmergedActivePortEvidence, "excluded");
  assert.equal(ftb.expected.defaultBranchRuntimeVerification, "not-established");
  assert.match(boundaries, /Open NeoForge port PR #1/);
  assert.match(boundaries, /PR #2/);
  assert.match(boundaries, /no default-branch GameTest source or exact-head runtime receipt/);
  assert.equal(serializedEvidence.includes("run #160"), false);
  assert.equal(serializedEvidence.includes("NeoForge 21.1"), false);
  assert.equal(serializedEvidence.includes("eight required combined GameTests"), false);
  assert.equal(ftb.excludedSignals.openNeoForgePortPR1.startsWith("Unmerged carrier evidence excluded"), true);
});

test("FTBPublicClaims static evidence stays specific to the frozen default snapshot", () => {
  const reproducibilityClaims = ftb.evidence.reproducibility.map((entry) => entry.claim).join(" ");
  const maintainabilityClaims = ftb.evidence.maintainability.map((entry) => entry.claim).join(" ");
  const interoperabilityClaims = ftb.evidence.interoperability.map((entry) => entry.claim).join(" ");
  const safetyClaims = ftb.evidence["security-safety"].map((entry) => entry.claim).join(" ");

  assert.match(reproducibilityClaims, /Java 17/);
  assert.match(reproducibilityClaims, /Minecraft 1\.20\.1/);
  assert.match(reproducibilityClaims, /Forge 47\.4\.13/);
  assert.match(reproducibilityClaims, /FTB Chunks 2001\.3\.6/);
  assert.match(maintainabilityClaims, /dedicated FTBServerTeamBridge/);
  assert.match(interoperabilityClaims, /both-side dependency requirements/);
  assert.match(safetyClaims, /64-change packet limit/);
  assert.match(safetyClaims, /existing-claim protection/);
});

test("optional security-safety evidence remains outside six-dimension target coverage", () => {
  for (const subject of [anti, ftb]) {
    const { quality, confidence } = evaluate(subject);
    assert.equal(quality.dimensions["security-safety"].applicability, "optional");
    assert.equal(quality.dimensions["security-safety"].findingState, "supports");
    assert.equal(confidence.coverage.targetDimensions, subject.expected.confidence.targetDimensions);
    assert.equal(confidence.coverage.inspectedDimensions, subject.expected.confidence.inspectedDimensions);
    assert.equal(confidence.coverage.directionalDimensions, subject.expected.confidence.directionalDimensions);
  }
});

test("project Quality evidence does not resolve collaboration or smuggle popularity into Quality", () => {
  for (const subject of [anti, ftb]) {
    assert.equal(subject.context.relation.collaboration, subject.expected.collaboration);
    assert.equal(Object.hasOwn(subject.evidence, "stars"), false);
    assert.equal(Object.hasOwn(subject.evidence, "forks"), false);
    assert.equal(Object.hasOwn(subject.evidence, "releaseCount"), false);
    assert.equal(Object.hasOwn(subject.evidence, "recentCommitActivity"), false);
    assert.equal(subject.excludedSignals.stars, "Impact only");
    assert.equal(subject.excludedSignals.forks, "Impact only");
    assert.equal(subject.expected.compositeQualityScore, null);
    assert.equal(subject.expected.compositeConfidenceScore, null);
  }
});
