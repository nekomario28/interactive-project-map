import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildThreejsLab } from "../scripts/build-threejs-lab.mjs";
import {
  composeThreejsGalaxyCentralMorphologyRuntime,
  THREEJS_GALAXY_CENTRAL_MORPHOLOGY_HELPERS,
  THREEJS_GALAXY_CENTRAL_MORPHOLOGY_SCENE,
} from "../scripts/public-threejs-galaxy-central-morphology.mjs";

const fixture = `
const TAU=Math.PI*2;
function hashUnit(){return .5;}
function createSceneRuntime(THREE,graph,username){
const glowTexture={};
scene.add(farStars,midStars,nearStars,dust);
}
`;

test("canonical Three.js Galaxy central morphology composition is safe and idempotent", () => {
  const composed = composeThreejsGalaxyCentralMorphologyRuntime(fixture);
  assert.match(composed, /function softenGalaxyCentralDust\(dust\)/);
  assert.match(composed, /fadeStart=30,fadeEnd=64/);
  assert.match(composed, /Math\.hypot\(position\.getX\(index\),position\.getZ\(index\)\)/);
  assert.match(composed, /color\.needsUpdate=true/);
  assert.match(composed, /function createGalaxyCentralBulge\(THREE,seed,glowTexture\)/);
  assert.match(composed, /count=innerWidth<720\?48:96,clearRadius=14,outerRadius=44/);
  assert.match(composed, /radius=clearRadius\+\(outerRadius-clearRadius\)\*Math\.pow\(hashUnit\(seed\+":bulge:radius:"\+index\),1\.2\)/);
  assert.match(composed, /size:innerWidth<720\?\.9:1\.08/);
  assert.match(composed, /group\.userData\.decorative=true/);
  assert.match(composed, /group\.userData\.semantic=false/);
  assert.match(composed, /const galaxyCentralMorphology=document\.body\.dataset\.mapStyle==="threejs-galaxy"/);
  assert.match(composed, /if\(galaxyCentralMorphology\)softenGalaxyCentralDust\(dust\)/);
  assert.match(composed, /const galaxyBulge=galaxyCentralMorphology\?createGalaxyCentralBulge/);
  assert.match(composed, /document\.body\.dataset\.galaxyCentralStructure="bulge"/);
  assert.equal(composeThreejsGalaxyCentralMorphologyRuntime(composed), composed);
  assert.ok(THREEJS_GALAXY_CENTRAL_MORPHOLOGY_HELPERS.length > 0);
  assert.ok(THREEJS_GALAXY_CENTRAL_MORPHOLOGY_SCENE.length > 0);
});

test("Three.js builder owns the qualified Galaxy central morphology before post-build stages", async () => {
  const root = await mkdtemp(join(tmpdir(), "threejs-galaxy-central-morphology-"));
  try {
    await buildThreejsLab({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    const runtime = await readFile(join(root, "threejs-viewer.js"), "utf8");
    assert.match(runtime, /function softenGalaxyCentralDust\(dust\)/);
    assert.match(runtime, /function createGalaxyCentralBulge\(THREE,seed,glowTexture\)/);
    assert.match(runtime, /const galaxyCentralMorphology=document\.body\.dataset\.mapStyle==="threejs-galaxy"/);
    assert.match(runtime, /document\.body\.dataset\.galaxyCentralStructure="bulge"/);
    assert.doesNotMatch(runtime, /function createGalaxyDiscHaze\(/);
    assert.doesNotMatch(runtime, /discHazePatternFrame:/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
