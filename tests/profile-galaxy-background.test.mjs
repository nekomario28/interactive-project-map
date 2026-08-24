import assert from "node:assert/strict";
import test from "node:test";
import { background, palette } from "../scripts/galaxy-svg-common.mjs";

test("shared static Galaxy background preserves the historical profile-local structure", () => {
  const markup = background("example", 760, 560, palette("dark"), 92, {
    cx: 380,
    cy: 275,
    groupCount: 5,
    categoryRadius: 155,
  });
  assert.match(markup, /data-profile-galaxy-background="ead72debca2a16608ebc5b799993c0234ea10cab"/);
  assert.equal((markup.match(/data-profile-galaxy-ring=/g) || []).length, 3);
  assert.equal((markup.match(/data-profile-galaxy-arm=/g) || []).length, 5);
  assert.equal((markup.match(/data-profile-stellar-association=/g) || []).length, 5);
  assert.equal((markup.match(/profile-star/g) || []).length, 0, "seed keys must not leak into SVG text");
  assert.match(markup, /profile-galaxy-nucleus/);
  assert.match(markup, /profile-galaxy-association/);
  assert.doesNotMatch(markup, /parallax/);
  assert.doesNotMatch(markup, /meteor/i);
});
