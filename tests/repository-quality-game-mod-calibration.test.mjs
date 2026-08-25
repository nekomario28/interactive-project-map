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
const subject = calibration.cases.find((entry) => entry.id === "antifullbright-game-mod-1.1.0");

function evaluate() {
  const quality = buildQualityEvidenceVector(policy, {
    artifacts: subject.context.artifacts,
    evidence: subject.evidence,
  });
  const confidence = buildQualityConfidenceVector(policy, quality);
  return { quality, confidence };
}

test("AntiFullbright calibration is a frozen selectable case at an exact original game-mod revision", () => {
  assert.equal(calibration.schemaVersion, 1);
  assert.equal(calibration.policyId, policy.policyId);
  assert.equal(calibration.status, "frozen-real-game-mod-calibration");
  assert.equal(calibration.cases.length, 1);
  assert.equal(subject.repository, "nekomario28/antifullbright");
  assert.equal(subject.revision, "154bd1a1085412ca7a5abe797abf253a43dd29a8");
  assert.equal(subject.context.category, "game-modding");
  assert.deepEqual(subject.context.artifacts, ["game-mod"]);
  assert.deepEqual(subject.context.relation, {
    ownership: "owned",
    collaboration: "unknown",
    lineage: "original",
  });
});

test("game-mod route preserves six target dimensions and does not silently target security-safety", () => {
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
  assert.equal(quality.dimensions["security-safety"].applicability, subject.expected.applicability["security-safety"]);
});

test("direct release evidence supports five game-mod target dimensions while Maintainability stays unknown", () => {
  const { quality } = evaluate();

  for (const [dimension, expected] of Object.entries(subject.expected.findings)) {
    assert.equal(quality.dimensions[dimension].findingState, expected, dimension);
  }

  assert.equal(quality.dimensions.understandability.findingState, "supports");
  assert.equal(quality.dimensions.verification.findingState, "supports");
  assert.equal(quality.dimensions.reproducibility.findingState, "supports");
  assert.equal(quality.dimensions.maintainability.findingState, "unknown");
  assert.equal(quality.dimensions.interoperability.findingState, "supports");
  assert.equal(quality.dimensions.stewardship.findingState, "supports");
  assert.equal(quality.compositeQualityScore, null);
});

test("optional security-safety evidence stays visible without inflating target coverage", () => {
  const { quality, confidence } = evaluate();

  assert.equal(quality.dimensions["security-safety"].applicability, "optional");
  assert.equal(quality.dimensions["security-safety"].findingState, "supports");
  assert.equal(confidence.coverage.targetDimensions, subject.expected.confidence.targetDimensions);
  assert.equal(confidence.coverage.inspectedDimensions, subject.expected.confidence.inspectedDimensions);
  assert.equal(confidence.coverage.directionalDimensions, subject.expected.confidence.directionalDimensions);
  assert.equal(confidence.coverage.inspectedCoverageRatio, 5 / 6);
  assert.equal(confidence.coverage.directionalCoverageRatio, 5 / 6);
  assert.equal(confidence.compositeConfidenceScore, null);
});

test("verification and reproducibility claims remain tied to executable release evidence", () => {
  const verificationClaims = subject.evidence.verification.map((entry) => entry.claim).join(" ");
  const reproducibilityClaims = subject.evidence.reproducibility.map((entry) => entry.claim).join(" ");

  assert.match(verificationClaims, /Build, GameTest, Packaged Server, External Runtime/);
  assert.match(verificationClaims, /24 required GameTests passed/);
  assert.match(verificationClaims, /real block-break packet/);
  assert.match(verificationClaims, /action=kick/);
  assert.match(reproducibilityClaims, /Java 21/);
  assert.match(reproducibilityClaims, /Minecraft 1\.21\.1/);
  assert.match(reproducibilityClaims, /NeoForge 21\.1\.235/);
  assert.match(reproducibilityClaims, /byte-for-byte identical/);
});

test("cross-platform evidence is bounded and does not overclaim full graphical runtime", () => {
  const interoperabilityClaims = subject.evidence.interoperability.map((entry) => entry.claim).join(" ");

  assert.match(interoperabilityClaims, /Ubuntu, Windows, and macOS/);
  assert.match(interoperabilityClaims, /does not claim a complete graphical Minecraft runtime/);
  assert.equal(subject.expected.fullGraphicalRuntimeAcrossUbuntuWindowsMacOS, "not-verified");
});

test("project Quality evidence does not resolve collaboration or smuggle popularity into Quality", () => {
  assert.equal(subject.context.relation.collaboration, subject.expected.collaboration);
  assert.equal(Object.hasOwn(subject.evidence, "stars"), false);
  assert.equal(Object.hasOwn(subject.evidence, "forks"), false);
  assert.equal(Object.hasOwn(subject.evidence, "releaseCount"), false);
  assert.equal(Object.hasOwn(subject.evidence, "recentCommitActivity"), false);
  assert.equal(subject.excludedSignals.stars, "Impact only");
  assert.equal(subject.excludedSignals.forks, "Impact only");
  assert.equal(subject.expected.compositeQualityScore, null);
  assert.equal(subject.expected.compositeConfidenceScore, null);
});
