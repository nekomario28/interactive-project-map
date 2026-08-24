import test from "node:test";
import assert from "node:assert/strict";

import { buildL0RepositoryAssessmentFromGraph } from "../scripts/repository-assessment-from-graph.mjs";
import { validateRepositoryAssessmentArtifact } from "../scripts/repository-assessment-artifact.mjs";

const revision = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const generatedAt = "2026-08-25T00:30:00.000Z";

function graphFixture() {
  return {
    owner: "Alice",
    generatedAt,
    nodes: [
      { id: "user:Alice", type: "owner", label: "Alice" },
      {
        id: "repository:Toolkit",
        type: "repository",
        label: "Toolkit",
        stars: 10,
        forks: 2,
        fork: false,
        archived: false,
        taxonomyAssignment: {
          categoryId: "developer-tools",
          secondaryTags: ["artifact:tool", "platform:cli"],
        },
      },
      {
        id: "repository:ForkedLib",
        type: "repository",
        label: "ForkedLib",
        stars: 0,
        forks: 0,
        fork: true,
        archived: false,
        classification: {
          categoryId: "developer-tools",
          secondaryTags: ["artifact:library"],
        },
      },
      {
        id: "repository:upstreamorg/projectx",
        type: "repository",
        label: "UpstreamOrg/ProjectX",
        relation: "contributed",
        repositoryOwner: "UpstreamOrg",
        repositoryName: "ProjectX",
        stars: 1000,
        forks: 200,
        fork: false,
        archived: false,
        contribution: {
          commits: 3,
          mergedPullRequests: 2,
        },
        classification: {
          categoryId: "uncategorized",
          secondaryTags: [],
        },
      },
      {
        id: "repository:upstreamorg/archive",
        type: "repository",
        label: "UpstreamOrg/Archive",
        relation: "contributed",
        repositoryOwner: "UpstreamOrg",
        repositoryName: "Archive",
        fork: true,
        archived: true,
      },
    ],
    edges: [],
  };
}

test("L0 adapter derives only graph-observed relation axes and never assumes solo", () => {
  const { artifact, diagnostics } = buildL0RepositoryAssessmentFromGraph(graphFixture(), { generatorRevision: revision });
  assert.equal(validateRepositoryAssessmentArtifact(artifact), true);
  assert.equal(artifact.repositories.length, 4);
  assert.equal(diagnostics.collaborationUnknown, 4);

  const toolkit = artifact.repositories.find((repo) => repo.identity.name === "Toolkit");
  assert.deepEqual(toolkit.context.relation, { ownership: "owned", collaboration: "unknown", lineage: "original" });
  assert.deepEqual(toolkit.personalContribution, { state: "not-collected", value: null });

  const forked = artifact.repositories.find((repo) => repo.identity.name === "ForkedLib");
  assert.deepEqual(forked.context.relation, { ownership: "owned", collaboration: "unknown", lineage: "fork" });

  const contributed = artifact.repositories.find((repo) => repo.identity.name === "ProjectX");
  assert.deepEqual(contributed.context.relation, { ownership: "contributed", collaboration: "unknown", lineage: "original" });
  assert.equal(contributed.identity.graphNodeId, "repository:upstreamorg/projectx");
});

test("taxonomy assignment wins category routing and fallback accepts only Standard Taxonomy ids", () => {
  const { artifact } = buildL0RepositoryAssessmentFromGraph(graphFixture(), { generatorRevision: revision });
  const toolkit = artifact.repositories.find((repo) => repo.identity.name === "Toolkit");
  assert.deepEqual(toolkit.context.category, { state: "observed", id: "developer-tools" });
  assert.deepEqual(toolkit.context.artifacts, { state: "observed", values: ["tool"] });

  const forked = artifact.repositories.find((repo) => repo.identity.name === "ForkedLib");
  assert.deepEqual(forked.context.category, { state: "observed", id: "developer-tools" });
  assert.deepEqual(forked.context.artifacts, { state: "observed", values: ["library"] });

  const contributed = artifact.repositories.find((repo) => repo.identity.name === "ProjectX");
  assert.deepEqual(contributed.context.category, { state: "unknown", id: null });
  assert.deepEqual(contributed.context.artifacts, { state: "unknown", values: [] });
});

test("legacy or uncategorized classifier ids do not become Standard Taxonomy assessment categories", () => {
  const fixture = graphFixture();
  fixture.nodes.push({
    id: "repository:LegacyRobotics",
    type: "repository",
    label: "LegacyRobotics",
    fork: false,
    archived: false,
    classification: {
      categoryId: "robotics",
      secondaryTags: [],
    },
  });
  const { artifact } = buildL0RepositoryAssessmentFromGraph(fixture, { generatorRevision: revision });
  const legacy = artifact.repositories.find((repo) => repo.identity.name === "LegacyRobotics");
  assert.deepEqual(legacy.context.category, { state: "unknown", id: null });
});

