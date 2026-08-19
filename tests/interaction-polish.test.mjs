import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildPublicPages } from "../scripts/build-public-pages.mjs";
import { postprocessPublicPages } from "../scripts/postprocess-public-pages.mjs";

test("interaction polish is emitted for shared graph and Sunburst viewers", async () => {
  const dir = await mkdtemp(join(tmpdir(), "project-map-polish-"));
  try {
    await buildPublicPages(dir);
    await postprocessPublicPages(dir);

    const sharedHtml = await readFile(join(dir, "u", "index.html"), "utf8");
    const sunburstHtml = await readFile(join(dir, "sunburst", "index.html"), "utf8");
    const polishPath = join(dir, "interaction-polish.js");
    const polish = await readFile(polishPath, "utf8");

    assert.match(sharedHtml, /shared-runtime\.js[\s\S]*interaction-polish\.js/);
    assert.match(sunburstHtml, /sunburst-viewer\.js[\s\S]*interaction-polish\.js/);
    assert.match(polish, /readableRadialRepoLabels/);
    assert.match(polish, /state\.style !== "galaxy"/);
    assert.match(polish, /releaseAnchor/);
    assert.match(polish, /duration: 520/);

    const checked = spawnSync(process.execPath, ["--check", polishPath], { encoding: "utf8" });
    assert.equal(checked.status, 0, `interaction-polish.js failed syntax check:\n${checked.stderr}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
