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
const antiFullbright = calibration.cases.find((entry) => entry.id === "antifullbright-game-mod-1.1.0");
const ftbPublicClaims = calibration.cases.find((entry) => entry.id === "ftbpublicclaims-neoforge-active-carrier");

function evaluate(subject) {
  const quality = buildQualityEvidenceVector(policy, {
    artifacts: subject.context.artifacts,
    evidence: subject.evidence,
  });
  const confidence = buildQualityConfidenceVector(policy, quality);
  return { quality, confidence };
}

test("game-mod calibration freezes two selectable owned-original cases at exact revisions", () => {
  assert.equal(calibration.schemaVersion, 1);
  assert.equal(calibration.policyId, policy.policyId);
  assert.equal(calibration.status, "frozen-real-game-mod-calibration");
  assert.equal(calibration.cases.length, 2);

  assert.equal(antiFullbright.repository, "nekomario28/antifullbright");
  assert.equal(antiFullbright.revision, "154bd1a1085412ca7a5abe797abf253a43dd29a8");
  assert.equal(ftbPublicClaims.repository, "nekomario28/FTBPublicClaims");
  assert.equal(ftbPublicClaims.revision, "12c57797637d1903ad7f76174e6d676364a3c339");

  for (const subject of [antiFullbright, ftbPublicClaims]) {
    assert.equal(subject.context.category, "game-modding");
    assert.deepEqual(subject.context.artifacts, ["game-mod"]);
    assert.deepEqual(subject.context.relation, {
      ownership: "owned",
      collaboration: "unknown",
      lineage: "original",
    });
  }
});