test("existing stars and forks become partial Impact evidence without becoming Quality", () => {
  const { artifact } = buildL0RepositoryAssessmentFromGraph(graphFixture(), { generatorRevision: revision });

  const toolkit = artifact.repositories.find((repo) => repo.identity.name === "Toolkit");
  assert.equal(toolkit.impact.state, "partial");
  assert.equal(toolkit.impact.value.projectSide.recognition.raw, 10);
  assert.equal(toolkit.impact.value.projectSide.reuseDerivativeInterest.raw, 2);
  assert.equal(toolkit.impact.value.projectSide.recognition.directQualityEffect, false);
  assert.equal(toolkit.impact.value.compositeImpact, null);
  assert.equal(toolkit.quality.state, "not-collected");

  const forked = artifact.repositories.find((repo) => repo.identity.name === "ForkedLib");
  assert.equal(forked.impact.state, "partial");
  assert.equal(forked.impact.value.projectSide.recognition.raw, 0);
  assert.equal(forked.impact.value.upstreamContext.state, "unknown");
  assert.equal(forked.impact.value.upstreamContext.contextOnly, true);

  const missing = artifact.repositories.find((repo) => repo.identity.name === "Archive");
  assert.deepEqual(missing.impact, { state: "not-collected", value: null });
});

test("existing Contributed activity becomes partial person-side evidence without a contribution score", () => {
  const { artifact } = buildL0RepositoryAssessmentFromGraph(graphFixture(), { generatorRevision: revision });
  const contributed = artifact.repositories.find((repo) => repo.identity.name === "ProjectX");

  assert.equal(contributed.personalContribution.state, "partial");
  assert.equal(contributed.personalContribution.value.activity.commits.raw, 3);
  assert.equal(contributed.personalContribution.value.activity.mergedPullRequests.raw, 2);
  assert.equal(contributed.personalContribution.value.responsibility.maintainerRole.state, "unknown");
  assert.equal(contributed.personalContribution.value.compositePersonalContribution, null);
  assert.equal(contributed.prominence.state, "not-collected");

  const noContributionRecord = artifact.repositories.find((repo) => repo.identity.name === "Archive");
  assert.deepEqual(noContributionRecord.personalContribution, { state: "not-collected", value: null });
});

test("missing contributed facets and lifecycle evidence remain explicitly unknown", () => {
  const { artifact, diagnostics } = buildL0RepositoryAssessmentFromGraph(graphFixture(), { generatorRevision: revision });
  const contributed = artifact.repositories.find((repo) => repo.identity.name === "ProjectX");
  assert.deepEqual(contributed.context.category, { state: "unknown", id: null });
  assert.deepEqual(contributed.context.artifacts, { state: "unknown", values: [] });
  assert.equal(contributed.context.lifecycle, "unknown");

  const archived = artifact.repositories.find((repo) => repo.identity.name === "Archive");
  assert.deepEqual(archived.context.category, { state: "unknown", id: null });
  assert.deepEqual(archived.context.artifacts, { state: "unknown", values: [] });
  assert.equal(archived.context.lifecycle, "archived");
  assert.equal(archived.context.relation.lineage, "fork");

  assert.equal(diagnostics.categoryUnknown, 2);
  assert.equal(diagnostics.artifactsUnknown, 2);
  assert.equal(diagnostics.archived, 1);
});

test("L0 evidence vectors remain non-scoring and production scoring stays disabled", () => {
  const { artifact } = buildL0RepositoryAssessmentFromGraph(graphFixture(), {
    generatorRevision: revision,
    prominenceCandidateId: "balanced-v1",
  });
  assert.equal(artifact.productionScoring, false);
  for (const repo of artifact.repositories) {
    assert.equal(repo.quality.state, "not-collected");
    assert.equal(repo.scale.state, "not-collected");
    assert.equal(repo.prominence.state, "not-collected");
    assert.equal(repo.productionScore, null);
    if (repo.impact.value) assert.equal(repo.impact.value.compositeImpact, null);
    if (repo.personalContribution.value) assert.equal(repo.personalContribution.value.compositePersonalContribution, null);
  }
});

test("diagnostics make L0 evidence coverage visible", () => {
  const { diagnostics } = buildL0RepositoryAssessmentFromGraph(graphFixture(), { generatorRevision: revision });
  assert.deepEqual(diagnostics, {
    repositories: 4,
    owned: 2,
    contributed: 2,
    forks: 2,
    collaborationUnknown: 4,
    categoryObserved: 2,
    categoryUnknown: 2,
    artifactsObserved: 2,
    artifactsUnknown: 2,
    archived: 1,
    lifecycleUnknown: 3,
    impactPartial: 3,
    impactNotCollected: 1,
    personalContributionPartial: 1,
    personalContributionNotCollected: 3,
  });
});
