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

test("static Galaxy Contributed nodes have a non-color dashed halo and keep status precedence", () => {
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
  assert.match(markup, /stroke="#E69F00"/);
  assert.match(markup, /stroke-dasharray="3 3"/);
  assert.doesNotMatch(markup, /stroke="#d9847b"/);
});

test("browser emphasis runtime is presentation-only and exposes one shared Galaxy orbit contract", async () => {
  const source = await readFile(new URL("../scripts/public-contributed-emphasis.js", import.meta.url), "utf8");
  assert.match(source, /const CONTRIBUTED = "#E69F00"/);
  assert.match(source, /\["galaxy-classic", "galaxy-systems", "galaxy-hybrid"\]/);
  assert.match(source, /node\?\.type === "repository" && node\?\.relation === "contributed"/);
  assert.match(source, /ctx\.setLineDash\(\[3, 3\]\)/);
  assert.match(source, /ctx\.setLineDash\(\[3, 4\]\)/);
  assert.match(source, /ProjectMapContributedEmphasis/);
  assert.doesNotMatch(source, /type:\s*["']membership["']/);
  assert.doesNotMatch(source, /groupId\s*=/);
});

test("viewer build attaches Contributed emphasis after generated viewer contracts", async () => {
  const source = await readFile(new URL("../scripts/apply-category-navigator.mjs", import.meta.url), "utf8");
  assert.match(source, /public-contributed-emphasis\.js/);
  assert.match(source, /public-contributed-emphasis\.css/);
  assert.match(source, /contributed-emphasis\.js/);
  assert.match(source, /contributed-emphasis\.css/);
});
