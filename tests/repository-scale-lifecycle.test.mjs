import test from "node:test";
import assert from "node:assert/strict";

import { buildRepositoryScaleEvidence } from "../scripts/repository-scale-features.mjs";
import { buildRepositoryLifecycleContext } from "../scripts/repository-lifecycle-context.mjs";

const TEAM_ORIGINAL = { ownership: "owned", collaboration: "team", lineage: "original" };
const CONTRIBUTED = { ownership: "contributed", collaboration: "unknown", lineage: "original" };
const OWNED_FORK = { ownership: "owned", collaboration: "unknown", lineage: "fork" };
const OWNED_UNKNOWN = { ownership: "owned", collaboration: "unknown", lineage: "original" };

test("Scale uses breadth and coordination evidence without LOC/commit/workflow shortcuts", () => {
  const result = buildRepositoryScaleEvidence({
    relation: TEAM_ORIGINAL,
    subsystems: 5,
    supportedPlatforms: 3,
    integrations: 4,
    operationalSurfaces: 2,
    contributors: 12,
    maintainers: 3,
    scopeEvidence: "multiple packages plus deployment and integration surfaces",
  });

  assert.ok(result.projectSide.signals.includes("multi-subsystem"));
  assert.ok(result.projectSide.signals.includes("multi-platform"));
  assert.ok(result.projectSide.signals.includes("multi-contributor"));
  assert.equal(result.projectSide.locUsedAsScale, false);
  assert.equal(result.projectSide.commitCountUsedAsScale, false);
  assert.equal(result.projectSide.workflowCountUsedAsScale, false);
  assert.equal(result.attribution.profile, "team");
  assert.equal(result.compositeScale, null);
});

test("person-side contribution fields are rejected from project Scale extraction", () => {
  assert.throws(
    () => buildRepositoryScaleEvidence({ relation: CONTRIBUTED, mergedPullRequests: 40 }),
    /person-side evidence/,
  );
});

test("fork upstream Scale remains context-only", () => {
  const result = buildRepositoryScaleEvidence({
    relation: OWNED_FORK,
    subsystems: 1,
    contributors: 1,
    parent: {
      subsystems: 18,
      supportedPlatforms: 6,
      integrations: 20,
      operationalSurfaces: 8,
      contributors: 300,
      maintainers: 20,
    },
  });

  assert.equal(result.upstreamContext.contextOnly, true);
  assert.equal(result.upstreamContext.eligibleForLocalScale, false);
  assert.equal(result.attribution.profile, "fork");
  assert.equal(result.attribution.upstreamScaleIsContextOnly, true);
  assert.equal(result.compositeScale, null);
});

test("unknown Scale evidence and collaboration stay unknown rather than zero or solo", () => {
  const result = buildRepositoryScaleEvidence({ relation: OWNED_UNKNOWN });
  assert.equal(result.projectSide.technicalBreadth.subsystems.state, "unknown");
  assert.equal(result.projectSide.organizationalBreadth.contributors.raw, null);
  assert.equal(result.attribution.profile, "unresolved");
  assert.equal(result.attribution.collaborationState, "unknown");
});

test("parent Scale context is rejected for original lineage", () => {
  assert.throws(
    () => buildRepositoryScaleEvidence({ relation: TEAM_ORIGINAL, parent: { subsystems: 4 } }),
    /only valid when relation.lineage is fork/,
  );
});

test("frozen dataset lifecycle does not treat inactivity as poor health or Quality", () => {
  const result = buildRepositoryLifecycleContext({
    lifecycle: "frozen",
    daysSincePush: 730,
    commitsPast90Days: 0,
    releasesPast12Months: 0,
    frozenIdentity: true,
    versionedArtifact: true,
  });

  assert.equal(result.interpretation.mode, "activity-not-required-by-lifecycle");
  assert.equal(result.interpretation.inactivityIsAutomaticQualityPenalty, false);
  assert.equal(result.interpretation.inactivityIsAutomaticHealthFailure, false);
  assert.equal(result.boundaries.frozenOrSnapshotCanBeHealthyWithoutRecentActivity, true);
  assert.equal(result.healthInference, null);
});

test("active lifecycle keeps Activity informative but not an automatic Quality/health verdict", () => {
  const result = buildRepositoryLifecycleContext({
    lifecycle: "active",
    daysSincePush: 40,
    commitsPast90Days: 0,
  });

  assert.equal(result.interpretation.mode, "activity-may-be-informative");
  assert.equal(result.interpretation.inactivityIsAutomaticQualityPenalty, false);
  assert.equal(result.interpretation.inactivityIsAutomaticHealthFailure, false);
  assert.equal(result.compositeMaturity, null);
  assert.equal(result.compositeActivity, null);
});

test("release count alone does not become Maturity", () => {
  const result = buildRepositoryLifecycleContext({ lifecycle: "stable", releaseCount: 100 });
  assert.equal(result.boundaries.releaseCountAloneIsNotMaturity, true);
  assert.equal(result.compositeMaturity, null);
});
