import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildRepositoryAssessmentCandidate } from "./repository-assessment-candidate.mjs";
import { buildForkQualityBundle } from "./repository-fork-quality.mjs";
import { buildRepositoryQualityPresentationCandidate } from "./repository-quality-presentation-candidate.mjs";
import { buildQualityEvidenceVector } from "./repository-quality-evidence.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const policy = JSON.parse(fs.readFileSync(path.join(root, "data/repository-assessment-policy.v1.json"), "utf8"));
const defaultManifestPath = path.join(root, "data/repository-quality-live-profile-enrichment-sources.v1.json");
const SOURCE_MODES = new Set(["repository-snapshot", "fork-local-delta"]);
const PRESENTATION_EXPECTATIONS = new Set(["available", "unavailable"]);

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

function normalizedRepositoryKey(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!/^[^/]+\/[^/]+$/.test(key)) throw new Error(`invalid repository key: ${String(value)}`);
  return key;
}

function resolveManifestFixture(manifestPath, fixturePath) {
  if (typeof fixturePath !== "string" || !fixturePath) throw new Error("enrichment source fixture is required");
  if (path.isAbsolute(fixturePath)) return fixturePath;
  const fromRoot = path.resolve(root, fixturePath);
  if (fs.existsSync(fromRoot)) return fromRoot;
  return path.resolve(path.dirname(manifestPath), fixturePath);
}

function loadFixture(fixtureCache, manifestPath, source) {
  const fixturePath = resolveManifestFixture(manifestPath, source.fixture);
  let fixture = fixtureCache.get(fixturePath);
  if (!fixture) {
    fixture = object(readJson(fixturePath, `Quality calibration fixture ${source.fixture}`), `Quality calibration fixture ${source.fixture}`);
    if (fixture.schemaVersion !== 1) throw new Error(`${source.fixture} schemaVersion must be 1`);
    if (fixture.policyId !== policy.policyId) throw new Error(`${source.fixture} policy mismatch`);
    if (typeof fixture.status !== "string" || !fixture.status.startsWith("frozen-")) throw new Error(`${source.fixture} must remain a frozen evidence source`);
    if (!Array.isArray(fixture.cases)) throw new Error(`${source.fixture} cases must be an array`);
    fixtureCache.set(fixturePath, fixture);
  }
  return fixture;
}

function buildSnapshotSourceValue(source, selected) {
  const context = object(selected.context, `${source.caseId}.context`);
  if (!Array.isArray(context.artifacts) || context.artifacts.length === 0) throw new Error(`${source.caseId}.context.artifacts must be non-empty`);
  const evidenceField = String(source.evidenceField || "");
  if (!new Set(["evidence", "qualityEvidence"]).has(evidenceField)) throw new Error(`${source.caseId} has unsupported evidenceField`);
  const evidence = object(selected[evidenceField], `${source.caseId}.${evidenceField}`);
  return {
    value: buildQualityEvidenceVector(policy, { artifacts: context.artifacts, evidence }),
    artifacts: [...context.artifacts],
    evidenceField,
    qualityAttributionScope: "repository-snapshot",
  };
}

function buildForkSourceValue(source, selected) {
  const context = object(selected.context, `${source.caseId}.context`);
  if (!Array.isArray(context.artifacts) || context.artifacts.length === 0) throw new Error(`${source.caseId}.context.artifacts must be non-empty`);
  const relation = object(context.relation, `${source.caseId}.context.relation`);
  if (relation.lineage !== "fork") throw new Error(`${source.caseId} fork-local-delta source must declare fork lineage`);
  return {
    value: buildForkQualityBundle(policy, {
      relation,
      artifacts: context.artifacts,
      upstream: selected.upstream,
      snapshotEvidence: selected.snapshotEvidence,
      snapshotApplicability: selected.snapshotApplicability,
      localDeltaObservation: selected.localDeltaObservation,
      localDeltaEvidence: selected.localDeltaEvidence,
      localDeltaApplicability: selected.localDeltaApplicability,
    }),
    artifacts: [...context.artifacts],
    evidenceField: "fork-quality-bundle",
    qualityAttributionScope: "local-delta",
  };
}

