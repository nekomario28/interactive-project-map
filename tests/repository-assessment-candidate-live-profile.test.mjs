import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runRepositoryAssessmentCandidateCli } from "../scripts/repository-assessment-candidate.mjs";
import { buildRepositoryQualityOverlayProjection } from "../scripts/repository-quality-assessment-projection.mjs";
import { buildQualityEvidenceVector } from "../scripts/repository-quality-evidence.mjs";
import { validateRepositoryAssessmentArtifact } from "../scripts/repository-assessment-artifact.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

const policy = readJson("data/repository-assessment-policy.v1.json");
const live = readJson("fixtures/repository-assessment-live-profile-minimal-2026-08-25.json");
const applications = readJson("fixtures/repository-quality-real-calibration.v1.json");
const libraries = readJson("fixtures/repository-quality-fork-library-calibration.v1.json");
const generatorRevision = "0b4caf1dcdd2f67fe35f772afce45b8782112209";

function app(id) {
  return applications.cases.find((entry) => entry.id === id);
}

function library(idPart) {
  return libraries.cases.find((entry) => entry.id.includes(idPart));
}

function quality(artifacts, evidence) {
  return buildQualityEvidenceVector(policy, { artifacts, evidence });
}

function qualityBundle() {
  const ipm = app("interactive-project-map-application");
  const group10 = app("projexd-group10-application");
  const gz = library("gz-sim");
  const turing = library("turing");
  return {
    schemaVersion: 1,
    assessmentPolicyId: policy.policyId,
    enrichments: [
      {
        repositoryKey: "nekomario28/interactive-project-map",
        state: "partial",
        value: quality(ipm.context.artifacts, ipm.evidence),
      },
      {
        repositoryKey: "nekomario28/projexd_group10",
        state: "partial",
        value: quality(group10.context.artifacts, group10.evidence),
      },
      {
        repositoryKey: "nekomario28/gz-sim",
        state: "partial",
        value: quality(gz.context.artifacts, gz.qualityEvidence),
      },
      {
        repositoryKey: "nekomario28/turing-smart-screen-python-owl",
        state: "partial",
        value: quality(turing.context.artifacts, turing.qualityEvidence),
      },
    ],
  };
}

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ipm-live-assessment-candidate-"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runCandidate(dir, suffix = "") {
  const graphPath = path.join(dir, `graph${suffix}.json`);
  const bundlePath = path.join(dir, `quality${suffix}.json`);
  const assessmentPath = path.join(dir, `assessment${suffix}.json`);
  const diagnosticsPath = path.join(dir, `diagnostics${suffix}.json`);
  writeJson(graphPath, live.graph);
  writeJson(bundlePath, qualityBundle());
  const graphBefore = fs.readFileSync(graphPath, "utf8");

  const result = runRepositoryAssessmentCandidateCli([
    "--graph", graphPath,
    "--out", assessmentPath,
    "--generator-revision", generatorRevision,
    "--quality-enrichments", bundlePath,
    "--diagnostics-out", diagnosticsPath,
  ]);

  return {
    graphPath,
    assessmentPath,
    diagnosticsPath,
    graphBefore,
    result,
    assessment: JSON.parse(fs.readFileSync(assessmentPath, "utf8")),
    diagnostics: JSON.parse(fs.readFileSync(diagnosticsPath, "utf8")),
  };
}

test("explicit candidate CLI reproduces the frozen current profile with four bounded Quality enrichments", () => {
  const run = runCandidate(tempDir());

  assert.equal(validateRepositoryAssessmentArtifact(run.assessment), true);
  assert.equal(run.assessment.owner, "nekomario28");
  assert.equal(run.assessment.generatedAt, live.source.graphGeneratedAt);
  assert.equal(run.assessment.generatorRevision, generatorRevision);
  assert.equal(run.assessment.repositories.length, 15);
  assert.equal(run.assessment.productionScoring, false);
  assert.equal(run.assessment.repositories.every((entry) => entry.productionScore === null), true);

  assert.equal(run.diagnostics.l0.repositories, 15);
  assert.equal(run.diagnostics.l0.owned, 14);
  assert.equal(run.diagnostics.l0.contributed, 1);
  assert.equal(run.diagnostics.l0.forks, 10);
  assert.equal(run.diagnostics.l0.categoryObserved, 14);
  assert.equal(run.diagnostics.l0.categoryUnknown, 1);
  assert.equal(run.diagnostics.l0.artifactsObserved, 14);
  assert.equal(run.diagnostics.l0.artifactsUnknown, 1);
  assert.equal(run.diagnostics.l0.impactPartial, 15);
  assert.equal(run.diagnostics.l0.personalContributionPartial, 1);

  assert.equal(run.diagnostics.quality.repositoriesBefore, 15);
  assert.equal(run.diagnostics.quality.repositoriesAfter, 15);
  assert.equal(run.diagnostics.quality.requested, 4);
  assert.equal(run.diagnostics.quality.applied, 4);
  assert.equal(run.diagnostics.quality.partial, 4);
  assert.equal(run.diagnostics.quality.acquisitionElevated, 4);

  const qualityKeys = run.assessment.repositories
    .filter((entry) => entry.quality.state === "partial")
    .map((entry) => entry.identity.repositoryKey)
    .sort();
  assert.deepEqual(qualityKeys, [
    "nekomario28/gz-sim",
    "nekomario28/interactive-project-map",
    "nekomario28/projexd_group10",
    "nekomario28/turing-smart-screen-python-owl",
  ]);

  assert.equal(run.assessment.repositories.some((entry) => entry.identity.repositoryKey === "fivethirtyeight/data"), false);
  assert.equal(fs.readFileSync(run.graphPath, "utf8"), run.graphBefore);
});

test("candidate output projects to exactly four available and eleven unavailable Quality overlays", () => {
  const run = runCandidate(tempDir());
  const projection = buildRepositoryQualityOverlayProjection(policy, run.assessment);

  assert.equal(projection.repositories.length, 15);
  assert.equal(projection.repositories.filter((entry) => entry.overlayState === "available").length, 4);
  assert.equal(projection.repositories.filter((entry) => entry.overlayState === "unavailable").length, 11);

  const contributed = run.assessment.repositories.find((entry) => entry.identity.repositoryKey === "c0c25034/projexd_4");
  assert.deepEqual(contributed.context.category, { state: "unknown", id: null });
  assert.deepEqual(contributed.context.artifacts, { state: "unknown", values: [] });
  assert.equal(contributed.quality.state, "not-collected");
  assert.equal(contributed.personalContribution.state, "partial");
});

test("candidate CLI output is deterministic for the same frozen graph, Quality bundle, and generator revision", () => {
  const dir = tempDir();
  const first = runCandidate(dir, "-a");
  const second = runCandidate(dir, "-b");

  assert.equal(fs.readFileSync(first.assessmentPath, "utf8"), fs.readFileSync(second.assessmentPath, "utf8"));
  assert.equal(fs.readFileSync(first.diagnosticsPath, "utf8"), fs.readFileSync(second.diagnosticsPath, "utf8"));
});
