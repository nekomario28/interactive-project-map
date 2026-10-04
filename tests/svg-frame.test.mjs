import assert from "node:assert/strict";
import test from "node:test";
import { actionConfigFromEnv } from "../scripts/action.mjs";
import { galaxyFrame, galaxyGraphBounds } from "../scripts/galaxy-svg-frame.mjs";

test("frame includes nested motion, replaces base translation, and decodes escaped label characters", () => {
  const svg = '<g transform="translate(999 999)"><g transform="translate(888 888)"><circle cx="0" cy="0" r="10"/><animateTransform type="translate" values="-50 -20;50 20"/></g><animateTransform type="translate" values="100 200;300 400"/></g>';
  assert.deepEqual(galaxyGraphBounds(svg), [38, 168, 362, 432]);
  assert.deepEqual(galaxyGraphBounds('<text x="0" y="0" font-size="10">A&amp;B</text>'), [-2, -14, 32, 6]);
});

test("rectangular graph decoration participates in framing", () => {
  assert.deepEqual(galaxyGraphBounds('<rect x="500" y="30" width="190" height="340"/>'), [498, 28, 692, 372]);
});

test("auto height keeps width-fit scale while fixed height fits the complete orbit", () => {
  const markup = '<g><circle cx="0" cy="0" r="10"/><animateTransform type="translate" values="0 -300;0 300"/></g>';
  const auto = galaxyFrame(markup, 740, 420, { height: "auto", padding: 24 });
  assert.equal(auto.height, 698);
  assert.match(auto.markup, /scale\(1\.000000\)/);
  const fixed = galaxyFrame(markup, 740, 420, { height: 420, padding: 24 });
  assert.equal(fixed.height, 420);
  assert.match(fixed.markup, /scale\(0\.554487\)/);
  assert.equal(galaxyFrame(markup, 740, 420, { height: "auto", padding: 32 }).height, 714);
});

test("Action defaults to auto height and accepts fixed height and configurable padding", () => {
  const base = { GITHUB_REPOSITORY_OWNER: "example" };
  for (const value of [undefined, "", "auto", "AUTO"]) {
    assert.equal(actionConfigFromEnv({ ...base, INPUT_HEIGHT: value }).height, "auto");
  }
  assert.equal(actionConfigFromEnv(base).padding, 24);
  const config = actionConfigFromEnv({ ...base, INPUT_HEIGHT: "600", INPUT_PADDING: "32", INPUT_WIDTH: "900" });
  assert.equal(config.height, 600);
  assert.equal(config.padding, 32);
  assert.equal(config.width, 900);
});
