import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  evaluateProminenceCandidates,
  scoreProminenceCandidate,
  validateProminenceCandidate,
} from "../scripts/portfolio-prominence-calibration.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const config = readJson("data/portfolio-prominence-candidates.v1.json");
const fixture = readJson("fixtures/portfolio-prominence-calibration.v1.json");

const results = evaluateProminenceCandidates(config.candidates, fixture.cases);

for (const [candidateId, candidate] of Object.entries(config.candidates)) {
  test(`${candidateId} is a valid calibration candidate`, () => {
    assert.equal(validateProminenceCandidate(candidate), true);
  });

  test(`${candidateId} gives Impact material influence without replacing Quality`, () => {
    const a = results[candidateId]["high-quality-zero-star-solo"];
    const b = results[candidateId]["popular-solo-lower-quality"];
    assert.ok(b.personalPortfolioProminence > a.personalPortfolioProminence);
    assert.ok(a.personalPortfolioProminence > 0);
    assert.ok(a.components.quality > b.components.quality);
  });

  test(`${candidateId} contribution-gates famous external projects`, () => {
    const tiny = results[candidateId]["famous-project-tiny-contribution"];
    const maintainer = results[candidateId]["large-project-core-maintainer"];
    assert.ok(tiny.projectProminence > 0.9);
    assert.ok(tiny.personalPortfolioProminence < 0.2);
    assert.ok(maintainer.personalPortfolioProminence > tiny.personalPortfolioProminence);
    assert.ok(maintainer.personalPortfolioProminence > 0.75);
  });

  test(`${candidateId} does not fabricate a personal score when contribution is unknown`, () => {
    const unknown = results[candidateId]["shared-project-unknown-personal-contribution"];
    assert.ok(unknown.projectProminence > 0);
    assert.equal(unknown.personalPortfolioProminence, null);
    assert.equal(unknown.attribution.state, "unknown-personal-contribution");
  });

  test(`${candidateId} keeps confidence separate from merit`, () => {
    const candidate = config.candidates[candidateId];
    const base = scoreProminenceCandidate(candidate, {
      relation: "owned-solo",
      components: { quality: 0.8, impact: 0.4, scale: 0.5, maturity: 0.7, confidence: 0.2 },
    });
    const strongerConfidence = scoreProminenceCandidate(candidate, {
      relation: "owned-solo",
      components: { quality: 0.8, impact: 0.4, scale: 0.5, maturity: 0.7, confidence: 1.0 },
    });
    assert.equal(base.projectProminence, strongerConfidence.projectProminence);
    assert.equal(base.personalPortfolioProminence, strongerConfidence.personalPortfolioProminence);
    assert.equal(base.confidencePolicy.weightedIntoMerit, false);
  });
}

test("project prominence is independent of Personal Contribution; personal prominence is monotonic", () => {
  const candidate = config.candidates["balanced-v1"];
  const low = scoreProminenceCandidate(candidate, {
    relation: "contributed",
    components: { quality: 0.9, impact: 0.9, scale: 0.9, maturity: 0.9, personalContribution: 0.1, confidence: 0.9 },
  });
  const high = scoreProminenceCandidate(candidate, {
    relation: "contributed",
    components: { quality: 0.9, impact: 0.9, scale: 0.9, maturity: 0.9, personalContribution: 0.9, confidence: 0.9 },
  });
  assert.equal(low.projectProminence, high.projectProminence);
  assert.ok(high.personalPortfolioProminence > low.personalPortfolioProminence);
});

test("raw Activity, star counts, and other uncalibrated inputs are rejected", () => {
  const candidate = config.candidates["balanced-v1"];
  const components = { quality: 0.8, impact: 0.8, scale: 0.6, maturity: 0.8, confidence: 0.8 };
  for (const [key, value] of [["activity", 0.9], ["stars", 5000], ["loc", 100000]]) {
    assert.throws(
      () => scoreProminenceCandidate(candidate, { relation: "owned-solo", components, [key]: value }),
      /not a calibrated prominence input/,
    );
  }
});

test("candidate set remains calibration-only and does not freeze tiers", () => {
  assert.equal(config.status, "calibration-only");
  assert.equal(config.activityPolicy, "not-a-prominence-input");
  assert.ok(config.notFrozen.includes("production-formula"));
  assert.ok(config.notFrozen.includes("tier-thresholds"));
  for (const candidateId of Object.keys(config.candidates)) {
    assert.equal(results[candidateId]["meaningful-team-project"].tier, null);
  }
});
