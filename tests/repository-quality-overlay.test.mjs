import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildQualityConfidenceVector } from "../scripts/repository-quality-confidence.mjs";
import { buildQualityEvidenceVector } from "../scripts/repository-quality-evidence.mjs";
import { buildQualityOverlayModel } from "../scripts/repository-quality-overlay.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const policy = readJson("data/repository-assessment-policy.v1.json");
const applications = readJson("fixtures/repository-quality-real-calibration.v1.json");
const dataset = readJson("fixtures/repository-quality-external-dataset-calibration.v1.json");

function evaluate(artifacts, evidence, applicability = undefined) {
  const quality = buildQualityEvidenceVector(policy, { artifacts, evidence, applicability });
  const confidence = buildQualityConfidenceVector(policy, quality);
  const overlay = buildQualityOverlayModel(policy, quality, confidence);
  return { quality, confidence, overlay };
}

function application(id) {
  const entry = applications.cases.find((item) => item.id === id);
  return evaluate(entry.context.artifacts, entry.evidence);
}

test("Quality overlay uses fixed global dimension slots without producing a score or rank", () => {
  const { overlay } = application("interactive-project-map-application");
  assert.deepEqual(overlay.dimensionOrder, policy.qualityDimensions);
  assert.equal(overlay.segments.length, policy.qualityDimensions.length);
  assert.deepEqual(overlay.segments.map((segment) => segment.slot), policy.qualityDimensions.map((_, index) => index));
  assert.equal(overlay.visualContract.fixedGlobalDimensionSlots, true);
  assert.equal(overlay.visualContract.nodeSizeEffect, "none");
  assert.equal(overlay.visualContract.labelPriorityEffect, "none");
  assert.equal(overlay.compositeQualityScore, null);
  assert.equal(overlay.productionRankingAllowed, false);
});

test("application overlay exposes support, unknown coverage and no scalar Quality", () => {
  const { overlay } = application("interactive-project-map-application");
  assert.equal(overlay.coverage.targetDimensions, 6);
  assert.equal(overlay.coverage.directionalDimensions, 4);
  assert.equal(overlay.coverage.label, "4/6 interpreted");
  assert.equal(overlay.targetFindingCounts.supports, 4);
  assert.equal(overlay.targetFindingCounts.unknown, 2);
  assert.equal(overlay.attentionState, "incomplete-evidence");

  const targetUnknown = overlay.segments.filter((segment) => segment.target && segment.findingState === "unknown");
  assert.equal(targetUnknown.length, 2);
  assert.ok(targetUnknown.every((segment) => segment.token === "quality-unknown"));
});

test("compact ring summarizes target findings without pretending to preserve dimension identity", () => {
  const ipm = application("interactive-project-map-application").overlay;
  const group = application("projexd-group10-application").overlay;
  const externalDataset = evaluate(dataset.subject.artifacts, dataset.qualityEvidence).overlay;

  assert.equal(ipm.compactDistribution.denominator, 6);
  assert.equal(ipm.compactDistribution.segments.find((entry) => entry.findingState === "supports").ratio, 4 / 6);
  assert.equal(ipm.compactDistribution.segments.find((entry) => entry.findingState === "unknown").ratio, 2 / 6);

  assert.equal(group.compactDistribution.denominator, 6);
  assert.equal(group.compactDistribution.segments.find((entry) => entry.findingState === "supports").count, 2);
  assert.equal(group.compactDistribution.segments.find((entry) => entry.findingState === "weakens").count, 1);
  assert.equal(group.compactDistribution.segments.find((entry) => entry.findingState === "unknown").count, 3);

  assert.equal(externalDataset.compactDistribution.denominator, 5);
  assert.equal(externalDataset.compactDistribution.segments.find((entry) => entry.findingState === "supports").count, 4);
  assert.equal(externalDataset.compactDistribution.segments.find((entry) => entry.findingState === "unknown").count, 1);

  for (const overlay of [ipm, group, externalDataset]) {
    assert.equal(overlay.compactDistribution.dimensionIdentityPreserved, false);
    assert.equal(overlay.compactDistribution.requiresDetailForDimensionIdentity, true);
    assert.equal(overlay.compactDistribution.compositeQualityScore, null);
    assert.equal(overlay.visualContract.compactRingEncoding, "target-finding-distribution");
  }
});

