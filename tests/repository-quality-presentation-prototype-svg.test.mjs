import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildLiveQualitySidecarCandidates } from "../scripts/repository-quality-live-sidecar-candidate.mjs";
import {
  REPOSITORY_QUALITY_PRESENTATION_THEMES,
  renderRepositoryQualityPresentationPrototypeSvg,
} from "../scripts/repository-quality-presentation-prototype-svg.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const live = readJson("fixtures/repository-assessment-live-profile-minimal-2026-08-25.json");
const generatorRevision = "0b4caf1dcdd2f67fe35f772afce45b8782112209";

function model() {
  return buildLiveQualitySidecarCandidates(live.graph, { generatorRevision }).presentation;
}

function rgb(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`unsupported test color: ${hex}`);
  return [0, 2, 4].map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255);
}

function luminance(hex) {
  const [red, green, blue] = rgb(hex).map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(left, right) {
  const a = luminance(left);
  const b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("compact current-profile Quality prototype renders all fifteen repositories with attribution-safe 4/11 availability", () => {
  const svg = renderRepositoryQualityPresentationPrototypeSvg(model(), { view: "compact", columns: 3 });

  assert.match(svg, /^<svg /);
  assert.match(svg, /data-theme="dark"/);
  assert.match(svg, /4 available · 11 unavailable · Structure remains default/);
  assert.equal((svg.match(/class="quality-card"/g) ?? []).length, 15);
  assert.equal((svg.match(/class="repository-core"/g) ?? []).length, 15);
  assert.equal((svg.match(/r="14"/g) ?? []).length, 15);
  assert.equal((svg.match(/data-quality-state="available"/g) ?? []).length, 4);
  assert.equal((svg.match(/data-quality-state="unavailable"/g) ?? []).length, 11);
  assert.equal((svg.match(/class="quality-unavailable-ring"/g) ?? []).length, 11);
  assert.equal(svg.includes("data-dimension="), false);
  assert.match(svg, /data-repository-key="nekomario28\/antifullbright" data-quality-state="available"/);
  assert.match(svg, /antifullbright/);
  assert.match(svg, /5\/6 interpreted/);
  assert.match(svg, /data-finding="supports"/);
  assert.match(svg, /data-pattern="supports-solid"/);
  assert.match(svg, /data-pattern="unavailable-sparse-dash"/);
});

test("detail current-profile Quality prototype preserves dimension identity only for four attribution-safe repositories", () => {
  const svg = renderRepositoryQualityPresentationPrototypeSvg(model(), { view: "detail", columns: 3 });

  assert.equal((svg.match(/data-quality-state="available"/g) ?? []).length, 4);
  assert.equal((svg.match(/class="qseg qdetail /g) ?? []).length, 32);
  assert.equal((svg.match(/data-dimension="/g) ?? []).length, 32);
  assert.equal((svg.match(/class="quality-unavailable-ring"/g) ?? []).length, 11);
  assert.match(svg, /4\/6 interpreted/);
  assert.match(svg, /5\/6 interpreted/);
});

test("Quality semantic states retain non-color line-pattern identities", () => {
  const svg = renderRepositoryQualityPresentationPrototypeSvg(model(), { view: "detail" });

  assert.match(svg, /\.quality-supports \{ stroke: #[0-9a-f]{6}; \}/i);
  assert.match(svg, /\.quality-weakens \{[^}]*stroke-dasharray: 8 3;/);
  assert.match(svg, /\.quality-neutral \{[^}]*stroke-dasharray: 2 3;/);
  assert.match(svg, /\.quality-mixed \{[^}]*stroke-dasharray: 8 2 2 2;/);
  assert.match(svg, /\.quality-unknown \{[^}]*stroke-dasharray: 1 4;/);
  assert.match(svg, /\.quality-optional \{[^}]*stroke-dasharray: 5 4;/);
  assert.match(svg, /\.quality-unresolved-applicability \{[^}]*stroke-dasharray: 7 2 1 2;/);
  assert.match(svg, /\.quality-unavailable-ring \{[^}]*stroke-dasharray: 2 6;/);
});

test("dark and light Quality themes meet text and graphical-object contrast floors", () => {
  for (const [themeName, theme] of Object.entries(REPOSITORY_QUALITY_PRESENTATION_THEMES)) {
    for (const token of ["supports", "weakens", "neutral", "mixed", "unknown", "optional", "unresolved", "unavailable"]) {
      assert.ok(contrastRatio(theme[token], theme.card) >= 3, `${themeName}.${token} must retain at least 3:1 contrast against the card`);
    }
    for (const token of ["heading", "label", "meta", "coverage"]) {
      assert.ok(contrastRatio(theme[token], theme.card) >= 4.5, `${themeName}.${token} must retain at least 4.5:1 contrast against the card`);
    }
  }
});

test("light theme preserves the same current-profile semantics without changing geometry authority", () => {
  const svg = renderRepositoryQualityPresentationPrototypeSvg(model(), { view: "compact", columns: 3, theme: "light" });

  assert.match(svg, /data-theme="light"/);
  assert.match(svg, /color-scheme: light/);
  assert.equal((svg.match(/class="quality-card"/g) ?? []).length, 15);
  assert.equal((svg.match(/data-quality-state="available"/g) ?? []).length, 4);
  assert.equal((svg.match(/data-quality-state="unavailable"/g) ?? []).length, 11);
  assert.equal((svg.match(/r="14"/g) ?? []).length, 15);
  assert.equal(svg.includes("data-score="), false);
  assert.equal(svg.includes("prominence"), false);
});

test("prototype keeps fork snapshot context separate from attribution-safe ring availability", () => {
  const presentation = model();
  const gz = presentation.repositories.find((entry) => entry.repositoryKey === "nekomario28/gz-sim");
  const turing = presentation.repositories.find((entry) => entry.repositoryKey === "nekomario28/turing-smart-screen-python-owl");
  assert.equal(gz.qualityAttributionScope, "local-delta");
  assert.equal(gz.overlayState, "unavailable");
  assert.equal(turing.qualityAttributionScope, "local-delta");
  assert.equal(turing.overlayState, "available");

  const svg = renderRepositoryQualityPresentationPrototypeSvg(presentation, { view: "compact", columns: 5 });
  assert.match(svg, /interactive-project-map/);
  assert.match(svg, /antifullbright/);
  assert.match(svg, /gz-sim/);
  assert.match(svg, /turing-smart-screen-python-owl/);
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

test("prototype rejects unsupported models, views, and themes", () => {
  assert.throws(() => renderRepositoryQualityPresentationPrototypeSvg({ presentationId: "wrong", repositories: [{}] }), /unsupported Quality presentation model/);
  assert.throws(() => renderRepositoryQualityPresentationPrototypeSvg(model(), { view: "score" }), /unsupported Quality presentation view/);
  assert.throws(() => renderRepositoryQualityPresentationPrototypeSvg(model(), { theme: "sepia" }), /unsupported Quality presentation theme/);
});
