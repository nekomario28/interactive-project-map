import test from "node:test";
import assert from "node:assert/strict";

import { ProjectMapTransferableState } from "../packages/project-map-view-model/src/view-state.js";
import { projectMapViewStateRuntimeSource } from "../scripts/project-map-view-state-runtime.mjs";

test("transferable state parses the shared 2D and 3D URL subset", () => {
  const state = ProjectMapTransferableState.parse("https://example.test/three/?username=Example&q=Rust&status=o,c&motion=off&activity=1&focus=repository%3Aalpha&depth=2&quality=1&render=low");
  assert.deepEqual(state, {
    username: "Example",
    q: "Rust",
    statuses: ["original", "contributed"],
    motionOff: true,
    activity: true,
    focus: "repository:alpha",
    depth: 2,
    quality: true,
  });
});

test("transferable state serializes canonical keys without absorbing renderer-local state", () => {
  const url = ProjectMapTransferableState.applyToUrl(
    "https://example.test/three/?render=low&style=galaxy-systems",
    {
      username: "example",
      q: "rust",
      statuses: ["contributed"],
      motionOff: true,
      activity: true,
      focus: "repository:alpha",
      depth: 3,
      quality: true,
    },
    { availableStatuses: ["original", "contributed"] },
  );
  assert.equal(url.searchParams.get("username"), "example");
  assert.equal(url.searchParams.get("q"), "rust");
  assert.equal(url.searchParams.get("status"), "contributed");
  assert.equal(url.searchParams.get("motion"), "off");
  assert.equal(url.searchParams.get("activity"), "1");
  assert.equal(url.searchParams.get("focus"), "repository:alpha");
  assert.equal(url.searchParams.get("depth"), "3");
  assert.equal(url.searchParams.get("quality"), "1");
  assert.equal(url.searchParams.get("render"), "low");
  assert.equal(url.searchParams.get("style"), "galaxy-systems");
});

test("cross-renderer transfer excludes Three.js render density while preserving repository quality", () => {
  const target = ProjectMapTransferableState.transfer(
    "https://example.test/three/?username=example&q=robot&status=c&motion=off&activity=1&quality=1&render=high",
    "https://example.test/u/",
    {},
    { availableStatuses: ["original", "contributed"] },
  );
  assert.equal(target.searchParams.get("username"), "example");
  assert.equal(target.searchParams.get("q"), "robot");
  assert.equal(target.searchParams.get("status"), "contributed");
  assert.equal(target.searchParams.get("motion"), "off");
  assert.equal(target.searchParams.get("activity"), "1");
  assert.equal(target.searchParams.get("quality"), "1");
  assert.equal(target.searchParams.has("render"), false);
});

test("browser runtime is generated from the same pure state factory", () => {
  const runtime = projectMapViewStateRuntimeSource();
  assert.match(runtime, /window\.ProjectMapTransferableState/);
  assert.match(runtime, /render/);
  assert.doesNotMatch(runtime, /searchParams\.set\("render"/);
});
