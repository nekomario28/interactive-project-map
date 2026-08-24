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
  assert.equal(PUBLIC_ACTION_REF, "20958a9f57f9c995ace23b9561ea5c9080c15bd5");

  const dir = await mkdtemp(join(tmpdir(), "project-map-galaxy-family-"));
  try {
    await buildPublicPages(dir);
    await postprocessPublicPages(dir);

    const sharedHtml = await readFile(join(dir, "u", "index.html"), "utf8");
    const commonPath = join(dir, "galaxy-common.js");
    const classicPath = join(dir, "galaxy-classic-runtime.js");
    const systemsPath = join(dir, "galaxy-systems-runtime.js");
    const hybridPath = join(dir, "galaxy-hybrid-runtime.js");
    const spatialCorePath = join(dir, "spatial-core-runtime.js");
    const edgePath = join(dir, "galaxy-edge-policy.js");
    const obsidianPath = join(dir, "obsidian-runtime.js");
    const polishPath = join(dir, "interaction-polish.js");
    const classic = await readFile(classicPath, "utf8");
    const systems = await readFile(systemsPath, "utf8");
    const hybrid = await readFile(hybridPath, "utf8");
    const spatialCore = await readFile(spatialCorePath, "utf8");
    const edgePolicy = await readFile(edgePath, "utf8");
    const obsidian = await readFile(obsidianPath, "utf8");
    const polish = await readFile(polishPath, "utf8");

    assert.match(sharedHtml, /galaxy-common\.js[\s\S]*galaxy-classic-runtime\.js[\s\S]*galaxy-systems-runtime\.js[\s\S]*galaxy-hybrid-runtime\.js[\s\S]*spatial-core-runtime\.js[\s\S]*obsidian-runtime\.js[\s\S]*galaxy-edge-policy\.js[\s\S]*interaction-polish\.js/);
    assert.doesNotMatch(sharedHtml, /shared-runtime\.js/);
    for (const route of dedicatedRoutes) {
      const html = await readFile(join(dir, route, "index.html"), "utf8");
      assert.match(html, new RegExp(`${route}-viewer\\.js[\\s\\S]*spatial-core-runtime\\.js[\\s\\S]*interaction-polish\\.js`));
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

    assert.match(spatialCore, /window\.ProjectMapSpatialCore/);
    assert.match(spatialCore, /center":0\.0026/);
    assert.match(spatialCore, /repel":9200/);
    assert.match(spatialCore, /linkDistance":138/);
    assert.match(spatialCore, /function normalizeWeightedEdges/);
    assert.match(spatialCore, /function linkForceEdges/);
    assert.match(spatialCore, /function stepForceLayout/);

    assert.match(edgePolicy, /if \(!focus\) return relation \? \(state\.style === "galaxy-hybrid" \? 0\.12 : 0\.16\) : 0;/);
    assert.match(edgePolicy, /focusMembership/);
    assert.match(edgePolicy, /categoryOwnership/);
    assert.match(edgePolicy, /function systemsLabelMode\(\)/);
    assert.match(edgePolicy, /const firstOrbitRadiusPx = 58 \* state\.zoom;/);
    assert.match(edgePolicy, /firstOrbitRadiusPx < 72/);
    assert.match(edgePolicy, /firstOrbitRadiusPx < 112/);
    assert.match(edgePolicy, /repositories\.slice\(0, 2\)/);
    assert.match(edgePolicy, /state\.query && matchesQuery\(node\)/);
    assert.match(edgePolicy, /window\.GalaxySystemsLabelLOD/);

    assert.match(obsidian, /ProjectMapSpatialCore\.DEFAULT_FORCE_SETTINGS/);
    assert.match(obsidian, /ProjectMapSpatialCore\.linkForceEdges/);
    assert.match(obsidian, /ProjectMapSpatialCore\.stepForceLayout/);
    assert.doesNotMatch(obsidian, /center: 0\.0026|repel: 9200|for \(let first = 0; first < nodes\.length/);
    assert.match(obsidian, /const SPAWN_ALPHA = 0\.6;/);
    assert.match(obsidian, /const REDUCED_MOTION_SETTLE_STEPS = 120;/);
    assert.match(obsidian, /function reducedMotionRequested/);
    assert.match(obsidian, /prefers-reduced-motion: reduce/);
    assert.match(obsidian, /function compactSpawnPoint/);
    assert.match(obsidian, /60 \* Math\.sqrt\(safeCount\)/);
    assert.match(obsidian, /buildObsidianLayout = function liveObsidianForceSpawn/);
    assert.match(obsidian, /stepIndex < REDUCED_MOTION_SETTLE_STEPS/);
    assert.match(obsidian, /runtime\.pendingSpawnAlpha = 0/);
    assert.match(obsidian, /runtime\.pendingSpawnAlpha = SPAWN_ALPHA/);
    assert.match(obsidian, /window\.ProjectMapObsidianRuntime/);
    assert.match(obsidian, /reheat\(0\.55\)/);
    assert.doesNotMatch(obsidian, /SPAWN_WARMUP_STEPS|stepIndex < 120/);
    assert.doesNotMatch(obsidian, /baseHitTest|obsidianSettlingHitTest/);
    assert.doesNotMatch(obsidian, /anchorX|anchorY|nodeActivity|neighborhoodLevels|releaseAnchor/);

    assert.match(polish, /readableRadialRepoLabels/);
    assert.match(polish, /blankPointers/);
    assert.match(polish, /isGalaxyPresentationStyle/);
    assert.match(polish, /String\(value \|\| ""\)\.startsWith\("galaxy-"\)/);
    assert.match(polish, /currentSearchContext/);
    assert.match(polish, /directRepositoryIds/);
    assert.match(polish, /directCategoryIds/);
    assert.match(polish, /contextCategoryIds/);
    assert.match(polish, /categoryMemberIds/);
    assert.match(polish, /searchAwareMatchesQuery/);
    assert.match(polish, /searchAwareMatches/);
    assert.match(polish, /searchAwareNodeOpacity/);
    assert.match(polish, /ProjectMapSearchContext/);
    assert.match(polish, /category-context/);
    assert.match(polish, /category-member/);
    assert.match(polish, /semanticAwareSanitizeGraph/);
    assert.match(polish, /ProjectMapSpatialCore/);
    assert.match(polish, /normalizeWeightedEdges/);
    assert.doesNotMatch(polish, /const deduped = new Map\(\)/);
    assert.match(polish, /semanticAwareObsidianLayout/);
    assert.match(polish, /semanticAwareRebuildLayout/);
    assert.match(polish, /installSemanticDrawLayer/);
    assert.match(polish, /semanticAwareDrawEdges/);
    assert.match(polish, /ProjectMapSemanticEdges/);
    assert.match(polish, /DOMCont(?:entLoaded|entLoaded)/);
    assert.match(polish, /state\.edges = \[\.\.\.state\.graph\.edges, \.\.\.state\.graph\.semanticEdges\]/);
    assert.doesNotMatch(polish, /releaseAnchor|duration: 520/);

    for (const path of [commonPath, classicPath, systemsPath, hybridPath, spatialCorePath, edgePath, obsidianPath, polishPath]) {
      const checked = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
      assert.equal(checked.status, 0, `${path} failed syntax check:\n${checked.stderr}`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});