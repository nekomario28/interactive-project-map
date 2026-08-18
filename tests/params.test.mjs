import assert from "node:assert/strict";
import test from "node:test";
import { boolParam, intParam } from "../src/params.ts";

test("integer params use documented defaults when omitted", () => {
  const url = new URL("https://example.test/api/galaxy.svg?username=example");
  assert.equal(intParam(url, "max_repos", 100, 1, 300), 100);
  assert.equal(intParam(url, "width", 740, 420, 1600), 740);
  assert.equal(intParam(url, "height", 420, 260, 1000), 420);
});

test("integer params fall back for empty or invalid values and clamp valid numbers", () => {
  assert.equal(intParam(new URL("https://example.test/?n="), "n", 100, 1, 300), 100);
  assert.equal(intParam(new URL("https://example.test/?n=wat"), "n", 100, 1, 300), 100);
  assert.equal(intParam(new URL("https://example.test/?n=999"), "n", 100, 1, 300), 300);
  assert.equal(intParam(new URL("https://example.test/?n=0"), "n", 100, 1, 300), 1);
  assert.equal(intParam(new URL("https://example.test/?n=42.6"), "n", 100, 1, 300), 43);
});

test("boolean params accept explicit true/false forms and otherwise preserve defaults", () => {
  assert.equal(boolParam(new URL("https://example.test/"), "forks", true), true);
  assert.equal(boolParam(new URL("https://example.test/?forks=false"), "forks", true), false);
  assert.equal(boolParam(new URL("https://example.test/?forks=0"), "forks", true), false);
  assert.equal(boolParam(new URL("https://example.test/?forks=yes"), "forks", false), true);
  assert.equal(boolParam(new URL("https://example.test/?forks=garbage"), "forks", true), true);
  assert.equal(boolParam(new URL("https://example.test/?forks=garbage"), "forks", false), false);
});
