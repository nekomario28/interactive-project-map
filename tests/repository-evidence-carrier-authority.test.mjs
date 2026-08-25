import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertLiveEvidenceCarrierAuthority,
  evaluateEvidenceCarrierAuthority,
} from "../scripts/repository-evidence-carrier-authority.mjs";
import { loadBoundedQualityEnrichments } from "../scripts/repository-quality-live-sidecar-candidate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const activeCarrier = JSON.parse(fs.readFileSync(
  path.join(root, "fixtures/repository-quality-active-carrier-game-mod-calibration.v1.json"),
  "utf8",
)).cases[0];

function alignedCase() {
  return {
    repository: "example/aligned",
    carrier: {
      authorityScope: "repository-default-branch",
      branch: "main",
      defaultBranch: "main",
      authorityMatch: true,
      productionAdmissionEligible: true,
    },
  };
}

test("legacy bounded fixtures without carrier metadata retain their current admission behavior", () => {
  assert.deepEqual(evaluateEvidenceCarrierAuthority({ repository: "example/legacy" }), {
    declared: false,
    consumerScope: "repository-default-branch-implicit",
    liveAdmissionAllowed: true,
    reasonCodes: [],
  });
});

test("explicit default-branch carrier authority is compatible with the current repository-level consumer", () => {
  const result = evaluateEvidenceCarrierAuthority(alignedCase());
  assert.equal(result.declared, true);
  assert.equal(result.authorityScope, "repository-default-branch");
  assert.equal(result.branch, "main");
  assert.equal(result.defaultBranch, "main");
  assert.equal(result.liveAdmissionAllowed, true);
  assert.deepEqual(result.reasonCodes, []);
  assert.doesNotThrow(() => assertLiveEvidenceCarrierAuthority(alignedCase(), "aligned"));
});

test("FTBPublicClaims active carrier remains assessment evidence but is blocked from implicit default-branch live admission", () => {
  const result = evaluateEvidenceCarrierAuthority(activeCarrier);
  assert.equal(result.declared, true);
  assert.equal(result.consumerScope, "repository-default-branch-implicit");
  assert.equal(result.authorityScope, "active-development-carrier");
  assert.equal(result.branch, "neoforge-1.21.1-port");
  assert.equal(result.defaultBranch, "public-claim-context");
  assert.equal(result.liveAdmissionAllowed, false);
  assert.ok(result.reasonCodes.includes("explicit-authority-mismatch"));
  assert.ok(result.reasonCodes.includes("production-admission-disabled"));
  assert.ok(result.reasonCodes.includes("non-default-carrier"));
  assert.ok(result.reasonCodes.includes("consumer-does-not-model-carrier-scope"));
  assert.throws(
    () => assertLiveEvidenceCarrierAuthority(activeCarrier, "FTBPublicClaims"),
    /evidence carrier authority is not compatible with live repository identity/,
  );
});

test("branch mismatch fails closed even when a fixture incorrectly marks itself production eligible", () => {
  const value = alignedCase();
  value.carrier.authorityScope = "repository-default-branch";
  value.carrier.branch = "feature/verified";
  value.carrier.authorityMatch = true;
  value.carrier.productionAdmissionEligible = true;

  const result = evaluateEvidenceCarrierAuthority(value);
  assert.equal(result.liveAdmissionAllowed, false);
  assert.deepEqual(result.reasonCodes, ["non-default-carrier"]);
});

test("declared carrier metadata without enough authority identity fails closed", () => {
  const result = evaluateEvidenceCarrierAuthority({ repository: "example/unresolved", carrier: {} });
  assert.equal(result.liveAdmissionAllowed, false);
  assert.deepEqual(result.reasonCodes, ["carrier-authority-unresolved"]);
});

test("live manifest loading rejects a frozen source whose evidence comes from a non-default carrier", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ipm-carrier-authority-"));
  try {
    const fixturePath = path.join(dir, "carrier.json");
    const fixture = {
      schemaVersion: 1,
      snapshotDate: "2026-08-25",
      policyId: "ipm-repository-assessment-v1",
      status: "frozen-synthetic-carrier-gate",
      cases: [{
        id: "synthetic-non-default-carrier",
        repository: "example/non-default",
        context: {
          artifacts: ["game-mod"],
          relation: { ownership: "owned", collaboration: "unknown", lineage: "original" },
        },
        carrier: {
          authorityScope: "active-development-carrier",
          branch: "feature/verified",
          defaultBranch: "main",
          authorityMatch: false,
          productionAdmissionEligible: false,
        },
        evidence: {
          understandability: [{
            authority: "repository-native",
            state: "observed",
            finding: "supports",
            evidenceClass: "C",
            sourceId: "README.md@synthetic",
            claim: "synthetic carrier gate fixture",
          }],
        },
      }],
    };
    fs.writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");

    const manifest = {
      schemaVersion: 1,
      manifestId: "ipm-live-profile-quality-enrichment-sources-v1",
      assessmentPolicyId: "ipm-repository-assessment-v1",
      sources: [{
        repositoryKey: "example/non-default",
        mode: "repository-snapshot",
        fixture: fixturePath,
        caseId: "synthetic-non-default-carrier",
        evidenceField: "evidence",
        presentationExpected: "available",
      }],
    };

    assert.throws(
      () => loadBoundedQualityEnrichments(manifest, { manifestPath: path.join(dir, "manifest.json") }),
      /evidence carrier authority is not compatible with live repository identity/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
