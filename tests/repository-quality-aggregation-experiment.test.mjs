import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildQualityConfidenceVector } from "../scripts/repository-quality-confidence.mjs";
import { buildQualityEvidenceVector } from "../scripts/repository-quality-evidence.mjs";
import {
  buildQualityAggregationExperiment,
  compareKnownQualityPareto,
} from "../scripts/repository-quality-aggregation-experiment.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const policy = readJson("data/repository-assessment-policy.v1.json");
const applications = readJson("fixtures/repository-quality-real-calibration.v1.json");
const libraries = readJson("fixtures/repository-quality-fork-library-calibration.v1.json");
const dataset = readJson("fixtures/repository-quality-external-dataset-calibration.v1.json");

function evaluate(artifacts, evidence) {
  const quality = buildQualityEvidenceVector(policy, { artifacts, evidence });
  const confidence = buildQualityConfidenceVector(policy, quality);
  const aggregation = buildQualityAggregationExperiment(quality, confidence);
  return { quality, confidence, aggregation };
}

function application(id) {
  const entry = applications.cases.find((item) => item.id === id);
  return evaluate(entry.context.artifacts, entry.evidence);
}

function library(id) {
  const entry = libraries.cases.find((item) => item.id === id);
  return evaluate(entry.context.artifacts, entry.qualityEvidence);
}

test("aggregation experiment never emits a production composite Quality score", () => {
  const ipm = application("interactive-project-map-application");
  assert.equal(ipm.aggregation.compositeQualityScore, null);
  assert.equal(ipm.aggregation.recommendedProductionAggregation, "component-vector");
  assert.equal(ipm.aggregation.directionalBalanceCandidate.productionRankingAllowed, false);
  assert.equal(ipm.aggregation.paretoCandidate.productionRankingAllowed, false);
});

test("directional balance preserves weakening direction but keeps coverage separate", () => {
  const ipm = application("interactive-project-map-application").aggregation.directionalBalanceCandidate;
  const group = application("projexd-group10-application").aggregation.directionalBalanceCandidate;
  const contributed = application("projexd4-contributed-application").aggregation.directionalBalanceCandidate;

  assert.equal(ipm.value, 1);
  assert.equal(ipm.pureDirectionalCoverageRatio, 4 / 6);

  assert.equal(group.value, 1 / 3);
  assert.equal(group.netDirection, 1);
  assert.equal(group.pureDirectionalCoverageRatio, 3 / 6);

  assert.equal(contributed.value, -1);
  assert.equal(contributed.netDirection, -3);
  assert.equal(contributed.pureDirectionalCoverageRatio, 3 / 6);
});

test("a perfect directional balance can hide materially different evidence coverage", () => {
  const ipm = application("interactive-project-map-application").aggregation.directionalBalanceCandidate;
  const gz = library("gz-sim-library-fork-no-default-branch-delta").aggregation.directionalBalanceCandidate;
  const externalDataset = evaluate(dataset.subject.artifacts, dataset.qualityEvidence).aggregation.directionalBalanceCandidate;
  const oneKnown = evaluate(["application"], {
    understandability: [
      {
        authority: "repository-native",
        state: "observed",
        finding: "supports",
        evidenceClass: "C",
        sourceId: "counterexample:one-known-dimension",
        claim: "One known supporting dimension for scalar failure-mode calibration.",
      },
    ],
  }).aggregation.directionalBalanceCandidate;

  assert.equal(ipm.value, 1);
  assert.equal(gz.value, 1);
  assert.equal(externalDataset.value, 1);
  assert.equal(oneKnown.value, 1);

  assert.equal(ipm.pureDirectionalCoverageRatio, 4 / 6);
  assert.equal(gz.pureDirectionalCoverageRatio, 3 / 6);
  assert.equal(externalDataset.pureDirectionalCoverageRatio, 4 / 5);
  assert.equal(oneKnown.pureDirectionalCoverageRatio, 1 / 6);

  for (const candidate of [ipm, gz, externalDataset, oneKnown]) {
    assert.equal(candidate.productionRankingAllowed, false);
  }
});

test("bounded Pareto comparison detects dominance only on common known dimensions", () => {
  const ipm = application("interactive-project-map-application").aggregation;
  const group = application("projexd-group10-application").aggregation;
  const contributed = application("projexd4-contributed-application").aggregation;

  const ipmVsGroup = compareKnownQualityPareto(ipm, group);
  assert.equal(ipmVsGroup.relation, "left-dominates-on-common-known");
  assert.ok(ipmVsGroup.comparedDimensionIds.includes("stewardship"));
  assert.ok(ipmVsGroup.omittedDimensionIds.includes("verification"));
  assert.equal(ipmVsGroup.productionRankingAllowed, false);

  const groupVsContributed = compareKnownQualityPareto(group, contributed);
  assert.equal(groupVsContributed.relation, "left-dominates-on-common-known");
  assert.equal(groupVsContributed.productionRankingAllowed, false);
});

test("same project-side library findings can be equal without saying anything about fork Personal Contribution", () => {
  const gz = library("gz-sim-library-fork-no-default-branch-delta").aggregation;
  const turing = library("turing-library-fork-with-default-branch-delta").aggregation;
  const comparison = compareKnownQualityPareto(gz, turing);

  assert.equal(comparison.relation, "equal-on-common-known");
  assert.equal(comparison.productionRankingAllowed, false);
});

test("different artifact target sets are not flattened into one Pareto ranking", () => {
  const ipm = application("interactive-project-map-application").aggregation;
  const externalDataset = evaluate(dataset.subject.artifacts, dataset.qualityEvidence).aggregation;
  const comparison = compareKnownQualityPareto(ipm, externalDataset);

  assert.equal(comparison.relation, "incomparable-target-set");
  assert.equal(comparison.productionRankingAllowed, false);
});

test("mixed findings stay distinct from neutral and are not silently scored as zero", () => {
  const mixed = evaluate(["application"], {
    verification: [
      {
        authority: "repository-native",
        state: "observed",
        finding: "supports",
        evidenceClass: "C",
        sourceId: "counterexample:mixed-pass",
      },
      {
        authority: "repository-native",
        state: "observed",
        finding: "weakens",
        evidenceClass: "C",
        sourceId: "counterexample:mixed-fail",
      },
    ],
  }).aggregation.directionalBalanceCandidate;

  assert.deepEqual(mixed.mixedDimensionIds, ["verification"]);
  assert.equal(mixed.pureDirectionalDimensions, 0);
  assert.equal(mixed.value, null);
  assert.equal(mixed.productionRankingAllowed, false);
});
