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
        fork: false,
        archived: false,
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

test("L0 adapter keeps all assessment scores uncollected and production scoring disabled", () => {
  const { artifact } = buildL0RepositoryAssessmentFromGraph(graphFixture(), {
    generatorRevision: revision,
    prominenceCandidateId: "balanced-v1",
  });
  assert.equal(artifact.productionScoring, false);
  for (const repo of artifact.repositories) {
    assert.equal(repo.quality.state, "not-collected");
    assert.equal(repo.impact.state, "not-collected");
    assert.equal(repo.scale.state, "not-collected");
    assert.equal(repo.prominence.state, "not-collected");
    assert.equal(repo.productionScore, null);
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
  });
});
