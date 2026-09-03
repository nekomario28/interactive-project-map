import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildThreejsLab } from "../scripts/build-threejs-lab.mjs";
import {
  composeThreejsGalaxyDiscHazeRuntime,
  THREEJS_GALAXY_DISC_HAZE_HELPERS,
  THREEJS_GALAXY_DISC_HAZE_SCENE,
} from "../scripts/public-threejs-galaxy-disc-haze.mjs";

const fixture = `
function createSceneRuntime(THREE,graph,username){
const galaxyCentralMorphology=false,glowTexture={};
const galaxyBulge=galaxyCentralMorphology?createGalaxyCentralBulge(THREE,username,glowTexture):null;
}
`;

test("canonical Galaxy disc haze composition is deterministic and idempotent", () => {
  const composed = composeThreejsGalaxyDiscHazeRuntime(fixture);
  assert.match(composed, /function galaxyDiscSmooth\(value\)/);
  assert.match(composed, /function galaxyDiscNoise\(seed,x,y\)/);
  assert.match(composed, /function createGalaxyDiscHaze\(THREE,seed,armCount=4,pitch=0,referenceRadius=42\)/);
  assert.match(composed, /size=128,canvas=document\.createElement\("canvas"\)/);
  assert.match(composed, /galaxyDiscSmooth\(\(radius-\.12\)\/\.1\)/);
  assert.match(composed, /galaxyDiscSmooth\(\(radius-\.72\)\/\.26\)/);
  assert.match(composed, /coarse=galaxyDiscNoise\(seed,u\*4\.4,v\*4\.4\)/);
  assert.match(composed, /fine=galaxyDiscNoise\(seed\+":fine",u\*8\.2,v\*8\.2\)/);
  assert.match(composed, /angle=Math\.atan2\(-nz,nx\)/);
  assert.match(composed, /visualRadius=radius\*312/);
  assert.match(composed, /armMod=\.79\+\.56\*armWave\*armWave/);
  assert.match(composed, /new THREE\.CanvasTexture\(canvas\)/);
  assert.match(composed, /new THREE\.CircleGeometry\(312,96\)/);
  assert.match(composed, /opacity:\.46/);
  assert.match(composed, /mesh\.raycast=\(\)=>\{\}/);
  assert.match(composed, /mesh\.userData\.decorative=true/);
  assert.match(composed, /mesh\.userData\.semantic=false/);
  assert.match(composed, /textureModel="procedural-low-frequency-log-arm-haze"/);
  assert.match(composed, /document\.body\.dataset\.mapStyle==="threejs-galaxy"\?createGalaxyDiscHaze/);
  assert.match(composed, /galaxyArmCount\(graph\),GALAXY_LOG_PITCH,42\*dust\.scale\.x/);
  assert.match(composed, /document\.body\.dataset\.galaxyDiscTexture="procedural-haze-v2"/);
  assert.equal(composeThreejsGalaxyDiscHazeRuntime(composed), composed);
  assert.ok(THREEJS_GALAXY_DISC_HAZE_HELPERS.length > 0);
  assert.ok(THREEJS_GALAXY_DISC_HAZE_SCENE.length > 0);
});

test("Three.js builder owns Galaxy disc haze before motion-pattern coupling", async () => {
  const root = await mkdtemp(join(tmpdir(), "threejs-galaxy-disc-haze-"));
  try {
    await buildThreejsLab({ siteDir: root, sourceDir: join(process.cwd(), "scripts") });
    const runtime = await readFile(join(root, "threejs-viewer.js"), "utf8");
    assert.match(runtime, /function createGalaxyDiscHaze\(THREE,seed,armCount=4,pitch=0,referenceRadius=42\)/);
    assert.match(runtime, /document\.body\.dataset\.mapStyle==="threejs-galaxy"\?createGalaxyDiscHaze/);
    assert.match(runtime, /document\.body\.dataset\.galaxyDiscTexture="procedural-haze-v2"/);
    assert.doesNotMatch(runtime, /const galaxyPatternDelta=/);
    assert.doesNotMatch(runtime, /discHazePatternFrame:/);
    assert.doesNotMatch(runtime, /hazePatternRotationY:/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
