import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildRepositoryImpactEvidence, compareRecognition } from "../scripts/repository-impact-features.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const fixtures = JSON.parse(fs.readFileSync(path.join(root, "fixtures/repository-impact-calibration.v1.json"), "utf8"));
const byId = new Map(fixtures.cases.map((entry) => [entry.id, entry]));
const SOLO_ORIGINAL = { ownership: "owned", collaboration: "solo", lineage: "original" };
const OWNED_FORK = { ownership: "owned", collaboration: "unknown", lineage: "fork" };

test("zero is observed and missing optional adoption evidence remains unknown", () => {
  const evidence = buildRepositoryImpactEvidence({ relation: SOLO_ORIGINAL, stars: 0, forks: 0 });
  assert.equal(evidence.projectSide.recognition.state, "observed");
  assert.equal(evidence.projectSide.recognition.raw, 0);
  assert.equal(evidence.projectSide.adoption.dependents.state, "unknown");
  assert.equal(evidence.projectSide.adoption.downloads.state, "unknown");
  assert.equal(evidence.projectSide.researchDomainUptake.citations.state, "unknown");
});

test("stars are material recognition evidence but have no direct Quality effect", () => {
  const low = byId.get("ipm-low-recognition-original").input;
  const high = byId.get("popular-original-synthetic").input;
  const lowEvidence = buildRepositoryImpactEvidence(low);
  const highEvidence = buildRepositoryImpactEvidence(high);

  assert.equal(lowEvidence.projectSide.recognition.raw, 1);
  assert.equal(highEvidence.projectSide.recognition.raw, 5000);
  assert.equal(highEvidence.projectSide.recognition.directQualityEffect, false);
  assert.equal(compareRecognition(low, high), -1);
  assert.ok(highEvidence.projectSide.recognition.transformed < highEvidence.projectSide.recognition.raw);
});

test("fork count is reuse/derivative interest, never a literal adopter count", () => {
  const input = byId.get("original-with-ambiguous-fork-interest").input;
  const evidence = buildRepositoryImpactEvidence(input);
  assert.equal(evidence.projectSide.reuseDerivativeInterest.raw, 5);
  assert.equal(evidence.projectSide.reuseDerivativeInterest.interpretation, "reuse-derivative-interest");
  assert.equal(evidence.projectSide.reuseDerivativeInterest.independentAdopterCount, null);
});

test("fork upstream reputation is context only and cannot become local fork Impact", () => {
  for (const id of ["gz-sim-upstream-context", "turing-upstream-context"]) {
    const input = byId.get(id).input;
    const evidence = buildRepositoryImpactEvidence(input);
    assert.equal(evidence.projectSide.recognition.raw, 0);
    assert.equal(evidence.upstreamContext.contextOnly, true);
    assert.equal(evidence.upstreamContext.eligibleForLocalImpact, false);
    assert.ok(evidence.upstreamContext.recognition.raw > 1000);
    assert.equal(evidence.attribution.profile, "fork");
    assert.equal(evidence.attribution.upstreamMetricsAreContextOnly, true);
    assert.equal(evidence.compositeImpact, null);
  }
});

test("a fork with unavailable parent metadata preserves unknown upstream context rather than zero", () => {
  const evidence = buildRepositoryImpactEvidence({ relation: OWNED_FORK, stars: 0, forks: 0 });
  assert.equal(evidence.upstreamContext.state, "unknown");
  assert.equal(evidence.upstreamContext.recognition.raw, null);
  assert.equal(evidence.upstreamContext.reuseDerivativeInterest.raw, null);
});

test("contributed project Impact requires a separate Personal Contribution gate", () => {
  const input = byId.get("contributed-famous-project").input;
  const evidence = buildRepositoryImpactEvidence(input);
  assert.equal(evidence.projectSide.recognition.raw, 100000);
  assert.equal(evidence.projectSide.collaborationContext.contributors.raw, 1000);
  assert.equal(evidence.projectSide.collaborationContext.personalContributionInferred, false);
  assert.equal(evidence.attribution.profile, "contributed");
  assert.equal(evidence.attribution.requiresPersonalContributionGate, true);
  assert.equal(evidence.portfolioProminenceEffect, null);
});

test("count normalization is monotonic and compresses heavy tails", () => {
  const one = buildRepositoryImpactEvidence({ relation: SOLO_ORIGINAL, stars: 1, forks: 0 });
  const hundred = buildRepositoryImpactEvidence({ relation: SOLO_ORIGINAL, stars: 100, forks: 0 });
  const tenThousand = buildRepositoryImpactEvidence({ relation: SOLO_ORIGINAL, stars: 10000, forks: 0 });
  assert.ok(one.projectSide.recognition.transformed < hundred.projectSide.recognition.transformed);
  assert.ok(hundred.projectSide.recognition.transformed < tenThousand.projectSide.recognition.transformed);
  assert.ok(tenThousand.projectSide.recognition.transformed < 100 * hundred.projectSide.recognition.transformed);
});

test("fork lineage is single-source and duplicate fork flags fail closed", () => {
  assert.throws(
    () => buildRepositoryImpactEvidence({ relation: OWNED_FORK, fork: true, stars: 0, forks: 0 }),
    /encoded by relation.lineage/,
  );
  assert.throws(
    () => buildRepositoryImpactEvidence({ relation: SOLO_ORIGINAL, stars: 0, forks: 0, parent: { stars: 1, forks: 1 } }),
    /only valid when relation.lineage is fork/,
  );
});
