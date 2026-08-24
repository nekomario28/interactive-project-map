import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildRepositoryAssessmentArtifact,
  makeAssessmentRepositorySkeleton,
} from "../scripts/repository-assessment-artifact.mjs";
import { buildQualityEvidenceVector } from "../scripts/repository-quality-evidence.mjs";
import { buildRepositoryQualityOverlayProjection } from "../scripts/repository-quality-assessment-projection.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const policy = readJson("data/repository-assessment-policy.v1.json");
const applications = readJson("fixtures/repository-quality-real-calibration.v1.json");

const GENERATED_AT = "2026-08-25T00:00:00.000Z";
const GENERATOR_REVISION = "a".repeat(40);
const RELATION = { ownership: "owned", collaboration: "unknown", lineage: "original" };

function applicationQuality(id) {
  const entry = applications.cases.find((candidate) => candidate.id === id);
  return buildQualityEvidenceVector(policy, {
    artifacts: entry.context.artifacts,
    evidence: entry.evidence,
  });
}

function skeleton(name, artifacts) {
  return makeAssessmentRepositorySkeleton("nekomario28", {
    owner: "nekomario28",
    name,
    relation: RELATION,
    categoryId: "visualization-knowledge",
    artifacts,
    observedAt: GENERATED_AT,
  });
}

function artifact(repositories) {
  return buildRepositoryAssessmentArtifact({
    owner: "nekomario28",
    generatedAt: GENERATED_AT,
    generatorRevision: GENERATOR_REVISION,
    repositories,
  });
}

test("assessment projection derives full and compact Quality overlays from one quality section value", () => {
  const assessed = skeleton("interactive-project-map", ["application"]);
  assessed.quality = {
    state: "partial",
    value: applicationQuality("interactive-project-map-application"),
  };
  const projection = buildRepositoryQualityOverlayProjection(policy, artifact([assessed]));
  const entry = projection.repositories[0];

  assert.equal(projection.projectionId, "ipm-repository-quality-overlay-projection-v1");
  assert.equal(entry.overlayState, "available");
  assert.equal(entry.qualitySectionState, "partial");
  assert.equal(entry.unavailableReason, null);
  assert.equal(entry.overlay.segments.length, 8);
  assert.equal(entry.overlay.coverage.targetDimensions, 6);
  assert.equal(entry.overlay.coverage.directionalDimensions, 4);
  assert.equal(entry.overlay.compactDistribution.denominator, 6);
  assert.equal(entry.overlay.compactDistribution.segments.find((segment) => segment.findingState === "supports").count, 4);
  assert.equal(entry.overlay.compactDistribution.segments.find((segment) => segment.findingState === "unknown").count, 2);
  assert.equal(entry.overlay.compositeQualityScore, null);
  assert.equal(entry.overlay.productionRankingAllowed, false);
});

test("not-collected Quality remains overlay-unavailable instead of becoming an eight-unknown ring", () => {
  const unassessed = skeleton("unassessed-repository", ["application"]);
  const projection = buildRepositoryQualityOverlayProjection(policy, artifact([unassessed]));
  const entry = projection.repositories[0];

  assert.equal(entry.qualitySectionState, "not-collected");
  assert.equal(entry.overlayState, "unavailable");
  assert.equal(entry.unavailableReason, "not-collected");
  assert.equal(entry.overlay, null);
  assert.equal(projection.invariants.uncollectedQualityDoesNotBecomeUnknownRing, true);
});

test("explicit unknown section availability remains different from interpreted unknown dimensions", () => {
  const unresolved = skeleton("unresolved-quality", ["application"]);
  unresolved.quality = { state: "unknown", value: null };
  const projection = buildRepositoryQualityOverlayProjection(policy, artifact([unresolved]));

  assert.equal(projection.repositories[0].overlayState, "unavailable");
  assert.equal(projection.repositories[0].unavailableReason, "unknown");
  assert.equal(projection.repositories[0].overlay, null);
});

test("projection rejects a Quality vector routed through artifact context absent from assessment.json", () => {
  const mismatched = skeleton("mismatched-quality-context", ["library"]);
  mismatched.quality = {
    state: "partial",
    value: applicationQuality("interactive-project-map-application"),
  };

  assert.throws(
    () => buildRepositoryQualityOverlayProjection(policy, artifact([mismatched])),
    /Quality vector artifact application is not present in assessment context/,
  );
});

test("projection rejects available Quality when assessment artifact context is still unknown", () => {
  const mismatched = skeleton("unknown-artifact-context", null);
  mismatched.quality = {
    state: "partial",
    value: applicationQuality("interactive-project-map-application"),
  };

  assert.throws(
    () => buildRepositoryQualityOverlayProjection(policy, artifact([mismatched])),
    /cannot expose Quality overlay while artifact context is unknown/,
  );
});
