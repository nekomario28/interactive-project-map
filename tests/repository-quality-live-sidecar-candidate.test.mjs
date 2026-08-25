import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildLiveQualitySidecarCandidates,
  loadBoundedQualityEnrichments,
  runLiveQualitySidecarCandidateCli,
} from "../scripts/repository-quality-live-sidecar-candidate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const live = JSON.parse(fs.readFileSync(path.join(root, "fixtures/repository-assessment-live-profile-minimal-2026-08-25.json"), "utf8"));
const manifestPath = path.join(root, "data/repository-quality-live-profile-enrichment-sources.v1.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const revision = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ipm-live-quality-sidecars-"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

test("bounded source manifest resolves nine evidence sources and eight portfolio Quality presentations", () => {
  const result = loadBoundedQualityEnrichments(manifest, { manifestPath });
  assert.equal(result.enrichments.length, 9);
  assert.equal(result.expectedPresentationAvailable, 8);
  assert.deepEqual(result.enrichments.map((entry) => entry.repositoryKey).sort(), [
    "nekomario28/antifullbright",
    "nekomario28/buyclaimchunks",
    "nekomario28/freetoken",
    "nekomario28/ftbpublicclaims",
    "nekomario28/gz-sim",
    "nekomario28/interactive-project-map",
    "nekomario28/offhandcombat",
    "nekomario28/projexd_group10",
    "nekomario28/turing-smart-screen-python-owl",
  ]);
  assert.ok(result.enrichments.every((entry) => entry.state === "partial"));
  assert.ok(result.sourceDiagnostics.every((entry) => entry.fixtureStatus.startsWith("frozen-")));
  assert.equal(result.sourceDiagnostics.find((entry) => entry.repositoryKey === "nekomario28/antifullbright").qualityAttributionScope, "repository-snapshot");
  const ftb = result.sourceDiagnostics.find((entry) => entry.repositoryKey === "nekomario28/ftbpublicclaims");
  assert.equal(ftb.qualityAttributionScope, "repository-snapshot");
  assert.equal(ftb.presentationExpected, "available");
  assert.equal(ftb.fixtureSnapshotDate, "2026-08-25");
  assert.equal(ftb.calibratedRevision, "8caaab65266a94e7bdedc6ad2f66030c7e394edf");
  assert.equal(result.sourceDiagnostics.find((entry) => entry.repositoryKey === "nekomario28/gz-sim").presentationExpected, "unavailable");
  assert.equal(result.sourceDiagnostics.find((entry) => entry.repositoryKey === "nekomario28/turing-smart-screen-python-owl").qualityAttributionScope, "local-delta");
  const buyclaim = result.sourceDiagnostics.find((entry) => entry.repositoryKey === "nekomario28/buyclaimchunks");
  assert.equal(buyclaim.qualityAttributionScope, "local-delta");
  assert.equal(buyclaim.presentationExpected, "available");
  assert.equal(buyclaim.fixtureSnapshotDate, "2026-07-25");
  assert.equal(buyclaim.calibratedRevision, "22d7adcbe5f711a3bc7e2cb8593c60e19838dce1");
  const freetoken = result.sourceDiagnostics.find((entry) => entry.repositoryKey === "nekomario28/freetoken");
  assert.equal(freetoken.qualityAttributionScope, "local-delta");
  assert.equal(freetoken.presentationExpected, "available");
  assert.equal(freetoken.fixtureSnapshotDate, "2026-08-24");
  assert.equal(freetoken.calibratedRevision, "b2c0f162ae74c22898fb61b7369b4d7a3474bbfa");
  const offhand = result.sourceDiagnostics.find((entry) => entry.repositoryKey === "nekomario28/offhandcombat");
  assert.equal(offhand.qualityAttributionScope, "local-delta");
  assert.equal(offhand.presentationExpected, "available");
  assert.equal(offhand.fixtureSnapshotDate, "2026-08-04");
  assert.equal(offhand.calibratedRevision, "317c2ec2e40325d8dd41f6dc5e730e95c97ae7e1");
});

test("live sidecar keeps all 15 repositories while bounded Quality yields 8 available and 7 unavailable", () => {
  const result = buildLiveQualitySidecarCandidates(live.graph, { generatorRevision: revision });

  assert.equal(result.assessment.repositories.length, 15);
  assert.equal(result.presentation.source.graphGeneratedAt, live.graph.generatedAt);
  assert.equal(result.presentation.diagnostics.graphRepositories, 15);
  assert.equal(result.presentation.diagnostics.assessmentRepositories, 15);
  assert.equal(result.presentation.diagnostics.joinedRepositories, 15);
  assert.equal(result.presentation.diagnostics.available, 8);
  assert.equal(result.presentation.diagnostics.unavailable, 7);
  assert.equal(result.presentation.diagnostics.strictJoin, true);
  assert.equal(result.diagnostics.sourceGraph.ownedRepositoryCount, 14);
  assert.equal(result.diagnostics.sourceGraph.repositoryNodeCount, 15);
  assert.equal(result.diagnostics.assessment.quality.applied, 9);
  assert.equal(result.diagnostics.expectedPresentationAvailable, 8);
  assert.equal(result.diagnostics.invariants.forkQualityUsesProvenanceAwareBundle, true);
  assert.equal(result.diagnostics.invariants.forkPortfolioQualityUsesLocalDeltaOnly, true);

  const antifullbright = result.presentation.repositories.find((entry) => entry.repositoryKey === "nekomario28/antifullbright");
  const ftb = result.presentation.repositories.find((entry) => entry.repositoryKey === "nekomario28/ftbpublicclaims");
  const gz = result.presentation.repositories.find((entry) => entry.repositoryKey === "nekomario28/gz-sim");
  const turing = result.presentation.repositories.find((entry) => entry.repositoryKey === "nekomario28/turing-smart-screen-python-owl");
  const ipm = result.presentation.repositories.find((entry) => entry.repositoryKey === "nekomario28/interactive-project-map");
  const buyclaim = result.presentation.repositories.find((entry) => entry.repositoryKey === "nekomario28/buyclaimchunks");
  const freetoken = result.presentation.repositories.find((entry) => entry.repositoryKey === "nekomario28/freetoken");
  const offhand = result.presentation.repositories.find((entry) => entry.repositoryKey === "nekomario28/offhandcombat");

  assert.equal(antifullbright.qualityAttributionScope, "repository-snapshot");
  assert.equal(antifullbright.overlayState, "available");
  assert.equal(antifullbright.overlay.coverage.targetDimensions, 6);
  assert.equal(antifullbright.overlay.coverage.inspectedDimensions, 5);
  assert.equal(antifullbright.views.detail.segments.find((segment) => segment.id === "maintainability").findingState, "unknown");
  assert.equal(antifullbright.views.detail.segments.find((segment) => segment.id === "security-safety").applicability, "optional");

  assert.equal(ftb.qualityAttributionScope, "repository-snapshot");
  assert.equal(ftb.overlayState, "available");
  assert.equal(ftb.overlay.coverage.targetDimensions, 6);
  assert.equal(ftb.overlay.coverage.inspectedDimensions, 5);
  assert.equal(ftb.views.detail.segments.find((segment) => segment.id === "verification").findingState, "unknown");
  assert.equal(ftb.views.detail.segments.find((segment) => segment.id === "maintainability").findingState, "supports");
  const ftbSecurity = ftb.views.detail.segments.find((segment) => segment.id === "security-safety");
  assert.equal(ftbSecurity.applicability, "optional");
  assert.equal(ftbSecurity.findingState, "supports");

  assert.equal(gz.qualityAttributionScope, "local-delta");
  assert.equal(gz.overlayState, "unavailable");
  assert.equal(gz.unavailableReason, "no-local-delta-observed-in-comparison-scope");
  assert.equal(turing.qualityAttributionScope, "local-delta");
  assert.equal(turing.overlayState, "available");
  assert.equal(turing.views.detail.segments.find((segment) => segment.id === "stewardship").findingState, "unknown");
  assert.equal(ipm.qualityAttributionScope, "repository-snapshot");
  assert.equal(ipm.overlayState, "available");

  assert.equal(buyclaim.qualityAttributionScope, "local-delta");
  assert.equal(buyclaim.overlayState, "available");
  assert.equal(buyclaim.overlay.coverage.targetDimensions, 6);
  assert.equal(buyclaim.overlay.coverage.inspectedDimensions, 5);
  assert.equal(buyclaim.views.detail.segments.find((segment) => segment.id === "maintainability").findingState, "unknown");
  const buyclaimSecurity = buyclaim.views.detail.segments.find((segment) => segment.id === "security-safety");
  assert.equal(buyclaimSecurity.applicability, "optional");
  assert.equal(buyclaimSecurity.findingState, "supports");

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

  assert.equal(offhand.qualityAttributionScope, "local-delta");
  assert.equal(offhand.overlayState, "available");
  assert.equal(offhand.overlay.coverage.targetDimensions, 6);
  assert.equal(offhand.overlay.coverage.inspectedDimensions, 5);
  assert.equal(offhand.overlay.targetFindingCounts.supports, 5);
  assert.equal(offhand.overlay.targetFindingCounts.unknown, 1);
  assert.equal(offhand.views.detail.segments.find((segment) => segment.id === "maintainability").findingState, "unknown");
  const offhandSecurity = offhand.views.detail.segments.find((segment) => segment.id === "security-safety");
  assert.equal(offhandSecurity.applicability, "optional");
  assert.equal(offhandSecurity.findingState, "supports");
});

test("live sidecar builder binds presentation identity to a newer live graph generatedAt instead of frozen fixture timestamps", () => {
  const graph = structuredClone(live.graph);
  graph.generatedAt = "2026-08-25T04:30:00.000Z";
  const result = buildLiveQualitySidecarCandidates(graph, { generatorRevision: revision });

  assert.equal(result.assessment.generatedAt, graph.generatedAt);
  assert.equal(result.presentation.source.graphGeneratedAt, graph.generatedAt);
  assert.equal(result.diagnostics.sourceGraph.generatedAt, graph.generatedAt);
  assert.equal(result.presentation.diagnostics.available, 8);
  assert.equal(result.presentation.diagnostics.unavailable, 7);
});

test("live sidecar builder fails closed when a bounded enrichment repository disappears from the live graph", () => {
  const graph = structuredClone(live.graph);
  graph.nodes = graph.nodes.filter((node) => node.id !== "repository:interactive-project-map");
  assert.throws(
    () => buildLiveQualitySidecarCandidates(graph, { generatorRevision: revision }),
    /cannot add repository not already present/,
  );
});

test("source manifest refuses repository/case mismatch instead of silently retargeting evidence", () => {
  const bad = structuredClone(manifest);
  bad.sources[0].repositoryKey = "nekomario28/projexd_group10";
  assert.throws(
    () => loadBoundedQualityEnrichments(bad, { manifestPath }),
    /repository mismatch/,
  );
});

test("generic repository-snapshot mode cannot silently replace fork-local-delta provenance", () => {
  const bad = structuredClone(manifest);
  const gz = bad.sources.find((entry) => entry.repositoryKey === "nekomario28/gz-sim");
  gz.mode = "repository-snapshot";
  gz.fixture = "fixtures/repository-quality-fork-library-calibration.v1.json";
  gz.caseId = "gz-sim-library-fork-no-default-branch-delta";
  gz.evidenceField = "qualityEvidence";
  assert.throws(
    () => buildLiveQualitySidecarCandidates(live.graph, { generatorRevision: revision, manifest: bad, manifestPath }),
    /fork Quality requires provenance-aware fork bundle/,
  );
});

test("CLI writes assessment, presentation and diagnostics beside a live graph without mutating the graph", () => {
  const dir = tempDir();
  try {
    const graphPath = path.join(dir, "project-map", "graph.json");
    const outDir = path.join(dir, "candidate-project-map");
    writeJson(graphPath, live.graph);
    const before = fs.readFileSync(graphPath, "utf8");

    const result = runLiveQualitySidecarCandidateCli([
      "--graph", graphPath,
      "--out-dir", outDir,
      "--generator-revision", revision,
      "--assessment-generated-at", "2026-08-25T04:31:00.000Z",
    ]);

    assert.equal(fs.readFileSync(graphPath, "utf8"), before);
    const assessment = JSON.parse(fs.readFileSync(path.join(outDir, "assessment.json"), "utf8"));
    const presentation = JSON.parse(fs.readFileSync(path.join(outDir, "quality-presentation.json"), "utf8"));
    const diagnostics = JSON.parse(fs.readFileSync(path.join(outDir, "quality-sidecar-diagnostics.json"), "utf8"));
    assert.equal(assessment.generatedAt, "2026-08-25T04:31:00.000Z");
    assert.equal(presentation.source.graphGeneratedAt, live.graph.generatedAt);
    assert.equal(presentation.diagnostics.available, 8);
    assert.equal(presentation.diagnostics.unavailable, 7);
    assert.equal(diagnostics.sourceGraph.repositoryNodeCount, 15);
    assert.equal(diagnostics.expectedPresentationAvailable, 8);
    assert.equal(diagnostics.invariants.publicationPerformed, false);
    assert.equal(result.presentation.presentationId, "ipm-repository-quality-presentation-v1");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
