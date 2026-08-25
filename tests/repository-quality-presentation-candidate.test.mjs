import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildRepositoryAssessmentCandidate } from "../scripts/repository-assessment-candidate.mjs";
import { loadBoundedQualityEnrichments } from "../scripts/repository-quality-live-sidecar-candidate.mjs";
import {
  buildRepositoryQualityPresentationCandidate,
  runRepositoryQualityPresentationCandidateCli,
} from "../scripts/repository-quality-presentation-candidate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const live = readJson("fixtures/repository-assessment-live-profile-minimal-2026-08-25.json");
const manifestPath = path.join(root, "data/repository-quality-live-profile-enrichment-sources.v1.json");
const manifest = readJson("data/repository-quality-live-profile-enrichment-sources.v1.json");
const generatorRevision = "0b4caf1dcdd2f67fe35f772afce45b8782112209";

function enrichments() {
  return loadBoundedQualityEnrichments(manifest, { manifestPath }).enrichments;
}

function assessment() {
  return buildRepositoryAssessmentCandidate(live.graph, {
    generatorRevision,
    qualityEnrichments: enrichments(),
  }).artifact;
}

test("presentation candidate is strict, renderer-neutral, and reproduces current-profile 15/7/8 attribution-safe diagnostics", () => {
  const model = buildRepositoryQualityPresentationCandidate(live.graph, assessment());
  assert.equal(model.presentationId, "ipm-repository-quality-presentation-v1");
  assert.equal(model.status, "experimental-non-default");
  assert.deepEqual(model.diagnostics, {
    graphRepositories: 15,
    assessmentRepositories: 15,
    joinedRepositories: 15,
    available: 7,
    unavailable: 8,
    missingAssessmentGraphNodeIds: [],
    orphanAssessmentGraphNodeIds: [],
    strictJoin: true,
  });
  assert.equal(model.invariants.rendererDoesNotInferQuality, true);
  assert.equal(model.invariants.forkPortfolioQualityUsesLocalDeltaOnly, true);
  assert.equal(model.invariants.productionRankingAllowed, false);
  assert.equal(model.modePolicy.defaultProductModeRemains, "structure");
  assert.equal(model.modePolicy.forkPortfolioQualityUses, "local-delta-only");

  const antifullbright = model.repositories.find((entry) => entry.repositoryKey === "nekomario28/antifullbright");
  const ftb = model.repositories.find((entry) => entry.repositoryKey === "nekomario28/ftbpublicclaims");
  const gz = model.repositories.find((entry) => entry.repositoryKey === "nekomario28/gz-sim");
  const turing = model.repositories.find((entry) => entry.repositoryKey === "nekomario28/turing-smart-screen-python-owl");
  const buyclaim = model.repositories.find((entry) => entry.repositoryKey === "nekomario28/buyclaimchunks");
  const freetoken = model.repositories.find((entry) => entry.repositoryKey === "nekomario28/freetoken");
  assert.equal(antifullbright.qualityAttributionScope, "repository-snapshot");
  assert.equal(antifullbright.overlayState, "available");
  assert.equal(ftb.qualityAttributionScope, "repository-snapshot");
  assert.equal(ftb.overlayState, "available");
  assert.equal(ftb.views.detail.segments.find((segment) => segment.id === "verification").findingState, "unknown");
  assert.equal(ftb.views.detail.segments.find((segment) => segment.id === "maintainability").findingState, "supports");
  const ftbSecurity = ftb.views.detail.segments.find((segment) => segment.id === "security-safety");
  assert.equal(ftbSecurity.applicability, "optional");
  assert.equal(ftbSecurity.findingState, "supports");
  assert.equal(gz.qualityAttributionScope, "local-delta");
  assert.equal(gz.overlayState, "unavailable");
  assert.equal(turing.qualityAttributionScope, "local-delta");
  assert.equal(turing.overlayState, "available");
  assert.equal(buyclaim.qualityAttributionScope, "local-delta");
  assert.equal(buyclaim.overlayState, "available");
  assert.equal(buyclaim.views.detail.segments.find((segment) => segment.id === "maintainability").findingState, "unknown");
  const security = buyclaim.views.detail.segments.find((segment) => segment.id === "security-safety");
  assert.equal(security.applicability, "optional");
  assert.equal(security.findingState, "supports");
  assert.equal(freetoken.qualityAttributionScope, "local-delta");
  assert.equal(freetoken.overlayState, "available");
  assert.equal(freetoken.overlay.coverage.targetDimensions, 6);
  assert.equal(freetoken.overlay.coverage.inspectedDimensions, 3);
  assert.equal(freetoken.overlay.targetFindingCounts.supports, 3);
  assert.equal(freetoken.overlay.targetFindingCounts.unknown, 3);
  for (const id of ["understandability", "verification", "reproducibility"]) {
    assert.equal(freetoken.views.detail.segments.find((segment) => segment.id === id).findingState, "supports", id);
  }
  for (const id of ["maintainability", "security-safety", "stewardship"]) {
    assert.equal(freetoken.views.detail.segments.find((segment) => segment.id === id).findingState, "unknown", id);
  }
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
    assert.equal(model.diagnostics.available, 7);
    assert.equal(model.diagnostics.unavailable, 8);
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
