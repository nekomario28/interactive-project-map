import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildQualityEvidenceVector } from "../scripts/repository-quality-evidence.mjs";
import { validateRepositoryAssessmentPolicy } from "../scripts/repository-assessment-policy.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const policy = readJson("data/repository-assessment-policy.v1.json");
const taxonomy = readJson("data/standard-taxonomy.v1.json");

test("applicability and assessment authority are orthogonal", () => {
  assert.equal(validateRepositoryAssessmentPolicy(policy, taxonomy), true);
  assert.ok(!policy.applicabilityStates.includes("external"));
  assert.ok(policy.assessmentAuthorities.includes("external"));
  assert.deepEqual(policy.qualityFindingDirections, ["supports", "weakens", "neutral", "unknown"]);

  const vector = buildQualityEvidenceVector(policy, {
    artifacts: ["application"],
    applicability: { "security-safety": "required" },
    evidence: {
      "security-safety": [{
        authority: "external",
        state: "observed",
        evidenceClass: "A",
        sourceId: "scorecard:example",
      }],
    },
  });

  assert.equal(vector.dimensions["security-safety"].applicability, "required");
  assert.equal(vector.dimensions["security-safety"].authority, "external");
  assert.equal(vector.dimensions["security-safety"].disposition, "evidenced");
  assert.equal(vector.dimensions["security-safety"].findingState, "unknown");
});

test("not-applicable dimensions are excluded rather than scored as failures", () => {
  const vector = buildQualityEvidenceVector(policy, {
    artifacts: ["dataset"],
    applicability: { "security-safety": "not-applicable" },
    evidence: {},
  });
  assert.equal(vector.dimensions["security-safety"].disposition, "excluded");
  assert.equal(vector.dimensions["security-safety"].evidenceState, "unknown");
  assert.equal(vector.dimensions["security-safety"].findingState, "unknown");
  assert.equal(vector.compositeQualityScore, null);
});

test("unknown evidence remains unknown instead of becoming zero-quality evidence", () => {
  const vector = buildQualityEvidenceVector(policy, { artifacts: ["research"] });
  assert.equal(vector.dimensions.verification.evidenceState, "unknown");
  assert.equal(vector.dimensions.verification.findingState, "unknown");
  assert.equal(vector.dimensions.verification.disposition, "unevidenced");
  assert.equal(vector.compositeQualityScore, null);
});

test("mixed native and external evidence summarizes authority as mixed", () => {
  const vector = buildQualityEvidenceVector(policy, {
    artifacts: ["library"],
    evidence: {
      verification: [
        { authority: "repository-native", state: "observed", finding: "supports", evidenceClass: "B", sourceId: "tests" },
        { authority: "external", state: "observed", finding: "supports", evidenceClass: "A", sourceId: "conformance" },
      ],
    },
  });
  assert.equal(vector.dimensions.verification.authority, "mixed");
  assert.equal(vector.dimensions.verification.evidenceState, "observed");
  assert.equal(vector.dimensions.verification.findingState, "supports");
});

test("observed evidence does not imply a supporting Quality finding", () => {
  const vector = buildQualityEvidenceVector(policy, {
    artifacts: ["application"],
    evidence: {
      verification: [
        { authority: "repository-native", state: "observed", evidenceClass: "B", sourceId: "ci:run-1", claim: "exact-head run observed" },
      ],
    },
  });
  assert.equal(vector.dimensions.verification.evidenceState, "observed");
  assert.equal(vector.dimensions.verification.disposition, "evidenced");
  assert.equal(vector.dimensions.verification.findingState, "unknown");
  assert.deepEqual(vector.dimensions.verification.findingCounts, {
    supports: 0,
    weakens: 0,
    neutral: 0,
    unknown: 1,
  });
});

test("supporting and weakening observed findings remain inspectably mixed", () => {
  const vector = buildQualityEvidenceVector(policy, {
    artifacts: ["application"],
    evidence: {
      verification: [
        { authority: "repository-native", state: "observed", finding: "supports", evidenceClass: "B", sourceId: "ci:run-green", claim: "exact-head test suite passed" },
        { authority: "repository-native", state: "observed", finding: "weakens", evidenceClass: "B", sourceId: "ci:run-red", claim: "required compatibility check failed" },
      ],
    },
  });
  assert.equal(vector.dimensions.verification.evidenceState, "observed");
  assert.equal(vector.dimensions.verification.findingState, "mixed");
  assert.deepEqual(vector.dimensions.verification.findingCounts, {
    supports: 1,
    weakens: 1,
    neutral: 0,
    unknown: 0,
  });
  assert.equal(vector.compositeQualityScore, null);
});

test("not-collected or unknown evidence cannot fabricate finding direction", () => {
  for (const state of ["not-collected", "unknown"]) {
    assert.throws(
      () => buildQualityEvidenceVector(policy, {
        artifacts: ["application"],
        evidence: {
          verification: [{ authority: "repository-native", state, finding: "supports", evidenceClass: "B", sourceId: "missing-run" }],
        },
      }),
      /finding must remain unknown/,
    );
  }
});

test("explicit neutral absence stays distinct from unknown or failure", () => {
  const vector = buildQualityEvidenceVector(policy, {
    artifacts: ["dataset"],
    evidence: {
      verification: [{ authority: "repository-native", state: "absent", finding: "neutral", evidenceClass: "C", sourceId: "ci-config", claim: "CI configuration absent and not required by this evidence claim" }],
    },
  });
  assert.equal(vector.dimensions.verification.evidenceState, "absent");
  assert.equal(vector.dimensions.verification.findingState, "neutral");
  assert.equal(vector.dimensions.verification.disposition, "unevidenced");
});

test("impact counters are rejected from Quality evidence input", () => {
  for (const key of ["stars", "forks", "downloads", "dependents", "citations", "projectStars", "upstreamStars"]) {
    assert.throws(
      () => buildQualityEvidenceVector(policy, { artifacts: ["tool"], [key]: 100 }),
      /Impact signal/,
    );
  }
});

test("artifact routing changes applicability defaults without forcing one archetype", () => {
  const vector = buildQualityEvidenceVector(policy, { artifacts: ["research", "dataset", "model"] });
  assert.equal(vector.dimensions.integrity.applicability, "recommended");
  assert.equal(vector.dimensions.maintainability.applicability, "optional");
  assert.ok(vector.claimBoundaries.some((boundary) => boundary.includes("intrinsic data validity")));
  assert.ok(vector.claimBoundaries.some((boundary) => boundary.includes("model capability")));
});

test("absence of CI is not itself a Quality input", () => {
  const vector = buildQualityEvidenceVector(policy, {
    artifacts: ["dataset"],
    evidence: {
      verification: [{ authority: "external", state: "observed", finding: "supports", evidenceClass: "A", sourceId: "dataset-validator" }],
    },
  });
  assert.equal(vector.dimensions.verification.disposition, "evidenced");
  assert.equal(vector.dimensions.verification.findingState, "supports");
  assert.equal(vector.compositeQualityScore, null);
});
