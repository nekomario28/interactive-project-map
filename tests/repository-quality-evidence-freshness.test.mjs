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

test("live presentation exposes bounded frozen snapshot freshness without claiming automatic refresh", () => {
  const result = buildLiveQualitySidecarCandidates(live.graph, { generatorRevision: revision });

  assert.deepEqual(result.presentation.evidenceFreshness, {
    mode: "bounded-frozen-snapshots",
    automaticRefresh: false,
    snapshotDates: ["2026-08-25"],
    oldestSnapshotDate: "2026-08-25",
    newestSnapshotDate: "2026-08-25",
  });
  assert.deepEqual(result.diagnostics.evidenceFreshness, result.presentation.evidenceFreshness);
  assert.equal(result.diagnostics.invariants.frozenEvidenceFreshnessIsPublished, true);
  assert.equal(result.diagnostics.invariants.automaticEvidenceRefreshPerformed, false);

  const available = result.presentation.repositories.filter((entry) => entry.overlayState === "available");
  const unavailable = result.presentation.repositories.filter((entry) => entry.overlayState !== "available");
  assert.equal(available.length, 4);
  assert.equal(unavailable.length, 11);
  assert.ok(available.every((entry) => entry.evidenceFreshness?.state === "frozen-snapshot"));
  assert.ok(available.every((entry) => entry.evidenceFreshness?.snapshotDate === "2026-08-25"));
  assert.ok(available.every((entry) => entry.evidenceFreshness?.automaticRefresh === false));
  assert.ok(unavailable.every((entry) => entry.evidenceFreshness == null));
});

test("frozen source without an explicit snapshotDate fails closed", () => {
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
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("freshness provenance follows the frozen evidence date, not graph regeneration time", () => {
  const graph = structuredClone(live.graph);
  graph.generatedAt = "2030-01-01T00:00:00.000Z";
  const result = buildLiveQualitySidecarCandidates(graph, { generatorRevision: revision });

  assert.equal(result.presentation.source.graphGeneratedAt, "2030-01-01T00:00:00.000Z");
  assert.equal(result.presentation.evidenceFreshness.newestSnapshotDate, "2026-08-25");
  assert.notEqual(result.presentation.source.graphGeneratedAt.slice(0, 10), result.presentation.evidenceFreshness.newestSnapshotDate);
});
