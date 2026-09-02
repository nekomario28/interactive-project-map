import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../scripts/public-viewer.js", import.meta.url), "utf8");

test("shared viewer owns the reviewed style contract canonically", () => {
  assert.match(source, /const STYLE_VALUES = new Set\(\["galaxy-classic", "galaxy-systems", "galaxy-hybrid", "obsidian"\]\);/);
  assert.match(source, /function normalizeGraphStyle\(value\) \{ return value === "galaxy" \? "galaxy-systems" : STYLE_VALUES\.has\(value\) \? value : "galaxy-systems"; \}/);
  assert.match(source, /let initialStyle = normalizeGraphStyle\(query\.get\("style"\)\);/);
  assert.match(source, /state\.style = normalizeGraphStyle\(styleSelect\.value\);/);
  assert.doesNotMatch(source, /STYLE_VALUES\.has\(query\.get\("style"\)\).*"galaxy"/);
  assert.doesNotMatch(source, /state\.style = STYLE_VALUES\.has\(styleSelect\.value\)/);
});

test("shared viewer owns the reviewed viewport contract canonically", () => {
  assert.match(source, /Math\.min\(\(size\.width \* 0\.84\) \/ width, \(size\.height \* 0\.78\) \/ height\), 0\.04, 2\.2/);
  assert.doesNotMatch(source, /\), 0\.25, 2\.2\)/);
  assert.equal((source.match(/, 0\.04, 4\.5\)/g) || []).length, 3);
  assert.doesNotMatch(source, /, 0\.2, 4\.5\)/);
  assert.match(source, /if \(fit && state\.style === "obsidian"\) \{[\s\S]*?state\.zoom = 1;[\s\S]*?state\.pan\.x = 0;[\s\S]*?state\.pan\.y = 0;[\s\S]*?state\.fitted = true;[\s\S]*?\} else if \(fit\) \{[\s\S]*?fitView\(\);[\s\S]*?\}/);
});

test("Galaxy variants retain the existing non-Obsidian rendering branch", () => {
  assert.equal((source.match(/state\.style !== "obsidian"/g) || []).length, 3);
  assert.doesNotMatch(source, /state\.style === "galaxy"/);
});