export function loadBoundedQualityEnrichments(manifestValue, options = {}) {
  const manifest = object(manifestValue, "Quality enrichment source manifest");
  if (manifest.schemaVersion !== 1) throw new Error("Quality enrichment source manifest schemaVersion must be 1");
  if (manifest.manifestId !== "ipm-live-profile-quality-enrichment-sources-v1") throw new Error("unsupported Quality enrichment source manifest");
  if (manifest.assessmentPolicyId !== policy.policyId) throw new Error("Quality enrichment source manifest policy mismatch");
  if (!Array.isArray(manifest.sources) || manifest.sources.length === 0) throw new Error("Quality enrichment source manifest sources must be non-empty");

  const manifestPath = path.resolve(options.manifestPath ?? defaultManifestPath);
  const fixtureCache = new Map();
  const seenKeys = new Set();
  const sourceDiagnostics = [];
  let expectedPresentationAvailable = 0;

  const enrichments = manifest.sources.map((sourceValue, index) => {
    const source = object(sourceValue, `manifest.sources[${index}]`);
    const repositoryKey = normalizedRepositoryKey(source.repositoryKey);
    if (seenKeys.has(repositoryKey)) throw new Error(`duplicate Quality enrichment repositoryKey: ${repositoryKey}`);
    seenKeys.add(repositoryKey);

    const mode = source.mode ?? "repository-snapshot";
    if (!SOURCE_MODES.has(mode)) throw new Error(`${source.caseId ?? repositoryKey} has unsupported Quality source mode: ${mode}`);
    const presentationExpected = source.presentationExpected ?? "available";
    if (!PRESENTATION_EXPECTATIONS.has(presentationExpected)) throw new Error(`${source.caseId ?? repositoryKey} has unsupported presentationExpected`);
    if (presentationExpected === "available") expectedPresentationAvailable += 1;

    const fixture = loadFixture(fixtureCache, manifestPath, source);
    const selected = fixture.cases.find((entry) => entry?.id === source.caseId);
    if (!selected) throw new Error(`Quality calibration case not found: ${source.caseId}`);
    const selectedRepository = normalizedRepositoryKey(selected.repository);
    if (selectedRepository !== repositoryKey) {
      throw new Error(`Quality calibration repository mismatch for ${source.caseId}: ${selectedRepository} != ${repositoryKey}`);
    }

    const built = mode === "fork-local-delta"
      ? buildForkSourceValue(source, selected)
      : buildSnapshotSourceValue(source, selected);

    sourceDiagnostics.push({
      repositoryKey,
      mode,
      fixture: source.fixture,
      fixtureStatus: fixture.status,
      fixtureSnapshotDate: fixture.snapshotDate ?? null,
      caseId: source.caseId,
      evidenceField: built.evidenceField,
      qualityAttributionScope: built.qualityAttributionScope,
      presentationExpected,
      artifacts: built.artifacts,
    });
    return { repositoryKey, state: "partial", value: built.value };
  });

  return { enrichments, sourceDiagnostics, expectedPresentationAvailable };
}

