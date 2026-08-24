import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildRepositoryAssessmentCandidate } from "../scripts/repository-assessment-candidate.mjs";
import { buildQualityEvidenceVector } from "../scripts/repository-quality-evidence.mjs";
import {
  buildRepositoryQualityPresentationCandidate,
  runRepositoryQualityPresentationCandidateCli,
} from "../scripts/repository-quality-presentation-candidate.mjs";

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

function enrichments() {
  const ipm = app("interactive-project-map-application");
  const group10 = app("projexd-group10-application");
  const gz = library("gz-sim");
  const turing = library("turing");
  return [
    { repositoryKey: "nekomario28/interactive-project-map", state: "partial", value: quality(ipm.context.artifacts, ipm.evidence) },
    { repositoryKey: "nekomario28/projexd_group10", state: "partial", value: quality(group10.context.artifacts, group10.evidence) },
    { repositoryKey: "nekomario28/gz-sim", state: "partial", value: quality(gz.context.artifacts, gz.qualityEvidence) },
    { repositoryKey: "nekomario28/turing-smart-screen-python-owl", state: "partial", value: quality(turing.context.artifacts, turing.qualityEvidence) },
  ];
}

function assessment() {
  return buildRepositoryAssessmentCandidate(live.graph, {
    generatorRevision,
    qualityEnrichments: enrichments(),
  }).artifact;
}

test("presentation candidate is strict, renderer-neutral, and reproduces current-profile 15/4/11 diagnostics", () => {
  const model = buildRepositoryQualityPresentationCandidate(live.graph, assessment());
  assert.equal(model.presentationId, "ipm-repository-quality-presentation-v1");
  assert.equal(model.status, "experimental-non-default");
  assert.deepEqual(model.diagnostics, {
    graphRepositories: 15,
    assessmentRepositories: 15,
    joinedRepositories: 15,
    available: 4,
    unavailable: 11,
    missingAssessmentGraphNodeIds: [],
    orphanAssessmentGraphNodeIds: [],
    strictJoin: true,
  });
  assert.equal(model.invariants.rendererDoesNotInferQuality, true);
  assert.equal(model.invariants.productionRankingAllowed, false);
  assert.equal(model.modePolicy.defaultProductModeRemains, "structure");
});

test("presentation candidate fails closed on membership mismatch", () => {
  const graph = structuredClone(live.graph);
  graph.nodes = graph.nodes.filter((node) => node.id !== "repository:FTBPublicClaims");
  assert.throws(
    () => buildRepositoryQualityPresentationCandidate(graph, assessment()),
    /Quality presentation join mismatch/,
  );
});

test("CLI writes only derived presentation and optional diagnostics while preserving inputs byte-for-byte", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ipm-quality-presentation-"));
  try {
    const graphPath = path.join(temp, "graph.json");
    const assessmentPath = path.join(temp, "assessment.json");
    const outPath = path.join(temp, "quality-presentation.json");
    const diagnosticsPath = path.join(temp, "quality-presentation-diagnostics.json");
    const graphBytes = `${JSON.stringify(live.graph, null, 2)}\n`;
    const assessmentBytes = `${JSON.stringify(assessment(), null, 2)}\n`;
    fs.writeFileSync(graphPath, graphBytes);
    fs.writeFileSync(assessmentPath, assessmentBytes);

    const model = runRepositoryQualityPresentationCandidateCli([
      "--graph", graphPath,
      "--assessment", assessmentPath,
      "--out", outPath,
      "--diagnostics-out", diagnosticsPath,
    ]);

    assert.equal(model.diagnostics.joinedRepositories, 15);
    assert.equal(model.diagnostics.available, 4);
    assert.equal(JSON.parse(fs.readFileSync(outPath, "utf8")).presentationId, "ipm-repository-quality-presentation-v1");
    assert.deepEqual(JSON.parse(fs.readFileSync(diagnosticsPath, "utf8")), model.diagnostics);
    assert.equal(fs.readFileSync(graphPath, "utf8"), graphBytes);
    assert.equal(fs.readFileSync(assessmentPath, "utf8"), assessmentBytes);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("CLI refuses to overwrite graph, assessment, or diagnostics paths", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ipm-quality-presentation-paths-"));
  try {
    const graphPath = path.join(temp, "graph.json");
    const assessmentPath = path.join(temp, "assessment.json");
    fs.writeFileSync(graphPath, `${JSON.stringify(live.graph)}\n`);
    fs.writeFileSync(assessmentPath, `${JSON.stringify(assessment())}\n`);

    assert.throws(
      () => runRepositoryQualityPresentationCandidateCli(["--graph", graphPath, "--assessment", assessmentPath, "--out", graphPath]),
      /must not overwrite graph input/,
    );
    assert.throws(
      () => runRepositoryQualityPresentationCandidateCli(["--graph", graphPath, "--assessment", assessmentPath, "--out", assessmentPath]),
      /must not overwrite assessment input/,
    );
    const outPath = path.join(temp, "presentation.json");
    assert.throws(
      () => runRepositoryQualityPresentationCandidateCli([
        "--graph", graphPath,
        "--assessment", assessmentPath,
        "--out", outPath,
        "--diagnostics-out", outPath,
      ]),
      /diagnostics output path must differ/,
    );
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
