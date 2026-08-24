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
const calibration = readJson("fixtures/repository-quality-real-calibration.v1.json");

function qualityFor(entry) {
  return buildQualityEvidenceVector(policy, {
    artifacts: entry.context.artifacts,
    evidence: entry.evidence,
  });
}

test("Confidence reports coverage without inventing a confidence score", () => {
  const quality = buildQualityEvidenceVector(policy, { artifacts: ["application"] });
  const confidence = buildQualityConfidenceVector(policy, quality);

  assert.equal(confidence.coverage.targetDimensions, 6);
  assert.equal(confidence.coverage.inspectedDimensions, 0);
  assert.equal(confidence.coverage.directionalDimensions, 0);
  assert.equal(confidence.coverage.inspectedCoverageRatio, 0);
  assert.equal(confidence.coverage.directionalCoverageRatio, 0);
  assert.equal(confidence.compositeConfidenceScore, null);
});

test("real application calibration produces inspectable coverage ratios", () => {
  const byId = new Map(calibration.cases.map((entry) => [entry.id, entry]));
  const cases = [
    ["interactive-project-map-application", 4, 4],
    ["projexd-group10-application", 3, 3],
    ["projexd4-contributed-application", 3, 3],
  ];

  for (const [id, inspected, directional] of cases) {
    const confidence = buildQualityConfidenceVector(policy, qualityFor(byId.get(id)));
    assert.equal(confidence.coverage.targetDimensions, 6, id);
    assert.equal(confidence.coverage.inspectedDimensions, inspected, id);
    assert.equal(confidence.coverage.directionalDimensions, directional, id);
    assert.equal(confidence.coverage.inspectedCoverageRatio, inspected / 6, id);
    assert.equal(confidence.coverage.directionalCoverageRatio, directional / 6, id);
    assert.equal(confidence.compositeConfidenceScore, null, id);
  }
});

test("evidence class distribution stays visible instead of becoming a hidden weight", () => {
  const entry = calibration.cases.find((item) => item.id === "interactive-project-map-application");
  const confidence = buildQualityConfidenceVector(policy, qualityFor(entry));

  assert.deepEqual(confidence.evidenceClassCounts, {
    A: 0,
    B: 1,
    C: 3,
    D: 0,
    U: 0,
  });
  assert.equal(confidence.authorityCounts["project-owned"], 1);
  assert.equal(confidence.authorityCounts["repository-native"], 3);
  assert.equal(confidence.compositeConfidenceScore, null);
});

test("inspected evidence and directional interpretation remain separate Confidence coverage concepts", () => {
  const quality = buildQualityEvidenceVector(policy, {
    artifacts: ["application"],
    evidence: {
      verification: [
        {
          authority: "repository-native",
          state: "observed",
          finding: "unknown",
          evidenceClass: "C",
          sourceId: "run:observed-result-not-interpreted",
        },
      ],
    },
  });
  const confidence = buildQualityConfidenceVector(policy, quality);

  assert.equal(confidence.dimensionCoverage.verification.inspected, true);
  assert.equal(confidence.dimensionCoverage.verification.directional, false);
  assert.equal(confidence.coverage.inspectedDimensions, 1);
  assert.equal(confidence.coverage.directionalDimensions, 0);
});

test("optional dimension evidence does not inflate required/recommended coverage", () => {
  const quality = buildQualityEvidenceVector(policy, {
    artifacts: ["application"],
    evidence: {
      integrity: [
        {
          authority: "repository-native",
          state: "observed",
          finding: "supports",
          evidenceClass: "C",
          sourceId: "optional-integrity-evidence",
        },
      ],
    },
  });
  const confidence = buildQualityConfidenceVector(policy, quality);

  assert.equal(confidence.dimensionCoverage.integrity.target, false);
  assert.equal(confidence.dimensionCoverage.integrity.inspected, true);
  assert.equal(confidence.coverage.inspectedDimensions, 0);
  assert.equal(confidence.coverage.directionalDimensions, 0);
});
