import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { buildRepositoryQualityPresentationModel } from "./repository-quality-presentation.mjs";

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

export function buildRepositoryQualityPresentationCandidate(graphValue, assessmentValue) {
  const graph = object(graphValue, "graph");
  const assessment = object(assessmentValue, "assessment");
  return buildRepositoryQualityPresentationModel(policy, graph, assessment, { strictJoin: true });
}

function parseCliArgs(argv) {
  const options = {};
  const valueArgs = new Set(["--graph", "--assessment", "--out", "--diagnostics-out"]);
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!valueArgs.has(key)) throw new Error(`unsupported argument: ${key}`);
    const value = argv[index + 1];
    if (value == null || value.startsWith("--")) throw new Error(`${key} requires a value`);
    options[key] = value;
    index += 1;
  }
  for (const required of ["--graph", "--assessment", "--out"]) {
    if (!options[required]) throw new Error(`${required} is required`);
  }
  return options;
}

export function runRepositoryQualityPresentationCandidateCli(argv) {
  const args = parseCliArgs(argv);
  const graphPath = path.resolve(args["--graph"]);
  const assessmentPath = path.resolve(args["--assessment"]);
  const outPath = path.resolve(args["--out"]);
  const diagnosticsPath = args["--diagnostics-out"] ? path.resolve(args["--diagnostics-out"]) : null;

  if (samePath(graphPath, assessmentPath)) throw new Error("graph and assessment inputs must be different files");
  for (const [inputPath, label] of [[graphPath, "graph"], [assessmentPath, "assessment"]]) {
    if (samePath(inputPath, outPath)) throw new Error(`presentation output path must not overwrite ${label} input`);
    if (diagnosticsPath && samePath(inputPath, diagnosticsPath)) throw new Error(`diagnostics output path must not overwrite ${label} input`);
  }
  if (diagnosticsPath && samePath(outPath, diagnosticsPath)) {
    throw new Error("diagnostics output path must differ from presentation output path");
  }

  const graph = readJson(graphPath, "graph");
  const assessment = readJson(assessmentPath, "assessment");
  const model = buildRepositoryQualityPresentationCandidate(graph, assessment);
  writeJson(outPath, model);
  if (diagnosticsPath) writeJson(diagnosticsPath, model.diagnostics);
  return model;
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isMainModule()) {
  try {
    const model = runRepositoryQualityPresentationCandidateCli(process.argv.slice(2));
    process.stdout.write(`Quality presentation candidate: ${model.diagnostics.joinedRepositories} joined, ${model.diagnostics.available} available, ${model.diagnostics.unavailable} unavailable\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
