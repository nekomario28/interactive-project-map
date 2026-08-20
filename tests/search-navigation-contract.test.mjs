import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../scripts/public-interaction-polish.js", import.meta.url), "utf8");

test("shared search layer owns facet aliases, reasons, and keyboard navigation", () => {
  assert.match(source, /searchMetadataAwareSanitizeGraph/);
  assert.match(source, /taxonomyAssignment\?\.secondaryTags/);
  assert.match(source, /searchTaxonomy/);
  assert.match(source, /category\?\.aliases/);
  assert.match(source, /directMatchReasons/);
  assert.match(source, /matchReasons/);
  assert.match(source, /reasons\(nodeOrId\)/);
  assert.match(source, /Match: \$\{reasons\.join/);
  assert.match(source, /navigateDirectSearch/);
  assert.match(source, /event\.key === "ArrowDown" \|\| event\.key === "ArrowUp"/);
  assert.match(source, /event\.key !== "Enter"/);
  assert.match(source, /window\.open\(target\.url, "_blank", "noopener"\)/);
});
