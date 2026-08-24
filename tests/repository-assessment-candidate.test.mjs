import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { buildRepositoryAssessmentCandidate } from "../scripts/repository-assessment-candidate.mjs";
import { buildQualityEvidenceVector } from "../scripts/repository-quality-evidence.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const scriptPath = path.join(root, "scripts/repository-assessment-candidate.mjs");
const policy = JSON.parse(fs.readFileSync(path.join(root, "data/repository-assessment-policy.v1.json"), "utf8"));
const revision = "dddddddddddddddddddddddddddddddddddddddd";
const generatedAt = "2026-08-25T03:00:00.000Z";

function graphFixture() {
  return {
    owner: "Alice",
    generatedAt,
    nodes: [
      {
        id: "repository:Toolkit",
        type: "repository",
        label: "Toolkit",
        stars: 4,
        forks: 1,
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
    ],
    edges: [],
  };
}

function toolkitQuality() {
  return buildQualityEvidenceVector(policy, {
    artifacts: ["tool"],
    evidence: {
      understandability: [{
        authority: "repository-native",
        state: "observed",
        finding: "supports",
        evidenceClass: "C",
        sourceId: "README.md@test",
      }],
    },
  });
}

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ipm-assessment-candidate-"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

test("candidate builder creates validated full L0 assessment without implicit Quality", () => {
  const result = buildRepositoryAssessmentCandidate(graphFixture(), { generatorRevision: revision });
  assert.equal(result.artifact.repositories.length, 2);
  assert.equal(result.artifact.generatedAt, generatedAt);
  assert.equal(result.artifact.generatorRevision, revision);
  assert.equal(result.diagnostics.l0.repositories, 2);
  assert.equal(result.diagnostics.l0.impactPartial, 2);
  assert.equal(result.diagnostics.quality, null);
  assert.ok(result.artifact.repositories.every((entry) => entry.quality.state === "not-collected"));
  assert.ok(result.artifact.repositories.every((entry) => entry.productionScore === null));
});

test("candidate builder applies optional bounded Quality without changing membership", () => {
  const result = buildRepositoryAssessmentCandidate(graphFixture(), {
    generatorRevision: revision,
    qualityEnrichments: [{
      repositoryKey: "alice/toolkit",
      state: "partial",
      value: toolkitQuality(),
    }],
  });

  assert.equal(result.artifact.repositories.length, 2);
  assert.equal(result.diagnostics.quality.repositoriesBefore, 2);
  assert.equal(result.diagnostics.quality.repositoriesAfter, 2);
  assert.equal(result.diagnostics.quality.applied, 1);
  assert.equal(result.artifact.repositories.find((entry) => entry.identity.repositoryKey === "alice/toolkit").quality.state, "partial");
  assert.equal(result.artifact.repositories.find((entry) => entry.identity.repositoryKey === "alice/forkedlib").quality.state, "not-collected");
});

test("explicit CLI writes assessment and diagnostics while leaving graph input unchanged", () => {
  const dir = tempDir();
  const graphPath = path.join(dir, "graph.json");
  const bundlePath = path.join(dir, "quality.json");
  const outPath = path.join(dir, "candidate", "assessment.json");
  const diagnosticsPath = path.join(dir, "candidate", "diagnostics.json");
  writeJson(graphPath, graphFixture());
  writeJson(bundlePath, {
    schemaVersion: 1,
    assessmentPolicyId: policy.policyId,
    enrichments: [{ repositoryKey: "alice/toolkit", state: "partial", value: toolkitQuality() }],
  });
  const graphBefore = fs.readFileSync(graphPath, "utf8");

  const run = spawnSync(process.execPath, [
    scriptPath,
    "--graph", graphPath,
    "--out", outPath,
    "--generator-revision", revision,
    "--quality-enrichments", bundlePath,
    "--diagnostics-out", diagnosticsPath,
  ], { encoding: "utf8" });

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /assessment candidate: 2 repositories, Quality enriched 1/);
  assert.equal(fs.readFileSync(graphPath, "utf8"), graphBefore);

  const artifact = JSON.parse(fs.readFileSync(outPath, "utf8"));
  const diagnostics = JSON.parse(fs.readFileSync(diagnosticsPath, "utf8"));
  assert.equal(artifact.repositories.length, 2);
  assert.equal(artifact.repositories.find((entry) => entry.identity.repositoryKey === "alice/toolkit").quality.state, "partial");
  assert.equal(diagnostics.quality.applied, 1);
  assert.equal(diagnostics.quality.repositoriesBefore, diagnostics.quality.repositoriesAfter);
});

test("CLI refuses to overwrite graph input or reuse the same diagnostics path", () => {
  const dir = tempDir();
  const graphPath = path.join(dir, "graph.json");
  writeJson(graphPath, graphFixture());

  const overwrite = spawnSync(process.execPath, [
    scriptPath,
    "--graph", graphPath,
    "--out", graphPath,
    "--generator-revision", revision,
  ], { encoding: "utf8" });
  assert.notEqual(overwrite.status, 0);
  assert.match(overwrite.stderr, /must not overwrite graph input/);

  const sameOutput = path.join(dir, "assessment.json");
  const duplicateOutput = spawnSync(process.execPath, [
    scriptPath,
    "--graph", graphPath,
    "--out", sameOutput,
    "--diagnostics-out", sameOutput,
    "--generator-revision", revision,
  ], { encoding: "utf8" });
  assert.notEqual(duplicateOutput.status, 0);
  assert.match(duplicateOutput.stderr, /diagnostics output path must differ/);
});

test("CLI rejects a Quality bundle from another assessment policy", () => {
  const dir = tempDir();
  const graphPath = path.join(dir, "graph.json");
  const bundlePath = path.join(dir, "quality.json");
  const outPath = path.join(dir, "assessment.json");
  writeJson(graphPath, graphFixture());
  writeJson(bundlePath, {
    schemaVersion: 1,
    assessmentPolicyId: "different-policy",
    enrichments: [],
  });

  const run = spawnSync(process.execPath, [
    scriptPath,
    "--graph", graphPath,
    "--out", outPath,
    "--generator-revision", revision,
    "--quality-enrichments", bundlePath,
  ], { encoding: "utf8" });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /Quality enrichment bundle policy mismatch/);
  assert.equal(fs.existsSync(outPath), false);
});

test("CLI propagates membership fail-closed behavior for an external donor key", () => {
  const dir = tempDir();
  const graphPath = path.join(dir, "graph.json");
  const bundlePath = path.join(dir, "quality.json");
  const outPath = path.join(dir, "assessment.json");
  writeJson(graphPath, graphFixture());
  writeJson(bundlePath, {
    schemaVersion: 1,
    assessmentPolicyId: policy.policyId,
    enrichments: [{ repositoryKey: "external/data", state: "partial", value: toolkitQuality() }],
  });

  const run = spawnSync(process.execPath, [
    scriptPath,
    "--graph", graphPath,
    "--out", outPath,
    "--generator-revision", revision,
    "--quality-enrichments", bundlePath,
  ], { encoding: "utf8" });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /cannot add repository not already present/);
  assert.equal(fs.existsSync(outPath), false);
});
