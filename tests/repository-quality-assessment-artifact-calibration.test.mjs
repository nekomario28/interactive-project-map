import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildRepositoryAssessmentArtifact,
  makeAssessmentRepositorySkeleton,
} from "../scripts/repository-assessment-artifact.mjs";
import { buildForkQualityBundle } from "../scripts/repository-fork-quality.mjs";
import { buildQualityEvidenceVector } from "../scripts/repository-quality-evidence.mjs";
import { buildRepositoryQualityOverlayProjection } from "../scripts/repository-quality-assessment-projection.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const policy = readJson("data/repository-assessment-policy.v1.json");
const applications = readJson("fixtures/repository-quality-real-calibration.v1.json");
const forks = readJson("fixtures/repository-fork-quality-provenance-calibration.v1.json");
const dataset = readJson("fixtures/repository-quality-external-dataset-calibration.v1.json");

const GENERATED_AT = "2026-08-25T00:00:00.000Z";
const GENERATOR_REVISION = "263ee2057415aeb7f970a7ef9ac2fadad8de645f";

function qualityVector(artifacts, evidence) {
  return buildQualityEvidenceVector(policy, { artifacts, evidence });
}

function forkVector(entry) {
  return buildForkQualityBundle(policy, {
    relation: entry.context.relation,
    artifacts: entry.context.artifacts,
    upstream: entry.upstream,
    snapshotEvidence: entry.snapshotEvidence,
    localDeltaObservation: entry.localDeltaObservation,
    localDeltaEvidence: entry.localDeltaEvidence,
  });
}

function repository(rootOwner, input) {
  const value = makeAssessmentRepositorySkeleton(rootOwner, {
    owner: input.owner ?? rootOwner,
    name: input.name,
    relation: input.relation,
    categoryId: input.categoryId,
    artifacts: input.artifacts,
    lifecycle: input.lifecycle ?? "unknown",
    observedAt: GENERATED_AT,
  });
  if (input.qualityValue) {
    value.quality = { state: "partial", value: input.qualityValue };
    value.acquisition.level = "L1";
  }
  return value;
}

function appCase(id) {
  return applications.cases.find((entry) => entry.id === id);
}

function forkCase(idPart) {
  return forks.cases.find((entry) => entry.id.includes(idPart));
}

function buildPersonalArtifact() {
  const ipm = appCase("interactive-project-map-application");
  const group10 = appCase("projexd-group10-application");
  const gz = forkCase("gz-sim");
  const turing = forkCase("turing");

  const repositories = [
    repository("nekomario28", {
      name: "interactive-project-map",
      relation: { ownership: "owned", collaboration: "unknown", lineage: "original" },
      categoryId: ipm.context.category,
      artifacts: ipm.context.artifacts,
      qualityValue: qualityVector(ipm.context.artifacts, ipm.evidence),
    }),
    repository("nekomario28", {
      name: "ProjExD_Group10",
      relation: { ownership: "owned", collaboration: "team", lineage: "original" },
      categoryId: group10.context.category,
      artifacts: group10.context.artifacts,
      qualityValue: qualityVector(group10.context.artifacts, group10.evidence),
    }),
    repository("nekomario28", {
      name: "gz-sim",
      relation: gz.context.relation,
      categoryId: "robotics-automation",
      artifacts: gz.context.artifacts,
      qualityValue: forkVector(gz),
    }),
    repository("nekomario28", {
      name: "turing-smart-screen-python-owl",
      relation: turing.context.relation,
      categoryId: "hardware-embedded",
      artifacts: turing.context.artifacts,
      qualityValue: forkVector(turing),
    }),
    repository("nekomario28", {
      name: "FTBPublicClaims",
      relation: { ownership: "owned", collaboration: "unknown", lineage: "original" },
      categoryId: "game-modding",
      artifacts: ["game-mod"],
    }),
  ];

  return buildRepositoryAssessmentArtifact({
    owner: "nekomario28",
    generatedAt: GENERATED_AT,
    generatorRevision: GENERATOR_REVISION,
    repositories,
  });
}