export function buildLiveQualitySidecarCandidates(graphValue, options = {}) {
  const graph = object(graphValue, "graph");
  if (typeof graph.owner !== "string" || !graph.owner) throw new Error("graph.owner is required");
  if (typeof graph.generatedAt !== "string" || !graph.generatedAt) throw new Error("graph.generatedAt is required for live sidecar identity");
  if (!Array.isArray(graph.nodes)) throw new Error("graph.nodes must be an array");
  if (typeof options.generatorRevision !== "string" || !options.generatorRevision) throw new Error("generatorRevision is required");

  const manifestPath = path.resolve(options.manifestPath ?? defaultManifestPath);
  const manifest = options.manifest ?? readJson(manifestPath, "Quality enrichment source manifest");
  const { enrichments, sourceDiagnostics, expectedPresentationAvailable } = loadBoundedQualityEnrichments(manifest, { manifestPath });
  const assessmentResult = buildRepositoryAssessmentCandidate(graph, {
    generatorRevision: options.generatorRevision,
    generatedAt: options.assessmentGeneratedAt,
    qualityEnrichments: enrichments,
  });
  const assessment = assessmentResult.artifact;
  const presentation = buildRepositoryQualityPresentationCandidate(graph, assessment);

  if (presentation.source.graphGeneratedAt !== graph.generatedAt) {
    throw new Error("generated Quality presentation is not bound to the source graph.generatedAt");
  }
  const repositoryNodes = graph.nodes.filter((node) => node?.type === "repository");
  if (presentation.diagnostics.joinedRepositories !== repositoryNodes.length) {
    throw new Error("generated Quality presentation does not strictly join every repository node");
  }
  if (presentation.diagnostics.available !== expectedPresentationAvailable) {
    throw new Error(`generated Quality presentation available count ${presentation.diagnostics.available} does not match manifest expectation ${expectedPresentationAvailable}`);
  }

  return {
    assessment,
    presentation,
    diagnostics: {
      schemaVersion: 1,
      candidateId: "ipm-live-quality-sidecars-v1",
      status: "experimental-not-published",
      sourceGraph: {
        owner: graph.owner,
        generatedAt: graph.generatedAt,
        ownedRepositoryCount: Number.isSafeInteger(graph.repositoryCount) ? graph.repositoryCount : null,
        repositoryNodeCount: repositoryNodes.length,
      },
      generatorRevision: options.generatorRevision,
      assessment: {
        repositories: assessment.repositories.length,
        l0: assessmentResult.diagnostics.l0,
        quality: assessmentResult.diagnostics.quality,
      },
      presentation: presentation.diagnostics,
      expectedPresentationAvailable,
      enrichmentSources: sourceDiagnostics,
      invariants: {
        sourceGraphGeneratedAtCopiedExactly: true,
        repositoryMembershipComesOnlyFromGraph: true,
        frozenEvidenceSourcesAreExplicit: true,
        forkQualityUsesProvenanceAwareBundle: true,
        forkPortfolioQualityUsesLocalDeltaOnly: true,
        publicationPerformed: false,
        defaultActionChanged: false,
      },
    },
  };
}

function parseCliArgs(argv) {
  const options = {};
  const valueArgs = new Set(["--graph", "--out-dir", "--generator-revision", "--manifest", "--assessment-generated-at"]);
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!valueArgs.has(key)) throw new Error(`unsupported argument: ${key}`);
    const value = argv[index + 1];
    if (value == null || value.startsWith("--")) throw new Error(`${key} requires a value`);
    options[key] = value;
    index += 1;
  }
  for (const required of ["--graph", "--out-dir", "--generator-revision"]) {
    if (!options[required]) throw new Error(`${required} is required`);
  }
  return options;
}

export function runLiveQualitySidecarCandidateCli(argv) {
  const args = parseCliArgs(argv);
  const graphPath = path.resolve(args["--graph"]);
  const outDir = path.resolve(args["--out-dir"]);
  const assessmentPath = path.join(outDir, "assessment.json");
  const presentationPath = path.join(outDir, "quality-presentation.json");
  const diagnosticsPath = path.join(outDir, "quality-sidecar-diagnostics.json");
  for (const outputPath of [assessmentPath, presentationPath, diagnosticsPath]) {
    if (outputPath === graphPath) throw new Error("live Quality sidecar output must not overwrite graph input");
  }

  const result = buildLiveQualitySidecarCandidates(readJson(graphPath, "live graph"), {
    generatorRevision: args["--generator-revision"],
    assessmentGeneratedAt: args["--assessment-generated-at"],
    manifestPath: args["--manifest"] ? path.resolve(args["--manifest"]) : defaultManifestPath,
  });
  writeJson(assessmentPath, result.assessment);
  writeJson(presentationPath, result.presentation);
  writeJson(diagnosticsPath, result.diagnostics);
  return result;
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isMainModule()) {
  try {
    const result = runLiveQualitySidecarCandidateCli(process.argv.slice(2));
    process.stdout.write(
      `live Quality sidecars: ${result.presentation.diagnostics.joinedRepositories} joined, ${result.presentation.diagnostics.available} available, ${result.presentation.diagnostics.unavailable} unavailable\n`,
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
