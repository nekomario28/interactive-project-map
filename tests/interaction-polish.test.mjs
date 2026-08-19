import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildPublicPages } from "../scripts/build-public-pages.mjs";
import { postprocessPublicPages } from "../scripts/postprocess-public-pages.mjs";

test("interaction polish and dedicated Obsidian runtime are emitted in order", async () => {
  const dir = await mkdtemp(join(tmpdir(), "project-map-polish-"));
  try {
    await buildPublicPages(dir);
    await postprocessPublicPages(dir);

    const sharedHtml = await readFile(join(dir, "u", "index.html"), "utf8");
    const sunburstHtml = await readFile(join(dir, "sunburst", "index.html"), "utf8");
    const sharedRuntimePath = join(dir, "shared-runtime.js");
    const obsidianPath = join(dir, "obsidian-runtime.js");
    const polishPath = join(dir, "interaction-polish.js");
    const sharedRuntime = await readFile(sharedRuntimePath, "utf8");
    const obsidian = await readFile(obsidianPath, "utf8");
    const polish = await readFile(polishPath, "utf8");

    assert.match(sharedHtml, /shared-runtime\.js[\s\S]*obsidian-runtime\.js[\s\S]*interaction-polish\.js/);
    assert.match(sunburstHtml, /sunburst-viewer\.js[\s\S]*interaction-polish\.js/);
    assert.match(sharedRuntime, /Dedicated obsidian-runtime\.js owns Obsidian physics/);
    assert.doesNotMatch(sharedRuntime, /changed = stepObsidian\(\);/);

    assert.match(obsidian, /center: 0\.0026/);
    assert.match(obsidian, /repel: 9200/);
    assert.match(obsidian, /link: 0\.022/);
    assert.match(obsidian, /linkDistance: 138/);
    assert.match(obsidian, /damping: 0\.855/);
    assert.match(obsidian, /buildObsidianLayout = function originalObsidianForceLayout/);
    assert.match(obsidian, /reheat\(0\.55\)/);
    assert.doesNotMatch(obsidian, /anchorX|anchorY|nodeActivity|neighborhoodLevels|releaseAnchor/);

    assert.match(polish, /readableRadialRepoLabels/);
    assert.match(polish, /state\.style !== "galaxy"/);
    assert.match(polish, /if \(!state\.moved && !state\.drag\) updateDetails\(null\);/);
    assert.doesNotMatch(polish, /releaseAnchor|duration: 520/);

    for (const path of [obsidianPath, polishPath]) {
      const checked = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
      assert.equal(checked.status, 0, `${path} failed syntax check:\n${checked.stderr}`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
