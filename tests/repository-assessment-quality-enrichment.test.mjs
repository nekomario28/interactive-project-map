import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildL0RepositoryAssessmentFromGraph } from "../scripts/repository-assessment-from-graph.mjs";
import { enrichAssessmentArtifactQuality } from "../scripts/repository-assessment-quality-enrichment.mjs";
import { buildQualityEvidenceVector } from "../scripts/repository-quality-evidence.mjs";
import { buildRepositoryQualityOverlayProjection } from "../scripts/repository-quality-assessment-projection.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const policy = JSON.parse(fs.readFileSync(path.join(root, "data/repository-assessment-policy.v1.json"), "utf8"));
const revision = "cccccccccccccccccccccccccccccccccccccccc";
const generatedAt = "2026-08-25T02:00:00.000Z";

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
        taxonomyAssignment: {
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
        stars: 100,
        forks: 20,
        fork: false,
        archived: false,
      },
    ],
    edges: [],
  };
}

function quality(artifacts, evidence = {}) {
  return buildQualityEvidenceVector(policy, { artifacts, evidence });
}

function support(sourceId) {
  return [{
    authority: "repository-native",
    state: "observed",
    finding: "supports",
    evidenceClass: "C",
    sourceId,
  }];
}

test("Quality enrichment updates only existing canonical repository keys and preserves L0 evidence", () => {
  const { artifact: l0 } = buildL0RepositoryAssessmentFromGraph(graphFixture(), { generatorRevision: revision });
  const toolkitQuality = quality(["tool"], {
    understandability: support("README.md@test"),
    stewardship: support("LICENSE@test"),
  });

  const { artifact, diagnostics } = enrichAssessmentArtifactQuality(policy, l0, [{
    repositoryKey: "ALICE/TOOLKIT",
    state: "partial",
    value: toolkitQuality,
    acquisitionLevel: "L1",
  }]);

  assert.equal(artifact.repositories.length, l0.repositories.length);
  assert.equal(diagnostics.repositoriesBefore, 3);
  assert.equal(diagnostics.repositoriesAfter, 3);
  assert.equal(diagnostics.applied, 1);
  assert.equal(diagnostics.partial, 1);
  assert.equal(diagnostics.acquisitionElevated, 1);

  const toolkit = artifact.repositories.find((entry) => entry.identity.repositoryKey === "alice/toolkit");
  assert.equal(toolkit.quality.state, "partial");
  assert.deepEqual(toolkit.quality.value, toolkitQuality);
  assert.equal(toolkit.acquisition.level, "L1");
  assert.equal(toolkit.impact.state, "partial");
  assert.equal(toolkit.impact.value.projectSide.recognition.raw, 10);
  assert.equal(toolkit.productionScore, null);

  const untouched = artifact.repositories.find((entry) => entry.identity.repositoryKey === "alice/forkedlib");
  assert.equal(untouched.quality.state, "not-collected");
  assert.equal(untouched.acquisition.level, "L0");
});

test("enriched full L0 artifact projects Quality only for assessed repositories", () => {
  const { artifact: l0 } = buildL0RepositoryAssessmentFromGraph(graphFixture(), { generatorRevision: revision });
  const toolkitQuality = quality(["tool"], {
    understandability: support("README.md@test"),
  });
  const { artifact } = enrichAssessmentArtifactQuality(policy, l0, [{
    repositoryKey: "alice/toolkit",
    value: toolkitQuality,
  }]);
  const projection = buildRepositoryQualityOverlayProjection(policy, artifact);

  assert.equal(projection.repositories.length, 3);
  assert.equal(projection.repositories.filter((entry) => entry.overlayState === "available").length, 1);
  assert.equal(projection.repositories.filter((entry) => entry.overlayState === "unavailable").length, 2);
  assert.equal(projection.repositories.find((entry) => entry.repositoryKey === "alice/toolkit").overlay.targetFindingCounts.supports, 1);
});

test("Quality enrichment cannot add a donor or any repository absent from the personal assessment artifact", () => {
  const { artifact: l0 } = buildL0RepositoryAssessmentFromGraph(graphFixture(), { generatorRevision: revision });
  const donorQuality = quality(["dataset"], {
    understandability: support("donor-readme@test"),
  });

  assert.throws(
    () => enrichAssessmentArtifactQuality(policy, l0, [{
      repositoryKey: "external-donor/data",
      value: donorQuality,
    }]),
    /cannot add repository not already present in assessment artifact/,
  );
  assert.equal(l0.repositories.some((entry) => entry.identity.repositoryKey === "external-donor/data"), false);
});

test("Quality enrichment rejects artifact-route mismatch and unknown artifact context", () => {
  const { artifact: l0 } = buildL0RepositoryAssessmentFromGraph(graphFixture(), { generatorRevision: revision });
  const applicationQuality = quality(["application"], {
    understandability: support("wrong-route@test"),
  });

  assert.throws(
    () => enrichAssessmentArtifactQuality(policy, l0, [{
      repositoryKey: "alice/toolkit",
      value: applicationQuality,
    }]),
    /Quality artifact application is not present in assessment context/,
  );

  const contributedQuality = quality(["application"], {
    understandability: support("contributed@test"),
  });
  assert.throws(
    () => enrichAssessmentArtifactQuality(policy, l0, [{
      repositoryKey: "upstreamorg/projectx",
      value: contributedQuality,
    }]),
    /cannot receive Quality while artifact context is unknown/,
  );
});

test("duplicate enrichment requests fail closed and leave the source artifact unchanged", () => {
  const { artifact: l0 } = buildL0RepositoryAssessmentFromGraph(graphFixture(), { generatorRevision: revision });
  const toolkitQuality = quality(["tool"], {
    understandability: support("README.md@test"),
  });

  assert.throws(
    () => enrichAssessmentArtifactQuality(policy, l0, [
      { repositoryKey: "alice/toolkit", value: toolkitQuality },
      { repositoryKey: "ALICE/TOOLKIT", value: toolkitQuality },
    ]),
    /duplicate Quality enrichment/,
  );
  assert.equal(l0.repositories.find((entry) => entry.identity.repositoryKey === "alice/toolkit").quality.state, "not-collected");
});
