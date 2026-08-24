import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildQualityEvidenceVector } from "../scripts/repository-quality-evidence.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

const policy = readJson("data/repository-assessment-policy.v1.json");
const taxonomy = readJson("data/standard-taxonomy.v1.json");
const calibration = readJson("fixtures/repository-quality-real-calibration.v1.json");
const categoryIds = new Set(taxonomy.categories.map((category) => category.id));
const impactKeys = new Set(["stars", "forks", "downloads", "dependents", "citations", "projectStars", "upstreamStars"]);

test("real Quality calibration fixture stays evidence-only and policy-routed", () => {
  assert.equal(calibration.schemaVersion, 1);
  assert.equal(calibration.policyId, policy.policyId);
  assert.equal(calibration.status, "frozen-real-evidence-calibration");
  assert.ok(calibration.cases.length >= 3);

  for (const entry of calibration.cases) {
    assert.ok(categoryIds.has(entry.context.category), `${entry.id} should use a Standard Taxonomy category`);
    assert.deepEqual(entry.context.artifacts, ["application"], `${entry.id} should remain in the comparable application route`);
    for (const key of Object.keys(entry.evidence)) {
      assert.ok(!impactKeys.has(key), `${entry.id} must not leak Impact counters into Quality evidence`);
    }

    const vector = buildQualityEvidenceVector(policy, {
      artifacts: entry.context.artifacts,
      evidence: entry.evidence,
    });

    assert.equal(vector.compositeQualityScore, null, `${entry.id} must not claim a composite Quality score`);
    for (const [dimension, expectedFinding] of Object.entries(entry.expectedFindings)) {
      assert.equal(vector.dimensions[dimension].findingState, expectedFinding, `${entry.id}:${dimension}`);
    }
  }
});

test("real calibration differentiates support, weakness, and unknown without ranking repositories", () => {
  const byId = new Map(calibration.cases.map((entry) => [entry.id, entry]));

  const ipm = buildQualityEvidenceVector(policy, {
    artifacts: byId.get("interactive-project-map-application").context.artifacts,
    evidence: byId.get("interactive-project-map-application").evidence,
  });
  const group10 = buildQualityEvidenceVector(policy, {
    artifacts: byId.get("projexd-group10-application").context.artifacts,
    evidence: byId.get("projexd-group10-application").evidence,
  });
  const contributed = buildQualityEvidenceVector(policy, {
    artifacts: byId.get("projexd4-contributed-application").context.artifacts,
    evidence: byId.get("projexd4-contributed-application").evidence,
  });

  assert.equal(ipm.dimensions.verification.findingState, "supports");
  assert.equal(group10.dimensions.verification.findingState, "unknown");
  assert.equal(contributed.dimensions.verification.findingState, "unknown");

  assert.equal(ipm.dimensions.stewardship.findingState, "supports");
  assert.equal(group10.dimensions.stewardship.findingState, "weakens");
  assert.equal(contributed.dimensions.stewardship.findingState, "weakens");

  assert.equal(ipm.dimensions.understandability.findingState, "supports");
  assert.equal(group10.dimensions.understandability.findingState, "supports");
  assert.equal(contributed.dimensions.understandability.findingState, "weakens");

  for (const vector of [ipm, group10, contributed]) {
    assert.equal(vector.compositeQualityScore, null);
  }
  assert.equal(Object.hasOwn(calibration, "ranking"), false);
  assert.equal(Object.hasOwn(calibration, "tierThresholds"), false);
});
