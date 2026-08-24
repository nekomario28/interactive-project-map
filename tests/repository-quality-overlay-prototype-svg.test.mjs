import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildQualityConfidenceVector } from "../scripts/repository-quality-confidence.mjs";
import { buildQualityEvidenceVector } from "../scripts/repository-quality-evidence.mjs";
import { buildQualityOverlayModel } from "../scripts/repository-quality-overlay.mjs";
import { renderQualityOverlayPrototypeSvg } from "../scripts/repository-quality-overlay-prototype-svg.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const policy = readJson("data/repository-assessment-policy.v1.json");
const applications = readJson("fixtures/repository-quality-real-calibration.v1.json");
const dataset = readJson("fixtures/repository-quality-external-dataset-calibration.v1.json");

function overlay(artifacts, evidence, applicability = undefined) {
  const quality = buildQualityEvidenceVector(policy, { artifacts, evidence, applicability });
  const confidence = buildQualityConfidenceVector(policy, quality);
  return buildQualityOverlayModel(policy, quality, confidence);
}

function application(id, applicability = undefined) {
  const entry = applications.cases.find((item) => item.id === id);
  return overlay(entry.context.artifacts, entry.evidence, applicability);
}

const prototypeItems = () => [
  {
    label: "interactive-project-map",
    artifact: "application",
    overlay: application("interactive-project-map-application"),
  },
  {
    label: "ProjExD_Group10",
    artifact: "application",
    overlay: application("projexd-group10-application"),
  },
  {
    label: "FiveThirtyEight dataset slice",
    artifact: "dataset",
    overlay: overlay(dataset.subject.artifacts, dataset.qualityEvidence),
  },
  {
    label: "ProjExD_Group10 N/A security",
    artifact: "application",
    overlay: application("projexd-group10-application", { "security-safety": "not-applicable" }),
  },
];

test("full SVG prototype renders eight semantic ring slots per repository with equal node cores", () => {
  const svg = renderQualityOverlayPrototypeSvg(prototypeItems());

  assert.match(svg, /^<svg /);
  assert.equal((svg.match(/class="qseg qfull /g) ?? []).length, 32);
  assert.equal((svg.match(/data-ring-mode="full"/g) ?? []).length, 4);
  assert.equal((svg.match(/class="repository-core"/g) ?? []).length, 4);
  assert.equal((svg.match(/r="14"/g) ?? []).length, 4);
  assert.match(svg, /4\/6 interpreted/);
  assert.match(svg, /4\/5 interpreted/);
  assert.match(svg, /quality-weakens/);
  assert.match(svg, /quality-unknown/);
  assert.match(svg, /quality-optional/);
  assert.match(svg, /quality-not-applicable/);
});

test("compact SVG prototype renders target finding distributions instead of eight dimension slots", () => {
  const svg = renderQualityOverlayPrototypeSvg(prototypeItems(), { ringMode: "compact", columns: 2 });

  assert.equal((svg.match(/data-ring-mode="compact"/g) ?? []).length, 4);
  assert.equal(svg.includes("data-dimension="), false);
  assert.match(svg, /data-finding="supports"/);
  assert.match(svg, /data-finding="weakens"/);
  assert.match(svg, /data-finding="unknown"/);
  assert.equal(svg.includes("data-finding="), true);
  assert.equal((svg.match(/class="repository-core"/g) ?? []).length, 4);
  assert.equal((svg.match(/r="14"/g) ?? []).length, 4);
});

test("items may mix full detail and compact summary rings without changing node size", () => {
  const items = prototypeItems();
  items[0].ringMode = "full";
  items[1].ringMode = "compact";
  const svg = renderQualityOverlayPrototypeSvg(items.slice(0, 2), { columns: 2, ringMode: "compact" });

  assert.equal((svg.match(/data-ring-mode="full"/g) ?? []).length, 1);
  assert.equal((svg.match(/data-ring-mode="compact"/g) ?? []).length, 1);
  assert.equal((svg.match(/r="14"/g) ?? []).length, 2);
});

test("SVG prototype uses semantic Quality state rather than score, popularity or prominence geometry", () => {
  const svg = renderQualityOverlayPrototypeSvg([
    {
      label: "interactive-project-map",
      artifact: "application",
      overlay: application("interactive-project-map-application"),
    },
  ], { columns: 1, ringMode: "compact" });

  assert.equal(svg.includes("data-score="), false);
  assert.equal(svg.includes("stargazers"), false);
  assert.equal(svg.includes("forks_count"), false);
  assert.equal(svg.includes("prominence"), false);
  assert.match(svg, /aria-label="Repository Quality evidence ring prototype"/);
});

test("prototype escapes repository labels before embedding them into SVG", () => {
  const svg = renderQualityOverlayPrototypeSvg([
    {
      label: "repo <unsafe> & test",
      artifact: "application",
      overlay: application("interactive-project-map-application"),
    },
  ], { columns: 1 });

  assert.match(svg, /repo &lt;unsafe&gt; &amp; test/);
  assert.equal(svg.includes("repo <unsafe>"), false);
});

test("unsupported ring mode is rejected", () => {
  assert.throws(
    () => renderQualityOverlayPrototypeSvg(prototypeItems(), { ringMode: "score" }),
    /unsupported ringMode/,
  );
});
