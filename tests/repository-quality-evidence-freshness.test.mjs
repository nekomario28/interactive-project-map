import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildLiveQualitySidecarCandidates,
  loadBoundedQualityEnrichments,
} from "../scripts/repository-quality-live-sidecar-candidate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const live = JSON.parse(fs.readFileSync(path.join(root, "fixtures/repository-assessment-live-profile-minimal-2026-08-25.json"), "utf8"));
const manifestPath = path.join(root, "data/repository-quality-live-profile-enrichment-sources.v1.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const revision = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ipm-quality-freshness-"));
}

function freshness(scope, sourceCount, snapshotDates) {
  return {
    mode: "bounded-frozen-snapshots",
    scope,
    automaticRefresh: false,
    sourceCount,
    snapshotDates,
    oldestSnapshotDate: snapshotDates[0],
    newestSnapshotDate: snapshotDates.at(-1),
  };
}

test("live presentation exposes presentation-eligible frozen freshness without laundering the older BuyClaim evidence date", () => {
  const result = buildLiveQualitySidecarCandidates(live.graph, { generatorRevision: revision });
  const mixedDates = ["2026-07-25", "2026-08-25"];

  assert.deepEqual(
    result.presentation.evidenceFreshness,
    freshness("portfolio-quality-presented-sources", 5, mixedDates),
  );
  assert.deepEqual(
    result.diagnostics.evidenceFreshness.assessment,
    freshness("all-bounded-assessment-sources", 6, mixedDates),
  );
  assert.deepEqual(result.diagnostics.evidenceFreshness.portfolioPresentation, result.presentation.evidenceFreshness);
  assert.equal(result.diagnostics.invariants.frozenEvidenceFreshnessIsPublished, true);
  assert.equal(result.diagnostics.invariants.automaticEvidenceRefreshPerformed, false);
  assert.equal(result.diagnostics.invariants.presentationFreshnessUsesPresentationEligibleSourcesOnly, true);

  const available = result.presentation.repositories.filter((entry) => entry.overlayState === "available");
  const unavailable = result.presentation.repositories.filter((entry) => entry.overlayState !== "available");
  assert.equal(available.length, 5);
  assert.equal(unavailable.length, 10);
  assert.ok(available.every((entry) => entry.evidenceFreshness?.state === "frozen-snapshot"));
  assert.ok(available.every((entry) => entry.evidenceFreshness?.automaticRefresh === false));
  assert.ok(unavailable.every((entry) => entry.evidenceFreshness == null));

  const buyclaim = available.find((entry) => String(entry.repositoryKey).toLowerCase() === "nekomario28/buyclaimchunks");
  assert.ok(buyclaim, "BuyClaimChunks must receive local-delta frozen presentation freshness");
  assert.equal(buyclaim.evidenceFreshness.snapshotDate, "2026-07-25");

  const buyclaimSource = result.diagnostics.enrichmentSources.find((entry) => entry.repositoryKey === "nekomario28/buyclaimchunks");
  assert.equal(buyclaimSource?.fixtureSnapshotDate, "2026-07-25");
  assert.equal(buyclaimSource?.presentationExpected, "available");
  assert.equal(buyclaimSource?.qualityAttributionScope, "local-delta");

  for (const key of [
    "nekomario28/interactive-project-map",
    "nekomario28/projexd_group10",
    "nekomario28/antifullbright",
    "nekomario28/turing-smart-screen-python-owl",
  ]) {
    assert.equal(available.find((entry) => String(entry.repositoryKey).toLowerCase() === key)?.evidenceFreshness?.snapshotDate, "2026-08-25", key);
  }

  const projexd = available.find((entry) => String(entry.repositoryKey).toLowerCase() === "nekomario28/projexd_group10");
  assert.ok(projexd, "case-insensitive source/presentation join must preserve ProjExD_Group10 freshness");

  const gzSource = result.diagnostics.enrichmentSources.find((entry) => entry.repositoryKey === "nekomario28/gz-sim");
  assert.equal(gzSource?.presentationExpected, "unavailable");
  assert.equal(gzSource?.fixtureSnapshotDate, "2026-08-25");
});