test("weakening evidence gets a semantic overlay token instead of becoming a smaller node", () => {
  const { overlay } = application("projexd-group10-application");
  const stewardship = overlay.segments.find((segment) => segment.id === "stewardship");
  assert.equal(stewardship.findingState, "weakens");
  assert.equal(stewardship.token, "quality-weakens");
  assert.equal(overlay.attentionState, "weakening-evidence");
  assert.equal(overlay.visualContract.nodeSizeEffect, "none");
});

test("dataset overlay keeps the same eight slots while changing which dimensions are targets", () => {
  const applicationOverlay = application("interactive-project-map-application").overlay;
  const datasetOverlay = evaluate(dataset.subject.artifacts, dataset.qualityEvidence).overlay;

  assert.deepEqual(datasetOverlay.dimensionOrder, applicationOverlay.dimensionOrder);
  assert.equal(datasetOverlay.coverage.targetDimensions, 5);
  assert.equal(datasetOverlay.coverage.directionalDimensions, 4);
  assert.equal(datasetOverlay.targetFindingCounts.supports, 4);
  assert.equal(datasetOverlay.targetFindingCounts.unknown, 1);

  const integrity = datasetOverlay.segments.find((segment) => segment.id === "integrity");
  const verification = datasetOverlay.segments.find((segment) => segment.id === "verification");
  assert.equal(integrity.target, true);
  assert.equal(integrity.token, "quality-unknown");
  assert.equal(verification.target, false);
  assert.equal(verification.token, "quality-optional");
});

test("explicit N/A applicability becomes a gap semantic and leaves both full and compact target denominators", () => {
  const entry = applications.cases.find((item) => item.id === "projexd-group10-application");
  const { overlay } = evaluate(entry.context.artifacts, entry.evidence, { "security-safety": "not-applicable" });
  const security = overlay.segments.find((segment) => segment.id === "security-safety");

  assert.equal(security.applicability, "not-applicable");
  assert.equal(security.target, false);
  assert.equal(security.token, "quality-not-applicable");
  assert.equal(overlay.coverage.targetDimensions, 5);
  assert.equal(overlay.compactDistribution.denominator, 5);
  assert.equal(overlay.compactDistribution.segments.find((entry) => entry.findingState === "supports").count, 2);
  assert.equal(overlay.compactDistribution.segments.find((entry) => entry.findingState === "weakens").count, 1);
  assert.equal(overlay.compactDistribution.segments.find((entry) => entry.findingState === "unknown").count, 2);
  assert.equal(overlay.visualContract.notApplicableUsesGapSemantic, true);
});

test("mixed evidence stays visually distinct from neutral and unknown", () => {
  const { overlay } = evaluate(["application"], {
    verification: [
      {
        authority: "repository-native",
        state: "observed",
        finding: "supports",
        evidenceClass: "C",
        sourceId: "counterexample:mixed-pass",
      },
      {
        authority: "repository-native",
        state: "observed",
        finding: "weakens",
        evidenceClass: "C",
        sourceId: "counterexample:mixed-fail",
      },
    ],
  });
  const verification = overlay.segments.find((segment) => segment.id === "verification");
  const mixedCompact = overlay.compactDistribution.segments.find((entry) => entry.findingState === "mixed");

  assert.equal(verification.findingState, "mixed");
  assert.equal(verification.token, "quality-mixed");
  assert.equal(mixedCompact.count, 1);
  assert.equal(overlay.attentionState, "mixed-evidence");
});

test("optional dimensions remain visible semantically but do not inflate Confidence or compact distribution", () => {
  const { overlay } = evaluate(dataset.subject.artifacts, {
    ...dataset.qualityEvidence,
    verification: [
      {
        authority: "repository-native",
        state: "observed",
        finding: "supports",
        evidenceClass: "C",
        sourceId: "counterexample:optional-verification",
      },
    ],
  });
  const verification = overlay.segments.find((segment) => segment.id === "verification");

  assert.equal(verification.target, false);
  assert.equal(verification.token, "quality-optional");
  assert.equal(verification.directional, true);
  assert.equal(overlay.coverage.targetDimensions, 5);
  assert.equal(overlay.coverage.directionalDimensions, 4);
  assert.equal(overlay.compactDistribution.denominator, 5);
  assert.equal(overlay.compactDistribution.segments.find((entry) => entry.findingState === "supports").count, 4);
  assert.equal(overlay.visualContract.optionalDimensionsDoNotInflateCoverage, true);
});
