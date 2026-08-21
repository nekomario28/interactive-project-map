import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const runtimePath = new URL("../scripts/public-obsidian-runtime.js", import.meta.url);

test("Obsidian text labels use zoom-only continuous fading with interaction exemptions", async () => {
  const source = await readFile(runtimePath, "utf8");
  assert.match(source, /const TEXT_FADE_START_ZOOM = 0\.36;/);
  assert.match(source, /const TEXT_FADE_FULL_ZOOM = 0\.72;/);
  assert.match(source, /const baseDrawNodesAndLabels = drawNodesAndLabels;/);
  assert.match(source, /function directSearchHit\(node\)/);
  assert.match(source, /ProjectMapSearchContext\?\.level\?\.\(node\) === "direct"/);
  assert.match(source, /function repositoryTextFade\(node, highlighted\)/);
  assert.match(source, /progress \* progress \* \(3 - 2 \* progress\)/);
  assert.match(source, /drawNodesAndLabels = function obsidianTextFadeDrawNodesAndLabels/);
  assert.match(source, /candidate\.opacity \* candidate\.labelFade/);
  assert.match(source, /obsidianLabelPriority/);
  assert.match(source, /return repositoryDegree\(node\) \+ 1;/);

  const fadeStart = source.indexOf("function repositoryTextFade");
  const fadeEnd = source.indexOf("function obsidianLabelPriority", fadeStart);
  assert.ok(fadeStart >= 0 && fadeEnd > fadeStart);
  const fadeBody = source.slice(fadeStart, fadeEnd);
  assert.match(fadeBody, /state\.zoom/);
  assert.doesNotMatch(fadeBody, /state\.pan|pointer|velocity|\.vx|\.vy|Date|performance|requestAnimationFrame/);

  assert.doesNotThrow(() => new Function(source));
});
