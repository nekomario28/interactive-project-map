import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildRepositoryAssessmentCandidate } from "../scripts/repository-assessment-candidate.mjs";
import { buildQualityEvidenceVector } from "../scripts/repository-quality-evidence.mjs";
import { buildRepositoryQualityPresentationModel } from "../scripts/repository-quality-presentation.mjs";
import { renderRepositoryQualityPresentationPrototypeSvg } from "../scripts/repository-quality-presentation-prototype-svg.mjs";

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

function model() {
  const ipm = app("interactive-project-map-application");
  const group10 = app("projexd-group10-application");
  const gz = library("gz-sim");
  const turing = library("turing");
  const assessment = buildRepositoryAssessmentCandidate(live.graph, {
    generatorRevision,
    qualityEnrichments: [
      { repositoryKey: "nekomario28/interactive-project-map", state: "partial", value: quality(ipm.context.artifacts, ipm.evidence) },
      { repositoryKey: "nekomario28/projexd_group10", state: "partial", value: quality(group10.context.artifacts, group10.evidence) },
      { repositoryKey: "nekomario28/gz-sim", state: "partial", value: quality(gz.context.artifacts, gz.qualityEvidence) },
      { repositoryKey: "nekomario28/turing-smart-screen-python-owl", state: "partial", value: quality(turing.context.artifacts, turing.qualityEvidence) },
    ],
  }).artifact;
  return buildRepositoryQualityPresentationModel(policy, live.graph, assessment);
}

test("compact current-profile Quality prototype renders all fifteen repositories with explicit 4/11 availability", () => {
  const svg = renderRepositoryQualityPresentationPrototypeSvg(model(), { view: "compact", columns: 3 });

  assert.match(svg, /^<svg /);
  assert.match(svg, /4 available · 11 unavailable · Structure remains default/);
  assert.equal((svg.match(/class="quality-card"/g) ?? []).length, 15);
  assert.equal((svg.match(/class="repository-core"/g) ?? []).length, 15);
  assert.equal((svg.match(/r="14"/g) ?? []).length, 15);
  assert.equal((svg.match(/data-quality-state="available"/g) ?? []).length, 4);
  assert.equal((svg.match(/data-quality-state="unavailable"/g) ?? []).length, 11);
  assert.equal((svg.match(/class="quality-unavailable-ring"/g) ?? []).length, 11);
  assert.equal(svg.includes("data-dimension="), false);
  assert.match(svg, /data-finding="supports"/);
  assert.match(svg, /Quality not collected/);
});

test("detail current-profile Quality prototype preserves dimension identity only for the four assessed repositories", () => {
  const svg = renderRepositoryQualityPresentationPrototypeSvg(model(), { view: "detail", columns: 3 });

  assert.equal((svg.match(/data-quality-state="available"/g) ?? []).length, 4);
  assert.equal((svg.match(/class="qseg qdetail /g) ?? []).length, 32);
  assert.equal((svg.match(/data-dimension="/g) ?? []).length, 32);
  assert.equal((svg.match(/class="quality-unavailable-ring"/g) ?? []).length, 11);
  assert.match(svg, /4\/6 interpreted/);
});

test("prototype renders assessment artifact labels and does not import popularity or prominence geometry", () => {
  const svg = renderRepositoryQualityPresentationPrototypeSvg(model(), { view: "compact", columns: 5 });

  assert.match(svg, /interactive-project-map/);
  assert.match(svg, /application/);
  assert.match(svg, /gz-sim/);
  assert.match(svg, /library/);
  assert.match(svg, /c0c25034\/ProjExD_4|ProjExD_4/);
  assert.match(svg, /artifact unknown/);
  assert.equal(svg.includes("data-score="), false);
  assert.equal(svg.includes("stargazers"), false);
  assert.equal(svg.includes("forks_count"), false);
  assert.equal(svg.includes("prominence"), false);
});

test("prototype keeps external dataset donor out of the personal Quality canvas", () => {
  const svg = renderRepositoryQualityPresentationPrototypeSvg(model(), { view: "compact" });
  assert.equal(svg.includes("fivethirtyeight/data"), false);
  assert.equal(svg.includes("FiveThirtyEight"), false);
});

test("prototype rejects unsupported models and views", () => {
  assert.throws(
    () => renderRepositoryQualityPresentationPrototypeSvg({ presentationId: "wrong", repositories: [{}] }),
    /unsupported Quality presentation model/,
  );
  assert.throws(
    () => renderRepositoryQualityPresentationPrototypeSvg(model(), { view: "score" }),
    /unsupported Quality presentation view/,
  );
});