test("game-mod route preserves six target dimensions and does not silently target security-safety", () => {
  for (const subject of [antiFullbright, ftbPublicClaims]) {
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
});

test("AntiFullbright direct release evidence supports five target dimensions while Maintainability stays unknown", () => {
  const { quality } = evaluate(antiFullbright);

  for (const [dimension, expected] of Object.entries(antiFullbright.expected.findings)) {
    assert.equal(quality.dimensions[dimension].findingState, expected, dimension);
  }

  assert.equal(quality.dimensions.maintainability.findingState, "unknown");
  assert.equal(quality.compositeQualityScore, null);
});

test("AntiFullbright optional security-safety stays visible without inflating target coverage", () => {
  const { quality, confidence } = evaluate(antiFullbright);

  assert.equal(quality.dimensions["security-safety"].applicability, "optional");
  assert.equal(quality.dimensions["security-safety"].findingState, "supports");
  assert.equal(confidence.coverage.targetDimensions, antiFullbright.expected.confidence.targetDimensions);
  assert.equal(confidence.coverage.inspectedDimensions, antiFullbright.expected.confidence.inspectedDimensions);
  assert.equal(confidence.coverage.directionalDimensions, antiFullbright.expected.confidence.directionalDimensions);
  assert.equal(confidence.coverage.inspectedCoverageRatio, 5 / 6);
  assert.equal(confidence.coverage.directionalCoverageRatio, 5 / 6);
  assert.equal(confidence.compositeConfidenceScore, null);
});

test("AntiFullbright verification and reproducibility claims remain tied to executable release evidence", () => {
  const verificationClaims = antiFullbright.evidence.verification.map((entry) => entry.claim).join(" ");
  const reproducibilityClaims = antiFullbright.evidence.reproducibility.map((entry) => entry.claim).join(" ");

  assert.match(verificationClaims, /Build, GameTest, Packaged Server, External Runtime/);
  assert.match(verificationClaims, /24 required GameTests passed/);
  assert.match(verificationClaims, /real block-break packet/);
  assert.match(verificationClaims, /action=kick/);
  assert.match(reproducibilityClaims, /Java 21/);
  assert.match(reproducibilityClaims, /Minecraft 1\.21\.1/);
  assert.match(reproducibilityClaims, /NeoForge 21\.1\.235/);
  assert.match(reproducibilityClaims, /byte-for-byte identical/);
});

test("AntiFullbright cross-platform evidence stays bounded to scanner behavior", () => {
  const interoperabilityClaims = antiFullbright.evidence.interoperability.map((entry) => entry.claim).join(" ");

  assert.match(interoperabilityClaims, /Ubuntu, Windows, and macOS/);
  assert.match(interoperabilityClaims, /does not claim a complete graphical Minecraft runtime/);
  assert.equal(antiFullbright.expected.fullGraphicalRuntimeAcrossUbuntuWindowsMacOS, "not-verified");
});

test("FTB Public Claims freezes the active NeoForge port carrier instead of the stale default branch", () => {
  assert.deepEqual(ftbPublicClaims.carrier, {
    kind: "pull-request",
    number: 1,
    state: "open-draft",
    base: "public-claim-context",
    head: "neoforge-1.21.1-port",
  });
  assert.equal(ftbPublicClaims.release, "0.2.0-SNAPSHOT");
  assert.equal(ftbPublicClaims.expected.carrierMerged, false);
  assert.equal(ftbPublicClaims.expected.stableRelease, false);
});

test("FTB Public Claims exact-carrier evidence supports all six game-mod target dimensions", () => {
  const { quality, confidence } = evaluate(ftbPublicClaims);

  for (const [dimension, expected] of Object.entries(ftbPublicClaims.expected.findings)) {
    assert.equal(quality.dimensions[dimension].findingState, expected, dimension);
  }

  assert.equal(quality.dimensions["security-safety"].applicability, "optional");
  assert.equal(quality.dimensions["security-safety"].findingState, "supports");
  assert.equal(confidence.coverage.targetDimensions, 6);
  assert.equal(confidence.coverage.inspectedDimensions, 6);
  assert.equal(confidence.coverage.directionalDimensions, 6);
  assert.equal(confidence.coverage.inspectedCoverageRatio, 1);
  assert.equal(confidence.coverage.directionalCoverageRatio, 1);
  assert.equal(quality.compositeQualityScore, null);
  assert.equal(confidence.compositeConfidenceScore, null);
});

test("FTB Public Claims Verification is tied to exact-head executable GitHub Actions outcomes", () => {
  const verification = ftbPublicClaims.evidence.verification;
  const sourceIds = verification.map((entry) => entry.sourceId).join(" ");
  const claims = verification.map((entry) => entry.claim).join(" ");

  assert.match(sourceIds, /Build#195@12c57797637d1903ad7f76174e6d676364a3c339/);
  assert.match(sourceIds, /Validate-compatible-FTB-stack#20@12c57797637d1903ad7f76174e6d676364a3c339/);
  assert.match(claims, /real Xvfb mouse interaction/);
  assert.match(claims, /combined NeoForge GameTests/);
  assert.match(claims, /second-JVM dedicated-server persistence/);
  assert.match(claims, /FTB Chunks 2101\.1\.21/);
  assert.ok(verification.every((entry) => entry.evidenceClass === "B"));
});

test("FTB Public Claims maintainability and interoperability claims stay explicitly bounded", () => {
  const maintainabilityClaims = ftbPublicClaims.evidence.maintainability.map((entry) => entry.claim).join(" ");
  const interoperabilityClaims = ftbPublicClaims.evidence.interoperability.map((entry) => entry.claim).join(" ");

  assert.match(maintainabilityClaims, /dedicated bridge/);
  assert.match(maintainabilityClaims, /without asserting broad long-term maintainability/);
  assert.match(interoperabilityClaims, /BuyClaimChunks Continued/);
  assert.match(interoperabilityClaims, /separate personal\/public capacity and ownership domains/);
  assert.match(interoperabilityClaims, /compatible FTB stack/);
});

test("draft carrier lifecycle and popularity remain outside project Quality", () => {
  for (const subject of [antiFullbright, ftbPublicClaims]) {
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

  assert.match(ftbPublicClaims.excludedSignals.draftPullRequestState, /Maturity\/context only/);
});
