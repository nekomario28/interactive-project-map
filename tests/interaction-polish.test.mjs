import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildPublicPages } from "../scripts/build-public-pages.mjs";
import { PUBLIC_ACTION_REF, postprocessPublicPages } from "../scripts/postprocess-public-pages.mjs";

const dedicatedRoutes = ["radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"];

test("three Galaxy runtimes and Obsidian stay isolated while interaction polish reaches every preset", async () => {
  assert.equal(PUBLIC_ACTION_REF, "417b1b8d47de6b038441557d9dce2d2ec1f843b9");

  const dir = await mkdtemp(join(tmpdir(), "project-map-galaxy-family-"));
  try {
    await buildPublicPages(dir);
    await postprocessPublicPages(dir);

    const sharedHtml = await readFile(join(dir, "u", "index.html"), "utf8");
    const commonPath = join(dir, "galaxy-common.js");
    const classicPath = join(dir, "galaxy-classic-runtime.js");
    const systemsPath = join(dir, "galaxy-systems-runtime.js");
    const hybridPath = join(dir, "galaxy-hybrid-runtime.js");
    const edgePath = join(dir, "galaxy-edge-policy.js");
    const obsidianPath = join(dir, "obsidian-runtime.js");
    const polishPath = join(dir, "interaction-polish.js");
    const classic = await readFile(classicPath, "utf8");
    const systems = await readFile(systemsPath, "utf8");
    const hybrid = await readFile(hybridPath, "utf8");
    const edgePolicy = await readFile(edgePath, "utf8");
    const obsidian = await readFile(obsidianPath, "utf8");
    const polish = await readFile(polishPath, "utf8");

    assert.match(sharedHtml, /galaxy-common\.js[\s\S]*galaxy-classic-runtime\.js[\s\S]*galaxy-systems-runtime\.js[\s\S]*galaxy-hybrid-runtime\.js[\s\S]*obsidian-runtime\.js[\s\S]*galaxy-edge-policy\.js[\s\S]*interaction-polish\.js/);
    assert.doesNotMatch(sharedHtml, /shared-runtime\.js/);
    for (const route of dedicatedRoutes) {
      const html = await readFile(join(dir, route, "index.html"), "utf8");
      assert.match(html, new RegExp(`${route}-viewer\\.js[\\s\\S]*interaction-polish\\.js`));
    }

    assert.match(classic, /state\.style !== "galaxy-classic"/);
    assert.match(classic, /Living Galaxy/);
    assert.match(classic, /angularSpeedForRadius/);
    assert.doesNotMatch(classic, /360 \+ lane \* 180|1800 \* 1000/);

    assert.match(systems, /state\.style !== "galaxy-systems"/);
    assert.match(systems, /const period = 360 \+ lane \* 180;/);
    assert.match(systems, /1800 \* 1000/);
    assert.match(systems, /orbit-direction/);
    assert.doesNotMatch(systems, /const period = 128 \+ lane \* 54;/);

    assert.match(hybrid, /state\.style !== "galaxy-hybrid"/);
    assert.match(hybrid, /2400 \* 1000/);
    assert.match(hybrid, /480 \+ lane \* 240/);
    assert.match(hybrid, /semiMinor = semiMajor \* 0\.68/);

    assert.match(edgePolicy, /if \(!focus\) return relation \? \(state\.style === "galaxy-hybrid" \? 0\.12 : 0\.16\) : 0;/);
    assert.match(edgePolicy, /focusMembership/);
    assert.match(edgePolicy, /categoryOwnership/);
    assert.match(edgePolicy, /function systemsLabelMode\(\)/);
    assert.match(edgePolicy, /const firstOrbitRadiusPx = 54 \* state\.zoom;/);
    assert.match(edgePolicy, /firstOrbitRadiusPx < 42/);
    assert.match(edgePolicy, /firstOrbitRadiusPx < 68/);
    assert.match(edgePolicy, /repositories\.slice\(0, 2\)/);
    assert.match(edgePolicy, /state\.query && matchesQuery\(node\)/);
    assert.match(edgePolicy, /window\.GalaxySystemsLabelLOD/);
    assert.match(edgePolicy, /zoom in to reveal repositories/);

    assert.match(obsidian, /center: 0\.0026/);
    assert.match(obsidian, /repel: 9200/);
    assert.match(obsidian, /link: 0\.022/);
    assert.match(obsidian, /linkDistance: 138/);
    assert.match(obsidian, /damping: 0\.855/);
    assert.match(obsidian, /buildObsidianLayout = function originalObsidianForceLayout/);
    assert.match(obsidian, /reheat\(0\.55\)/);
    assert.doesNotMatch(obsidian, /anchorX|anchorY|nodeActivity|neighborhoodLevels|releaseAnchor/);

    assert.match(polish, /readableRadialRepoLabels/);
    assert.match(polish, /blankPointers/);
    assert.match(polish, /isGalaxyPresentationStyle/);
    assert.match(polish, /String\(value \|\| ""\)\.startsWith\("galaxy-"\)/);
    assert.doesNotMatch(polish, /releaseAnchor|duration: 520/);

    for (const path of [commonPath, classicPath, systemsPath, hybridPath, edgePath, obsidianPath, polishPath]) {
      const checked = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
      assert.equal(checked.status, 0, `${path} failed syntax check:\n${checked.stderr}`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
