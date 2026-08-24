import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildForkQualityBundle, selectForkPortfolioQualityVector } from "../scripts/repository-fork-quality.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const policy = readJson("data/repository-assessment-policy.v1.json");
const calibration = readJson("fixtures/repository-fork-quality-provenance-calibration.v1.json");

function build(entry) {
  return buildForkQualityBundle(policy, {
    relation: entry.context.relation,
    artifacts: entry.context.artifacts,
    upstream: entry.upstream,
    snapshotEvidence: entry.snapshotEvidence,
    localDeltaObservation: entry.localDeltaObservation,
    localDeltaEvidence: entry.localDeltaEvidence,
  });
}

test("fork snapshot Quality and person-side local-delta Quality remain separate", () => {
  for (const entry of calibration.cases) {
    const bundle = build(entry);
    assert.equal(bundle.contractId, calibration.forkQualityContractId, entry.id);
    assert.equal(bundle.relation.lineage, "fork", entry.id);
    assert.equal(bundle.snapshotQuality.personSideEligible, false, entry.id);
    assert.equal(bundle.personalAttribution.snapshotQualityEligible, false, entry.id);
    assert.equal(bundle.personalAttribution.upstreamInheritedEvidenceEligible, false, entry.id);
    assert.equal(bundle.personalAttribution.qualitySource, "local-delta-only", entry.id);
    assert.equal(bundle.compositeForkQualityScore, null, entry.id);
    assert.equal(bundle.productionRankingAllowed, false, entry.id);

    for (const dimension of entry.expected.snapshotSupports) {
      assert.equal(bundle.snapshotQuality.value.dimensions[dimension].findingState, "supports", `${entry.id}:${dimension}`);
    }
    assert.equal(bundle.snapshotQuality.evidenceOriginState, entry.expected.snapshotOrigin, entry.id);
    assert.equal(bundle.localDelta.quality.state, entry.expected.localDeltaQualityState, entry.id);

    const selected = selectForkPortfolioQualityVector(bundle);
    assert.equal(selected.state === "available", entry.expected.portfolioQualityAvailable, entry.id);
  }
});

test("fork with no observed local default-branch delta does not expose inherited snapshot Quality as portfolio Quality", () => {
  const entry = calibration.cases.find((item) => item.id.startsWith("gz-sim"));
  const bundle = build(entry);
  const selected = selectForkPortfolioQualityVector(bundle);

  assert.equal(bundle.snapshotQuality.evidenceOriginCounts["upstream-inherited"], 3);
  assert.equal(bundle.localDelta.observation.state, "observed");
  assert.equal(bundle.localDelta.observation.presence, "absent");
  assert.equal(bundle.localDelta.quality.state, "not-applicable");
  assert.equal(selected.state, "unavailable");
  assert.equal(selected.reason, "no-local-delta-observed-in-comparison-scope");
});

test("fork with local delta exposes only locally evidenced Quality to person-side portfolio presentation", () => {
  const entry = calibration.cases.find((item) => item.id.startsWith("turing"));
  const bundle = build(entry);
  const selected = selectForkPortfolioQualityVector(bundle);

  assert.equal(bundle.snapshotQuality.evidenceOriginCounts.local, 2);
  assert.equal(bundle.snapshotQuality.evidenceOriginCounts["upstream-inherited"], 1);
  assert.equal(bundle.snapshotQuality.evidenceOriginState, "mixed");
  assert.equal(bundle.localDelta.evidenceOriginState, "local");
  assert.equal(selected.state, "available");
  assert.equal(selected.value.dimensions.understandability.findingState, "supports");
  assert.equal(selected.value.dimensions.reproducibility.findingState, "supports");
  assert.equal(selected.value.dimensions.stewardship.findingState, entry.expected.localDeltaStewardship);
  assert.equal(selected.value.compositeQualityScore, null);
});

test("upstream-inherited evidence is rejected from local-delta Quality", () => {
  const entry = structuredClone(calibration.cases.find((item) => item.id.startsWith("turing")));
  entry.localDeltaEvidence.stewardship = [{
    origin: "upstream-inherited",
    authority: "repository-native",
    state: "observed",
    finding: "supports",
    evidenceClass: "C",
    sourceId: "LICENSE",
    claim: "Inherited license",
  }];

  assert.throws(() => build(entry), /cannot enter local-delta Quality/);
});

test("unknown local delta never becomes zero or direct personal Quality", () => {
  const entry = structuredClone(calibration.cases.find((item) => item.id.startsWith("turing")));
  entry.localDeltaObservation = { state: "unknown", presence: "unknown", scope: "main...main", evidence: null };
  delete entry.localDeltaEvidence;
  const bundle = build(entry);
  const selected = selectForkPortfolioQualityVector(bundle);

  assert.equal(bundle.localDelta.quality.state, "not-collected");
  assert.equal(bundle.localDelta.observation.presence, "unknown");
  assert.equal(selected.state, "unavailable");
  assert.equal(bundle.compositeForkQualityScore, null);
});
