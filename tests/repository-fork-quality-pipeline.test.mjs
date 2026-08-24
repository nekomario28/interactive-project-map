import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildL0RepositoryAssessmentFromGraph } from "../scripts/repository-assessment-from-graph.mjs";
import { enrichAssessmentArtifactQuality } from "../scripts/repository-assessment-quality-enrichment.mjs";
import { buildForkQualityBundle } from "../scripts/repository-fork-quality.mjs";
import { buildQualityEvidenceVector } from "../scripts/repository-quality-evidence.mjs";
import { buildRepositoryQualityOverlayProjection } from "../scripts/repository-quality-assessment-projection.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const policy = JSON.parse(fs.readFileSync(path.join(root, "data/repository-assessment-policy.v1.json"), "utf8"));
const revision = "dddddddddddddddddddddddddddddddddddddddd";

function graphFixture() {
  return {
    owner: "Alice",
    generatedAt: "2026-08-25T05:00:00.000Z",
    nodes: [{
      id: "repository:ForkedLib",
      type: "repository",
      label: "ForkedLib",
      stars: 0,
      forks: 0,
      fork: true,
      archived: false,
      taxonomyAssignment: { categoryId: "developer-tools", secondaryTags: ["artifact:library"] },
    }],
    edges: [],
  };
}

function evidence(origin, sourceId) {
  return [{
    origin,
    authority: "repository-native",
    state: "observed",
    finding: "supports",
    evidenceClass: "C",
    sourceId,
    claim: sourceId,
  }];
}

test("generic repository snapshot Quality is rejected for fork enrichment", () => {
  const { artifact } = buildL0RepositoryAssessmentFromGraph(graphFixture(), { generatorRevision: revision });
  const generic = buildQualityEvidenceVector(policy, {
    artifacts: ["library"],
    evidence: { understandability: evidence("upstream-inherited", "README").map(({ origin: _origin, ...entry }) => entry) },
  });

  assert.throws(
    () => enrichAssessmentArtifactQuality(policy, artifact, [{ repositoryKey: "alice/forkedlib", value: generic }]),
    /fork Quality requires provenance-aware fork bundle/,
  );
});

test("inherited snapshot evidence may be stored as context but cannot produce a fork portfolio Quality ring without local delta", () => {
  const { artifact } = buildL0RepositoryAssessmentFromGraph(graphFixture(), { generatorRevision: revision });
  const relation = artifact.repositories[0].context.relation;
  const bundle = buildForkQualityBundle(policy, {
    relation,
    artifacts: ["library"],
    upstream: { repositoryKey: "upstream/forkedlib" },
    snapshotEvidence: {
      understandability: evidence("upstream-inherited", "README"),
      stewardship: evidence("upstream-inherited", "LICENSE"),
    },
    localDeltaObservation: {
      state: "observed",
      presence: "absent",
      scope: "upstream/main...alice/main",
      evidence: "0 commits ahead in compared default branch",
    },
  });

  const { artifact: enriched } = enrichAssessmentArtifactQuality(policy, artifact, [{ repositoryKey: "alice/forkedlib", value: bundle }]);
  const projection = buildRepositoryQualityOverlayProjection(policy, enriched).repositories[0];

  assert.equal(enriched.repositories[0].quality.state, "partial");
  assert.equal(enriched.repositories[0].quality.value.snapshotQuality.value.dimensions.understandability.findingState, "supports");
  assert.equal(projection.qualityAttributionScope, "local-delta");
  assert.equal(projection.overlayState, "unavailable");
  assert.equal(projection.unavailableReason, "no-local-delta-observed-in-comparison-scope");
});

test("fork portfolio Quality ring uses only local or upstream-accepted local-delta evidence", () => {
  const { artifact } = buildL0RepositoryAssessmentFromGraph(graphFixture(), { generatorRevision: revision });
  const relation = artifact.repositories[0].context.relation;
  const bundle = buildForkQualityBundle(policy, {
    relation,
    artifacts: ["library"],
    upstream: { repositoryKey: "upstream/forkedlib" },
    snapshotEvidence: {
      understandability: evidence("local", "local README"),
      stewardship: evidence("upstream-inherited", "inherited LICENSE"),
    },
    localDeltaObservation: {
      state: "observed",
      presence: "present",
      scope: "upstream/main...alice/main",
      evidence: "2 commits ahead",
    },
    localDeltaEvidence: {
      understandability: evidence("local", "local README"),
      verification: evidence("upstream-accepted", "accepted upstream regression test"),
    },
  });

  const { artifact: enriched } = enrichAssessmentArtifactQuality(policy, artifact, [{ repositoryKey: "alice/forkedlib", value: bundle }]);
  const projection = buildRepositoryQualityOverlayProjection(policy, enriched).repositories[0];

  assert.equal(projection.qualityAttributionScope, "local-delta");
  assert.equal(projection.overlayState, "available");
  assert.equal(projection.overlay.segments.find((segment) => segment.id === "understandability").findingState, "supports");
  assert.equal(projection.overlay.segments.find((segment) => segment.id === "verification").findingState, "supports");
  assert.equal(projection.overlay.segments.find((segment) => segment.id === "stewardship").findingState, "unknown");
  assert.equal(projection.overlay.compositeQualityScore, null);
});
