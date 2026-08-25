import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runRepositoryAssessmentCandidateCli } from "../scripts/repository-assessment-candidate.mjs";
import { buildRepositoryQualityOverlayProjection } from "../scripts/repository-quality-assessment-projection.mjs";
import { validateRepositoryAssessmentArtifact } from "../scripts/repository-assessment-artifact.mjs";
import { loadBoundedQualityEnrichments } from "../scripts/repository-quality-live-sidecar-candidate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

const policy = readJson("data/repository-assessment-policy.v1.json");
const live = readJson("fixtures/repository-assessment-live-profile-minimal-2026-08-25.json");
const manifestPath = path.join(root, "data/repository-quality-live-profile-enrichment-sources.v1.json");
const manifest = readJson("data/repository-quality-live-profile-enrichment-sources.v1.json");
const generatorRevision = "0b4caf1dcdd2f67fe35f772afce45b8782112209";

function qualityBundle() {
  const loaded = loadBoundedQualityEnrichments(manifest, { manifestPath });
  return {
    schemaVersion: 1,
    assessmentPolicyId: policy.policyId,
    enrichments: loaded.enrichments,
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

test("explicit candidate CLI reproduces the frozen current profile with seven bounded Quality enrichments", () => {
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
  assert.equal(run.diagnostics.quality.requested, 7);
  assert.equal(run.diagnostics.quality.applied, 7);
  assert.equal(run.diagnostics.quality.partial, 7);
  assert.equal(run.diagnostics.quality.acquisitionElevated, 7);

  const qualityKeys = run.assessment.repositories
    .filter((entry) => entry.quality.state === "partial")
    .map((entry) => entry.identity.repositoryKey)
    .sort();
  assert.deepEqual(qualityKeys, [
    "nekomario28/antifullbright",
    "nekomario28/buyclaimchunks",
    "nekomario28/ftbpublicclaims",
    "nekomario28/gz-sim",
    "nekomario28/interactive-project-map",
    "nekomario28/projexd_group10",
    "nekomario28/turing-smart-screen-python-owl",
  ]);

  const antifullbright = run.assessment.repositories.find((entry) => entry.identity.repositoryKey === "nekomario28/antifullbright");
  const buyclaim = run.assessment.repositories.find((entry) => entry.identity.repositoryKey === "nekomario28/buyclaimchunks");
  const ftb = run.assessment.repositories.find((entry) => entry.identity.repositoryKey === "nekomario28/ftbpublicclaims");
  const gz = run.assessment.repositories.find((entry) => entry.identity.repositoryKey === "nekomario28/gz-sim");
  const turing = run.assessment.repositories.find((entry) => entry.identity.repositoryKey === "nekomario28/turing-smart-screen-python-owl");
  assert.equal(antifullbright.quality.value.dimensions.maintainability.findingState, "unknown");
  assert.equal(antifullbright.quality.value.dimensions["security-safety"].applicability, "optional");
  assert.equal(ftb.quality.value.dimensions.verification.findingState, "unknown");
  assert.equal(ftb.quality.value.dimensions.maintainability.findingState, "supports");
  assert.equal(ftb.quality.value.dimensions["security-safety"].applicability, "optional");
  assert.equal(ftb.quality.value.dimensions["security-safety"].findingState, "supports");
  assert.equal(buyclaim.quality.value.contractId, "ipm-repository-fork-quality-v1");
  assert.equal(buyclaim.quality.value.localDelta.quality.state, "partial");
  assert.equal(buyclaim.quality.value.personalAttribution.qualitySource, "local-delta-only");
  assert.equal(buyclaim.quality.value.personalAttribution.upstreamInheritedEvidenceEligible, false);
  assert.equal(gz.quality.value.contractId, "ipm-repository-fork-quality-v1");
  assert.equal(gz.quality.value.localDelta.quality.state, "not-applicable");
  assert.equal(turing.quality.value.contractId, "ipm-repository-fork-quality-v1");
  assert.equal(turing.quality.value.localDelta.quality.state, "partial");

  assert.equal(run.assessment.repositories.some((entry) => entry.identity.repositoryKey === "fivethirtyeight/data"), false);
  assert.equal(fs.readFileSync(run.graphPath, "utf8"), run.graphBefore);
});

test("candidate output projects to six attribution-safe available and nine unavailable Quality overlays", () => {
  const run = runCandidate(tempDir());
  const projection = buildRepositoryQualityOverlayProjection(policy, run.assessment);

  assert.equal(projection.repositories.length, 15);
  assert.equal(projection.repositories.filter((entry) => entry.overlayState === "available").length, 6);
  assert.equal(projection.repositories.filter((entry) => entry.overlayState === "unavailable").length, 9);

  const antifullbright = projection.repositories.find((entry) => entry.repositoryKey === "nekomario28/antifullbright");
  const buyclaim = projection.repositories.find((entry) => entry.repositoryKey === "nekomario28/buyclaimchunks");
  const ftb = projection.repositories.find((entry) => entry.repositoryKey === "nekomario28/ftbpublicclaims");
  const gz = projection.repositories.find((entry) => entry.repositoryKey === "nekomario28/gz-sim");
  const turing = projection.repositories.find((entry) => entry.repositoryKey === "nekomario28/turing-smart-screen-python-owl");
  assert.equal(antifullbright.qualityAttributionScope, "repository-snapshot");
  assert.equal(antifullbright.overlayState, "available");
  assert.equal(ftb.qualityAttributionScope, "repository-snapshot");
  assert.equal(ftb.overlayState, "available");
  assert.equal(ftb.overlay.coverage.targetDimensions, 6);
  assert.equal(ftb.overlay.coverage.inspectedDimensions, 5);
  assert.equal(ftb.overlay.segments.find((segment) => segment.id === "verification").findingState, "unknown");
  assert.equal(ftb.overlay.segments.find((segment) => segment.id === "maintainability").findingState, "supports");
  const ftbSecurity = ftb.overlay.segments.find((segment) => segment.id === "security-safety");
  assert.equal(ftbSecurity.applicability, "optional");
  assert.equal(ftbSecurity.findingState, "supports");
  assert.equal(buyclaim.qualityAttributionScope, "local-delta");
  assert.equal(buyclaim.overlayState, "available");
  assert.equal(buyclaim.overlay.coverage.targetDimensions, 6);
  assert.equal(buyclaim.overlay.coverage.inspectedDimensions, 5);
  assert.equal(buyclaim.overlay.segments.find((segment) => segment.id === "maintainability").findingState, "unknown");
  const buyclaimSecurity = buyclaim.overlay.segments.find((segment) => segment.id === "security-safety");
  assert.equal(buyclaimSecurity.applicability, "optional");
  assert.equal(buyclaimSecurity.findingState, "supports");
  assert.equal(gz.qualityAttributionScope, "local-delta");
  assert.equal(gz.overlayState, "unavailable");
  assert.equal(turing.qualityAttributionScope, "local-delta");
  assert.equal(turing.overlayState, "available");

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
