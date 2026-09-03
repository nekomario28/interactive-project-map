import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(
  await readFile(new URL("../docs/ui-semantic-token-mapping.json", import.meta.url), "utf8")
);
const grammar = JSON.parse(
  await readFile(new URL("../design/ui-reference-grammar.json", import.meta.url), "utf8")
);

const expectedMappings = new Map([
  ["color.bg.canvas", "--bg"],
  ["color.bg.surface", "--panel"],
  ["color.bg.surfaceRaised", "--panel-elevated"],
  ["color.text.primary", "--text"],
  ["color.text.muted", "--muted"],
  ["color.border.subtle", "--border"],
  ["color.border.focus", "--accent"],
  ["color.selection.selected", "--accent"]
]);

function sorted(values) {
  return [...values].sort();
}

test("neutral semantic-token mapping stays bounded to the measured shared 2D viewer", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.authority, "CONSUMER_OWNED_MAPPING");
  assert.equal(manifest.consumer.project, "nekomario28/interactive-project-map");
  assert.equal(manifest.consumer.surface, "PUBLIC_2D_VIEWER");
  assert.deepEqual(manifest.consumer.claimedModes, ["default", "obsidian"]);
  assert.equal(manifest.scope.mode, "EXPLICIT");
  assert.deepEqual(sorted(manifest.scope.roles), sorted(expectedMappings.keys()));
  assert.equal(manifest.mappings.length, expectedMappings.size);

  for (const mapping of manifest.mappings) {
    assert.equal(mapping.consumerToken, expectedMappings.get(mapping.role));
    assert.equal(mapping.valueSource, "scripts/public-viewer.css");
    assert.equal(mapping.resolutionAuthority, "CONSUMER");
    assert.deepEqual(mapping.modes, ["default", "obsidian"]);
  }
});

test("every neutral mapping is backed by consumed owner tokens in both measured palettes", () => {
  const shared = grammar.surfaces.shared_2d;
  const obsidian = shared.theme_overrides['body[data-map-style="obsidian"]'];
  const consumed = new Set(shared.observed_consumed_roles);
  const unconsumed = new Set(shared.observed_unconsumed_roles);

  for (const mapping of manifest.mappings) {
    const token = mapping.consumerToken;
    assert.ok(Object.hasOwn(shared.root_roles, token), `${token} missing from default owner grammar`);
    assert.ok(Object.hasOwn(obsidian, token), `${token} missing from Obsidian owner grammar`);
    assert.ok(consumed.has(token), `${token} is not measured as consumed`);
    assert.equal(unconsumed.has(token), false, `${token} is measured as unconsumed`);
  }
});

test("domain-specific and Three.js tokens do not silently become neutral mapping authority", () => {
  const mappedTokens = manifest.mappings.map((mapping) => mapping.consumerToken);
  const excludedSharedTokens = [
    "--owner",
    "--group",
    "--original",
    "--fork",
    "--archived",
    "--relation",
    "--shadow"
  ];

  for (const token of excludedSharedTokens) {
    assert.equal(mappedTokens.includes(token), false, `${token} must remain consumer-specific`);
  }
  assert.equal(mappedTokens.some((token) => token.startsWith("--three-")), false);

  const accentRoles = manifest.mappings
    .filter((mapping) => mapping.consumerToken === "--accent")
    .map((mapping) => mapping.role);
  assert.deepEqual(sorted(accentRoles), ["color.border.focus", "color.selection.selected"]);

  const nonProofs = new Set(manifest.doesNotProve);
  for (const boundary of [
    "resolved visual values",
    "final visual identity",
    "accessibility acceptance",
    "browser acceptance",
    "theme acceptance",
    "repository-wide token migration",
    "Three.js semantic token authority",
    "universal reusable concrete token values"
  ]) {
    assert.ok(nonProofs.has(boundary), `missing doesNotProve boundary: ${boundary}`);
  }
});
