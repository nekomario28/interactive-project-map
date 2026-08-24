import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CONTRIBUTED_DARK, CONTRIBUTED_LIGHT, nodeMarkup, palette } from "../scripts/galaxy-svg-common.mjs";

test("Contributed uses a warm, distinct Galaxy palette in both themes", () => {
  assert.equal(CONTRIBUTED_DARK, "#E69F00");
  assert.equal(CONTRIBUTED_LIGHT, "#A85D00");
  assert.equal(palette("dark").contributed, CONTRIBUTED_DARK);
  assert.equal(palette("light").contributed, CONTRIBUTED_LIGHT);
  assert.notEqual(palette("dark").contributed, palette("dark").owner);
  assert.notEqual(palette("dark").contributed, palette("dark").group);
});

test("static Galaxy Contributed nodes rely on the distinct status color without an extra node halo", () => {
  const colors = palette("dark");
  const markup = nodeMarkup({
    id: "repository:outside/project",
    label: "outside/project",
    type: "repository",
    relation: "contributed",
    archived: true,
    fork: true,
    stars: 20,
  }, 100, 100, colors);
  assert.match(markup, /fill="#E69F00"/);
  assert.doesNotMatch(markup, /stroke="#E69F00"/);
  assert.doesNotMatch(markup, /stroke="#d9847b"/);
});

test("browser emphasis uses one natural external halo orbit outside owned swept space", async () => {
  const source = await readFile(new URL("../scripts/public-contributed-emphasis.js", import.meta.url), "utf8");
  assert.match(source, /const CONTRIBUTED = "#E69F00"/);
  assert.match(source, /\["galaxy-classic", "galaxy-systems", "galaxy-hybrid"\]/);
  assert.match(source, /node\?\.type === "repository" && node\?\.relation === "contributed"/);
  assert.match(source, /edge\?\.type !== "contribution"/);
  assert.match(source, /function ownedSweepEnvelope\(owner\)/);
  assert.match(source, /groupRadius \+ localRadius/);
  assert.match(source, /runtime\.placement = "external-halo-orbit"/);
  assert.match(source, /baseRadius = Math\.max\(345, sweepRadius \+ 125\)/);
  assert.match(source, /radius = baseRadius \+ lane \* 86/);
  assert.match(source, /state\.style === "galaxy-systems" \? 1080/);
  assert.match(source, /ProjectMapContributedEmphasis/);
  assert.doesNotMatch(source, /external-rail/);
  assert.doesNotMatch(source, /railStartX/);
  assert.doesNotMatch(source, /ctx\./);
  assert.doesNotMatch(source, /drawNodesAndLabels/);
  assert.doesNotMatch(source, /setLineDash/);
  assert.doesNotMatch(source, /type:\s*["']membership["']/);
  assert.doesNotMatch(source, /groupId\s*=/);
});

test("Contributed filter styling uses the same identity color without a detached panel treatment", async () => {
  const source = await readFile(new URL("../scripts/public-contributed-emphasis.css", import.meta.url), "utf8");
  assert.match(source, /--contributed: #E69F00/);
  assert.match(source, /--status-color: var\(--contributed\)/);
  assert.doesNotMatch(source, /border-style:\s*dashed/);
  assert.doesNotMatch(source, /box-shadow:/);
});

test("viewer build attaches Contributed emphasis after generated viewer contracts", async () => {
  const source = await readFile(new URL("../scripts/apply-category-navigator.mjs", import.meta.url), "utf8");
  assert.match(source, /public-contributed-emphasis\.js/);
  assert.match(source, /public-contributed-emphasis\.css/);
  assert.match(source, /contributed-emphasis\.js/);
  assert.match(source, /contributed-emphasis\.css/);
});
