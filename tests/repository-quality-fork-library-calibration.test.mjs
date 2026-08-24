import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildPersonalContributionEvidence } from "../scripts/repository-contribution-features.mjs";
import { buildQualityConfidenceVector } from "../scripts/repository-quality-confidence.mjs";
import { buildQualityEvidenceVector } from "../scripts/repository-quality-evidence.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const policy = readJson("data/repository-assessment-policy.v1.json");
const calibration = readJson("fixtures/repository-quality-fork-library-calibration.v1.json");

function evaluate(entry) {
  const quality = buildQualityEvidenceVector(policy, {
    artifacts: entry.context.artifacts,
    evidence: entry.qualityEvidence,
  });
  const confidence = buildQualityConfidenceVector(policy, quality);
  const contribution = buildPersonalContributionEvidence({
    relation: entry.context.relation,
    localDeltaObservation: entry.localDeltaObservation,
  });
  return { quality, confidence, contribution };
}

test("fork library calibration preserves project Quality and person-side delta as separate vectors", () => {
  assert.equal(calibration.schemaVersion, 1);
  assert.equal(calibration.policyId, policy.policyId);
  assert.equal(calibration.status, "frozen-fork-library-calibration");
  assert.equal(calibration.cases.length, 2);

  for (const entry of calibration.cases) {
    assert.deepEqual(entry.context.artifacts, ["library"]);
    assert.equal(entry.context.relation.lineage, "fork");

    const { quality, confidence, contribution } = evaluate(entry);
    for (const [dimension, finding] of Object.entries(entry.expected.qualityFindings)) {
      assert.equal(quality.dimensions[dimension].findingState, finding, `${entry.id}:${dimension}`);
    }
    assert.equal(quality.compositeQualityScore, null, entry.id);

    assert.equal(confidence.coverage.targetDimensions, entry.expected.confidence.targetDimensions, entry.id);
    assert.equal(confidence.coverage.inspectedDimensions, entry.expected.confidence.inspectedDimensions, entry.id);
    assert.equal(confidence.coverage.directionalDimensions, entry.expected.confidence.directionalDimensions, entry.id);
    assert.equal(confidence.compositeConfidenceScore, null, entry.id);

    assert.equal(contribution.attribution.profile, "fork", entry.id);
    assert.equal(contribution.attribution.requiresPersonalContributionGate, true, entry.id);
    assert.equal(contribution.attribution.localDeltaPresence, entry.expected.localDeltaPresence, entry.id);
    assert.equal(contribution.compositePersonalContribution, null, entry.id);
  }
});

test("similar project-side Quality evidence does not erase different fork local-delta observations", () => {
  const noDelta = evaluate(calibration.cases.find((entry) => entry.id.includes("gz-sim")));
  const withDelta = evaluate(calibration.cases.find((entry) => entry.id.includes("turing")));

  for (const dimension of ["understandability", "reproducibility", "stewardship"]) {
    assert.equal(noDelta.quality.dimensions[dimension].findingState, "supports");
    assert.equal(withDelta.quality.dimensions[dimension].findingState, "supports");
  }
  assert.equal(noDelta.quality.dimensions.verification.findingState, "unknown");
  assert.equal(withDelta.quality.dimensions.verification.findingState, "unknown");

  assert.equal(noDelta.contribution.localDelta.state, "observed");
  assert.equal(noDelta.contribution.localDelta.presence, "absent");
  assert.equal(withDelta.contribution.localDelta.state, "observed");
  assert.equal(withDelta.contribution.localDelta.presence, "present");

  assert.deepEqual(noDelta.contribution.signals.localDelta, []);
  assert.deepEqual(withDelta.contribution.signals.localDelta, ["local-delta-present"]);

  assert.equal(noDelta.contribution.compositePersonalContribution, null);
  assert.equal(withDelta.contribution.compositePersonalContribution, null);
});

test("fork calibration never treats upstream project evidence as direct personal merit", () => {
  for (const entry of calibration.cases) {
    const { contribution } = evaluate(entry);
    assert.equal(contribution.attribution.directPersonalMeritPermitted, false, entry.id);
    assert.equal(contribution.portfolioProminenceEffect, null, entry.id);
  }
});