function buildDatasetDonorArtifact() {
  const donor = repository("fivethirtyeight", {
    name: "data",
    relation: { ownership: "owned", collaboration: "unknown", lineage: "original" },
    categoryId: dataset.subject.category,
    artifacts: dataset.subject.artifacts,
    lifecycle: dataset.subject.lifecycle,
    qualityValue: qualityVector(dataset.subject.artifacts, dataset.qualityEvidence),
  });
  return buildRepositoryAssessmentArtifact({
    owner: "fivethirtyeight",
    generatedAt: GENERATED_AT,
    generatorRevision: GENERATOR_REVISION,
    repositories: [donor],
  });
}

test("real personal calibration cases project through assessment artifact envelopes without attributing inherited fork snapshot Quality", () => {
  const artifact = buildPersonalArtifact();
  const projection = buildRepositoryQualityOverlayProjection(policy, artifact);

  assert.equal(artifact.owner, "nekomario28");
  assert.equal(artifact.repositories.length, 5);
  assert.equal(projection.repositories.length, 5);
  assert.equal(projection.repositories.filter((entry) => entry.overlayState === "available").length, 3);
  assert.equal(projection.repositories.filter((entry) => entry.overlayState === "unavailable").length, 2);

  const unassessed = projection.repositories.find((entry) => entry.repositoryKey === "nekomario28/ftbpublicclaims");
  assert.equal(unassessed.qualitySectionState, "not-collected");
  assert.equal(unassessed.overlay, null);

  const ipm = projection.repositories.find((entry) => entry.repositoryKey === "nekomario28/interactive-project-map");
  assert.equal(ipm.qualityAttributionScope, "repository-snapshot");
  assert.equal(ipm.overlay.coverage.label, "4/6 interpreted");

  const group10 = projection.repositories.find((entry) => entry.repositoryKey === "nekomario28/projexd_group10");
  assert.equal(group10.overlay.targetFindingCounts.weakens, 1);

  const gz = projection.repositories.find((entry) => entry.repositoryKey === "nekomario28/gz-sim");
  assert.equal(gz.qualityAttributionScope, "local-delta");
  assert.equal(gz.overlayState, "unavailable");
  assert.equal(gz.unavailableReason, "no-local-delta-observed-in-comparison-scope");

  const turing = projection.repositories.find((entry) => entry.repositoryKey === "nekomario28/turing-smart-screen-python-owl");
  assert.equal(turing.qualityAttributionScope, "local-delta");
  assert.equal(turing.overlayState, "available");
  assert.equal(turing.overlay.targetFindingCounts.supports, 2);
  assert.equal(turing.overlay.targetFindingCounts.unknown, 4);
});

test("external dataset donor stays in a donor-owned calibration artifact instead of personal portfolio identity", () => {
  const personal = buildPersonalArtifact();
  const donorArtifact = buildDatasetDonorArtifact();
  const donorProjection = buildRepositoryQualityOverlayProjection(policy, donorArtifact);

  assert.equal(personal.repositories.some((entry) => entry.identity.repositoryKey === "fivethirtyeight/data"), false);
  assert.equal(donorArtifact.owner, "fivethirtyeight");
  assert.equal(donorArtifact.repositories.length, 1);
  assert.equal(donorArtifact.repositories[0].identity.repositoryKey, "fivethirtyeight/data");

  const donor = donorProjection.repositories[0];
  assert.equal(donor.overlayState, "available");
  assert.equal(donor.qualityAttributionScope, "repository-snapshot");
  assert.equal(donor.overlay.coverage.targetDimensions, 5);
  assert.equal(donor.overlay.coverage.directionalDimensions, 4);
  assert.equal(donor.overlay.targetFindingCounts.supports, 4);
  assert.equal(donor.overlay.targetFindingCounts.unknown, 1);
});

test("personal and donor calibration artifacts retain separate source owners and graph-node namespaces", () => {
  const personalProjection = buildRepositoryQualityOverlayProjection(policy, buildPersonalArtifact());
  const donorProjection = buildRepositoryQualityOverlayProjection(policy, buildDatasetDonorArtifact());

  assert.equal(personalProjection.source.owner, "nekomario28");
  assert.equal(donorProjection.source.owner, "fivethirtyeight");
  assert.equal(personalProjection.repositories.some((entry) => entry.graphNodeId === "repository:data"), false);
  assert.equal(donorProjection.repositories[0].graphNodeId, "repository:data");
});
