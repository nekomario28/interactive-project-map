import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRepositoryAssessmentArtifact,
  canonicalRepositoryKey,
  expectedGraphNodeId,
  makeAssessmentRepositorySkeleton,
  validateRepositoryAssessmentArtifact,
} from "../scripts/repository-assessment-artifact.mjs";

const generatedAt = "2026-08-25T00:00:00.000Z";
const revision = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function soloSkeleton() {
  return makeAssessmentRepositorySkeleton("Alice", {
    owner: "Alice",
    name: "ToolKit",
    githubRepositoryId: 123,
    categoryId: "developer-tools",
    artifacts: ["tool"],
    lifecycle: "active",
    relation: "owned-solo",
    observedAt: generatedAt,
  });
}

function contributedSkeleton() {
  return makeAssessmentRepositorySkeleton("Alice", {
    owner: "UpstreamOrg",
    name: "ProjectX",
    githubRepositoryId: null,
    categoryId: "systems-infrastructure",
    artifacts: ["library"],
    lifecycle: "stable",
    relation: "contributed",
    observedAt: generatedAt,
  });
}

function artifact(repositories = [soloSkeleton(), contributedSkeleton()]) {
  return buildRepositoryAssessmentArtifact({
    owner: "Alice",
    generatedAt,
    generatorRevision: revision,
    prominenceCandidateId: "balanced-v1",
    repositories,
  });
}

test("canonical repository key is lowercase owner/name", () => {
  assert.equal(canonicalRepositoryKey("Alice", "ToolKit"), "alice/toolkit");
});

test("current graph join id preserves owned name and qualifies contributed owner/name", () => {
  assert.equal(expectedGraphNodeId("Alice", "Alice", "ToolKit", "owned-solo"), "repository:ToolKit");
  assert.equal(expectedGraphNodeId("Alice", "UpstreamOrg", "ProjectX", "contributed"), "repository:upstreamorg/projectx");
});

test("L0 skeleton preserves uncollected evidence instead of zero scores", () => {
  const solo = soloSkeleton();
  assert.equal(solo.acquisition.level, "L0");
  assert.deepEqual(solo.quality, { state: "not-collected", value: null });
  assert.deepEqual(solo.impact, { state: "not-collected", value: null });
  assert.deepEqual(solo.personalContribution, { state: "not-applicable", value: null });
  assert.equal(solo.productionScore, null);

  const contributed = contributedSkeleton();
  assert.deepEqual(contributed.personalContribution, { state: "not-collected", value: null });
});

test("assessment artifact validates without changing graph schema", () => {
  const value = artifact();
  assert.equal(validateRepositoryAssessmentArtifact(value), true);
  assert.equal(value.productionScoring, false);
  assert.equal(value.repositories[0].identity.graphNodeId, "repository:ToolKit");
  assert.equal(value.repositories[1].identity.graphNodeId, "repository:upstreamorg/projectx");
});

test("duplicate canonical repository identities are rejected", () => {
  const first = soloSkeleton();
  const duplicate = structuredClone(first);
  duplicate.identity.owner = "alice";
  duplicate.identity.repositoryKey = "alice/toolkit";
  assert.throws(() => artifact([first, duplicate]), /duplicate repositoryKey/);
});

test("graph-node join mismatches are rejected", () => {
  const value = artifact();
  value.repositories[0].identity.graphNodeId = "repository:wrong";
  assert.throws(() => validateRepositoryAssessmentArtifact(value), /graphNodeId/);
});

test("production scoring and productionScore remain disabled in experimental v1", () => {
  const value = artifact();
  value.productionScoring = true;
  assert.throws(() => validateRepositoryAssessmentArtifact(value), /productionScoring/);

  const value2 = artifact();
  value2.repositories[0].productionScore = 0.9;
  assert.throws(() => validateRepositoryAssessmentArtifact(value2), /productionScore/);
});

test("shared work cannot fabricate personal prominence before contribution evidence is observed", () => {
  const value = artifact();
  const shared = value.repositories[1];
  shared.prominence = {
    state: "partial",
    value: {
      candidateId: "balanced-v1",
      projectProminence: 0.9,
      personalPortfolioProminence: 0.7,
    },
  };
  assert.throws(() => validateRepositoryAssessmentArtifact(value), /fabricate personal prominence/);

  shared.prominence.value.personalPortfolioProminence = null;
  assert.equal(validateRepositoryAssessmentArtifact(value), true);
});

test("generator revision and observation time remain separate validated identities", () => {
  const value = artifact();
  value.generatorRevision = "short";
  assert.throws(() => validateRepositoryAssessmentArtifact(value), /40-hex/);

  const value2 = artifact();
  value2.repositories[0].acquisition.observedAt = "not-a-date";
  assert.throws(() => validateRepositoryAssessmentArtifact(value2), /ISO timestamp/);
});
