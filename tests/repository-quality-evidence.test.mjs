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
});

test("not-applicable dimensions are excluded rather than scored as failures", () => {
  const vector = buildQualityEvidenceVector(policy, {
    artifacts: ["dataset"],
    applicability: { "security-safety": "not-applicable" },
    evidence: {},
  });
  assert.equal(vector.dimensions["security-safety"].disposition, "excluded");
  assert.equal(vector.dimensions["security-safety"].evidenceState, "unknown");
  assert.equal(vector.compositeQualityScore, null);
});

test("unknown evidence remains unknown instead of becoming zero-quality evidence", () => {
  const vector = buildQualityEvidenceVector(policy, { artifacts: ["research"] });
  assert.equal(vector.dimensions.verification.evidenceState, "unknown");
  assert.equal(vector.dimensions.verification.disposition, "unevidenced");
  assert.equal(vector.compositeQualityScore, null);
});

test("mixed native and external evidence summarizes authority as mixed", () => {
  const vector = buildQualityEvidenceVector(policy, {
    artifacts: ["library"],
    evidence: {
      verification: [
        { authority: "repository-native", state: "observed", evidenceClass: "B", sourceId: "tests" },
        { authority: "external", state: "observed", evidenceClass: "A", sourceId: "conformance" },
      ],
    },
  });
  assert.equal(vector.dimensions.verification.authority, "mixed");
  assert.equal(vector.dimensions.verification.evidenceState, "observed");
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
      verification: [{ authority: "external", state: "observed", evidenceClass: "A", sourceId: "dataset-validator" }],
    },
  });
  assert.equal(vector.dimensions.verification.disposition, "evidenced");
  assert.equal(vector.compositeQualityScore, null);
});
