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
const calibration = readJson("fixtures/repository-quality-external-dataset-calibration.v1.json");

function evaluate() {
  const quality = buildQualityEvidenceVector(policy, {
    artifacts: calibration.subject.artifacts,
    evidence: calibration.qualityEvidence,
  });
  const confidence = buildQualityConfidenceVector(policy, quality);
  return { quality, confidence };
}

test("external dataset donor calibration routes through the dataset module at an exact revision", () => {
  assert.equal(calibration.schemaVersion, 1);
  assert.equal(calibration.policyId, policy.policyId);
  assert.equal(calibration.status, "frozen-external-dataset-donor-calibration");
  assert.deepEqual(calibration.subject.artifacts, ["dataset"]);
  assert.match(calibration.subject.revision, /^[0-9a-f]{40}$/);
  assert.equal(calibration.subject.revision, "4c1ff5e3aef1816ae04af63218015066e186c147");
});

test("dataset-specific evidence supports documented outcomes while Integrity stays unknown", () => {
  const { quality } = evaluate();

  for (const [dimension, expected] of Object.entries(calibration.expected.findings)) {
    assert.equal(quality.dimensions[dimension].findingState, expected, dimension);
  }

  assert.equal(quality.dimensions.understandability.findingState, "supports");
  assert.equal(quality.dimensions.reproducibility.findingState, "supports");
  assert.equal(quality.dimensions.interoperability.findingState, "supports");
  assert.equal(quality.dimensions.stewardship.findingState, "supports");
  assert.equal(quality.dimensions.integrity.findingState, "unknown");
  assert.equal(quality.compositeQualityScore, null);
});

test("dataset confidence reports coverage without inventing a confidence score", () => {
  const { confidence } = evaluate();
  const expected = calibration.expected.confidence;

  assert.equal(confidence.coverage.targetDimensions, expected.targetDimensions);
  assert.equal(confidence.coverage.inspectedDimensions, expected.inspectedDimensions);
  assert.equal(confidence.coverage.directionalDimensions, expected.directionalDimensions);
  assert.equal(confidence.coverage.inspectedCoverageRatio, 4 / 5);
  assert.equal(confidence.coverage.directionalCoverageRatio, 4 / 5);
  assert.equal(confidence.compositeConfidenceScore, null);
});

test("dataset calibration does not convert popularity or recent activity into Quality evidence", () => {
  assert.equal(Object.hasOwn(calibration.qualityEvidence, "stars"), false);
  assert.equal(Object.hasOwn(calibration.qualityEvidence, "forks"), false);
  assert.equal(Object.hasOwn(calibration.qualityEvidence, "recentCommitActivity"), false);
  assert.equal(calibration.excludedSignals.stars, "Impact only");
  assert.equal(calibration.excludedSignals.forks, "Impact only");
  assert.equal(calibration.excludedSignals.recentCommitActivity, "Activity/lifecycle context only");
});

test("documented provenance does not silently claim deterministic generation or intrinsic data validity", () => {
  const reproducibilityClaims = calibration.qualityEvidence.reproducibility.map((entry) => entry.claim).join(" ");
  assert.match(reproducibilityClaims, /does not claim a deterministic generation pipeline/);
  assert.equal(calibration.expected.intrinsicDataValidity, "not-verified");
  assert.equal(calibration.expected.compositeQualityScore, null);
  assert.equal(calibration.expected.compositeConfidenceScore, null);
});
