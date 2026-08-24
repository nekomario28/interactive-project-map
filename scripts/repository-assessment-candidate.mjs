import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { validateRepositoryAssessmentArtifact } from "./repository-assessment-artifact.mjs";
import { buildL0RepositoryAssessmentFromGraph } from "./repository-assessment-from-graph.mjs";
import { enrichAssessmentArtifactQuality } from "./repository-assessment-quality-enrichment.mjs";

const policy = JSON.parse(fs.readFileSync(new URL("../data/repository-assessment-policy.v1.json", import.meta.url), "utf8"));

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`failed to read ${label} JSON at ${filePath}: ${error.message}`);
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function samePath(left, right) {
  return path.resolve(left) === path.resolve(right);
}

function normalizeQualityBundle(bundleValue) {
  const bundle = object(bundleValue, "Quality enrichment bundle");
  if (bundle.schemaVersion !== 1) throw new Error("Quality enrichment bundle schemaVersion must be 1");
  if (bundle.assessmentPolicyId !== policy.policyId) {
    throw new Error(`Quality enrichment bundle policy mismatch: expected ${policy.policyId}`);
  }
  if (!Array.isArray(bundle.enrichments)) throw new Error("Quality enrichment bundle enrichments must be an array");
  return bundle.enrichments;
}

export function buildRepositoryAssessmentCandidate(graphValue, options = {}) {
  const graph = object(graphValue, "graph");
  if (typeof options.generatorRevision !== "string" || !options.generatorRevision) {
    throw new Error("generatorRevision is required");
  }

  const l0 = buildL0RepositoryAssessmentFromGraph(graph, {
    generatorRevision: options.generatorRevision,
    generatedAt: options.generatedAt,
    prominenceCandidateId: options.prominenceCandidateId ?? null,
  });

  let artifact = l0.artifact;
  let qualityDiagnostics = null;
  if (options.qualityEnrichments != null) {
    if (!Array.isArray(options.qualityEnrichments)) throw new Error("qualityEnrichments must be an array");
    const enriched = enrichAssessmentArtifactQuality(policy, artifact, options.qualityEnrichments);
    artifact = enriched.artifact;
    qualityDiagnostics = enriched.diagnostics;
  }

  validateRepositoryAssessmentArtifact(artifact);
  return {
    artifact,
    diagnostics: {
      l0: l0.diagnostics,
      quality: qualityDiagnostics,
    },
  };
}

function parseCliArgs(argv) {
  const options = {};
  const valueArgs = new Set([
    "--graph",
    "--out",
    "--generator-revision",
    "--quality-enrichments",
    "--generated-at",
    "--diagnostics-out",
    "--prominence-candidate-id",
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!valueArgs.has(key)) throw new Error(`unsupported argument: ${key}`);
    const value = argv[index + 1];
    if (value == null || value.startsWith("--")) throw new Error(`${key} requires a value`);
    options[key] = value;
    index += 1;
  }

  for (const required of ["--graph", "--out", "--generator-revision"]) {
    if (!options[required]) throw new Error(`${required} is required`);
  }
  return options;
}

export function runRepositoryAssessmentCandidateCli(argv) {
  const args = parseCliArgs(argv);
  const graphPath = path.resolve(args["--graph"]);
  const outPath = path.resolve(args["--out"]);
  const diagnosticsPath = args["--diagnostics-out"] ? path.resolve(args["--diagnostics-out"]) : null;

  if (samePath(graphPath, outPath)) throw new Error("assessment output path must not overwrite graph input");
  if (diagnosticsPath && samePath(graphPath, diagnosticsPath)) throw new Error("diagnostics output path must not overwrite graph input");
  if (diagnosticsPath && samePath(outPath, diagnosticsPath)) throw new Error("diagnostics output path must differ from assessment output path");

  const graph = readJson(graphPath, "graph");
  let qualityEnrichments = null;
  if (args["--quality-enrichments"]) {
    const bundlePath = path.resolve(args["--quality-enrichments"]);
    if (samePath(bundlePath, outPath)) throw new Error("assessment output path must not overwrite Quality enrichment bundle");
    if (diagnosticsPath && samePath(bundlePath, diagnosticsPath)) throw new Error("diagnostics output path must not overwrite Quality enrichment bundle");
    qualityEnrichments = normalizeQualityBundle(readJson(bundlePath, "Quality enrichment bundle"));
  }

  const result = buildRepositoryAssessmentCandidate(graph, {
    generatorRevision: args["--generator-revision"],
    generatedAt: args["--generated-at"],
    prominenceCandidateId: args["--prominence-candidate-id"] ?? null,
    qualityEnrichments,
  });

  writeJson(outPath, result.artifact);
  if (diagnosticsPath) writeJson(diagnosticsPath, result.diagnostics);
  return result;
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isMainModule()) {
  try {
    const result = runRepositoryAssessmentCandidateCli(process.argv.slice(2));
    const qualityApplied = result.diagnostics.quality?.applied ?? 0;
    process.stdout.write(`assessment candidate: ${result.artifact.repositories.length} repositories, Quality enriched ${qualityApplied}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
