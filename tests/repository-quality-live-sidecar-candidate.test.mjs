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

test("bounded source manifest resolves exactly four frozen real-evidence calibrations", () => {
  const result = loadBoundedQualityEnrichments(manifest, { manifestPath });
  assert.equal(result.enrichments.length, 4);
  assert.deepEqual(result.enrichments.map((entry) => entry.repositoryKey).sort(), [
    "nekomario28/gz-sim",
    "nekomario28/interactive-project-map",
    "nekomario28/projexd_group10",
    "nekomario28/turing-smart-screen-python-owl",
  ]);
  assert.ok(result.enrichments.every((entry) => entry.state === "partial"));
  assert.ok(result.sourceDiagnostics.every((entry) => entry.fixtureStatus.startsWith("frozen-")));
});

test("live sidecar builder strictly reproduces the frozen 15-node profile as 4 available and 11 unavailable", () => {
  const result = buildLiveQualitySidecarCandidates(live.graph, { generatorRevision: revision });

  assert.equal(result.assessment.repositories.length, 15);
  assert.equal(result.presentation.source.graphGeneratedAt, live.graph.generatedAt);
  assert.equal(result.presentation.diagnostics.graphRepositories, 15);
  assert.equal(result.presentation.diagnostics.assessmentRepositories, 15);
  assert.equal(result.presentation.diagnostics.joinedRepositories, 15);
  assert.equal(result.presentation.diagnostics.available, 4);
  assert.equal(result.presentation.diagnostics.unavailable, 11);
  assert.equal(result.presentation.diagnostics.strictJoin, true);
  assert.equal(result.diagnostics.sourceGraph.ownedRepositoryCount, 14);
  assert.equal(result.diagnostics.sourceGraph.repositoryNodeCount, 15);
  assert.equal(result.diagnostics.assessment.quality.applied, 4);
  assert.equal(result.diagnostics.invariants.sourceGraphGeneratedAtCopiedExactly, true);
  assert.equal(result.diagnostics.invariants.publicationPerformed, false);
  assert.equal(result.diagnostics.invariants.defaultActionChanged, false);
});

test("live sidecar builder binds presentation identity to a newer live graph generatedAt instead of the frozen fixture timestamp", () => {
  const graph = structuredClone(live.graph);
  graph.generatedAt = "2026-08-25T04:30:00.000Z";
  const result = buildLiveQualitySidecarCandidates(graph, { generatorRevision: revision });

  assert.equal(result.assessment.generatedAt, graph.generatedAt);
  assert.equal(result.presentation.source.graphGeneratedAt, graph.generatedAt);
  assert.equal(result.diagnostics.sourceGraph.generatedAt, graph.generatedAt);
  assert.equal(result.presentation.diagnostics.available, 4);
  assert.equal(result.presentation.diagnostics.unavailable, 11);
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
    assert.equal(presentation.diagnostics.available, 4);
    assert.equal(presentation.diagnostics.unavailable, 11);
    assert.equal(diagnostics.sourceGraph.repositoryNodeCount, 15);
    assert.equal(diagnostics.invariants.publicationPerformed, false);
    assert.equal(result.presentation.presentationId, "ipm-repository-quality-presentation-v1");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