test("frozen source without an explicit valid snapshotDate fails closed", () => {
  const dir = tempDir();
  try {
    const sourceFixture = JSON.parse(fs.readFileSync(path.join(root, "fixtures/repository-quality-real-calibration.v1.json"), "utf8"));
    delete sourceFixture.snapshotDate;
    const fixturePath = path.join(dir, "missing-date.json");
    fs.writeFileSync(fixturePath, `${JSON.stringify(sourceFixture, null, 2)}\n`, "utf8");

    const badManifest = structuredClone(manifest);
    badManifest.sources = [{ ...badManifest.sources[0], fixture: fixturePath }];
    assert.throws(
      () => loadBoundedQualityEnrichments(badManifest, { manifestPath }),
      /snapshotDate must be an explicit YYYY-MM-DD frozen evidence date/,
    );

    sourceFixture.snapshotDate = "2026-02-31";
    fs.writeFileSync(fixturePath, `${JSON.stringify(sourceFixture, null, 2)}\n`, "utf8");
    assert.throws(
      () => loadBoundedQualityEnrichments(badManifest, { manifestPath }),
      /snapshotDate must be an explicit YYYY-MM-DD frozen evidence date/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("freshness provenance follows frozen evidence dates, not graph regeneration time", () => {
  const graph = structuredClone(live.graph);
  graph.generatedAt = "2030-01-01T00:00:00.000Z";
  const result = buildLiveQualitySidecarCandidates(graph, { generatorRevision: revision });

  assert.equal(result.presentation.source.graphGeneratedAt, "2030-01-01T00:00:00.000Z");
  assert.deepEqual(result.presentation.evidenceFreshness.snapshotDates, ["2026-07-25", "2026-08-25"]);
  assert.equal(result.presentation.evidenceFreshness.oldestSnapshotDate, "2026-07-25");
  assert.equal(result.presentation.evidenceFreshness.newestSnapshotDate, "2026-08-25");
  assert.equal(result.diagnostics.evidenceFreshness.assessment.newestSnapshotDate, "2026-08-25");
  assert.notEqual(result.presentation.source.graphGeneratedAt.slice(0, 10), result.presentation.evidenceFreshness.newestSnapshotDate);
});

test("assessment freshness may include an unavailable older fork source without leaking that source into portfolio freshness", () => {
  const dir = tempDir();
  try {
    const forkFixture = JSON.parse(fs.readFileSync(path.join(root, "fixtures/repository-fork-quality-provenance-calibration.v1.json"), "utf8"));
    forkFixture.snapshotDate = "2026-08-24";
    const fixturePath = path.join(dir, "older-gz-source.json");
    fs.writeFileSync(fixturePath, `${JSON.stringify(forkFixture, null, 2)}\n`, "utf8");

    const customManifest = structuredClone(manifest);
    const gz = customManifest.sources.find((source) => source.repositoryKey === "nekomario28/gz-sim");
    gz.fixture = fixturePath;

    const result = buildLiveQualitySidecarCandidates(live.graph, {
      generatorRevision: revision,
      manifest: customManifest,
      manifestPath,
    });

    assert.deepEqual(
      result.diagnostics.evidenceFreshness.assessment,
      freshness("all-bounded-assessment-sources", 6, ["2026-07-25", "2026-08-24", "2026-08-25"]),
    );
    assert.deepEqual(
      result.presentation.evidenceFreshness,
      freshness("portfolio-quality-presented-sources", 5, ["2026-07-25", "2026-08-25"]),
    );
    const gzSource = result.diagnostics.enrichmentSources.find((entry) => entry.repositoryKey === "nekomario28/gz-sim");
    assert.equal(gzSource?.fixtureSnapshotDate, "2026-08-24");
    assert.equal(result.presentation.repositories.find((entry) => String(entry.repositoryKey).toLowerCase() === "nekomario28/gz-sim")?.evidenceFreshness, undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
