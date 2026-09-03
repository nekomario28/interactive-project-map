import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { composeThreejsGalaxyPatternCouplingRuntime } from "../scripts/public-threejs-galaxy-pattern-coupling.mjs";
import { composeThreejsGalaxyCentralMorphologyRuntime } from "../scripts/public-threejs-galaxy-central-morphology.mjs";

const baseFixture = `
const TAU=Math.PI*2;
const GALAXY_LOG_PITCH=22*Math.PI/180,GALAXY_PATTERN_PERIOD=2400;
function hashUnit(value){return .5;}
function galaxyArmCount(){return 3;}
function createSceneRuntime(THREE,graph,username){
const threeStyle="galaxy",glowTexture={};
scene.add(farStars,midStars,nearStars,dust);dust.visible=threeStyle!=="wireframe";if(threeStyle==="galaxy"){dust.scale.setScalar(1.08);dust.material.opacity=.44;}
const galaxyMotion={snapshot:()=>({})};let edgeLines=null;if(galaxyMotion)window.ProjectMapThreejsGalaxyMotion=Object.freeze({snapshot:()=>({...galaxyMotion.snapshot(),persistentEdgeObjects:edgeLines?1:0})});
function animate(){const delta=.016;if(motionEnabled){dust.rotation.y+=delta*(threeStyle==="galaxy"?TAU/GALAXY_PATTERN_PERIOD:.0035);}}
}
`;
const fixture = composeThreejsGalaxyCentralMorphologyRuntime(baseFixture);

test("canonical Galaxy pattern-coupling composer only adds pattern lock and read-only evidence", () => {
  assert.match(fixture, /function createGalaxyDiscHaze\(THREE,seed,armCount=4,pitch=0,referenceRadius=42\)/);
  assert.match(fixture, /document\.body\.dataset\.mapStyle==="threejs-galaxy"\?createGalaxyDiscHaze/);
  assert.match(fixture, /document\.body\.dataset\.galaxyDiscTexture="procedural-haze-v2"/);

  const patched = composeThreejsGalaxyPatternCouplingRuntime(fixture);
  assert.match(patched, /const galaxyPatternDelta=delta\*\(threeStyle==="galaxy"\?TAU\/GALAXY_PATTERN_PERIOD:\.0035\)/);
  assert.match(patched, /dust\.rotation\.y\+=galaxyPatternDelta/);
  assert.match(patched, /if\(threeStyle==="galaxy"&&galaxyDiscHaze\)galaxyDiscHaze\.rotation\.z\+=galaxyPatternDelta/);
  assert.match(patched, /discHazePatternFrame:galaxyDiscHaze\?"co-rotating-arm-pattern":"none"/);
  assert.match(patched, /dustPatternRotationY:dust\.rotation\.y/);
  assert.match(patched, /hazePatternRotationY:galaxyDiscHaze\?galaxyDiscHaze\.rotation\.z:null/);
  assert.match(patched, /dustPatternReferenceRadius:42\*dust\.scale\.x/);
  assert.match(patched, /hazePatternReferenceRadius:galaxyDiscHaze\?galaxyDiscHaze\.userData\.referenceRadius:null/);
  assert.equal(composeThreejsGalaxyPatternCouplingRuntime(patched), patched);
});

test("Galaxy haze coupling fails closed on stale, missing-canonical and partial runtimes", () => {
  const legacyV1 = fixture.replace(
    "function createSceneRuntime(THREE,graph,username){",
    "function createGalaxyDiscHaze(THREE,seed){return null;}\nfunction createSceneRuntime(THREE,graph,username){",
  );
  const legacyV2 = fixture.replace(
    "function createSceneRuntime(THREE,graph,username){",
    "function createGalaxyDiscHaze(THREE,seed,armCount=4,pitch=0){return null;}\nfunction createSceneRuntime(THREE,graph,username){",
  );
  const fullyPatched = composeThreejsGalaxyPatternCouplingRuntime(fixture);
  const partialCoupling = fullyPatched.replace("discHazePatternFrame:", "discHazePatternFrameMissing:");

  assert.throws(
    () => composeThreejsGalaxyPatternCouplingRuntime(legacyV1),
    /Legacy Galaxy morphology intermediate is unsupported; rebuild from fresh canonical source/,
  );
  assert.throws(
    () => composeThreejsGalaxyPatternCouplingRuntime(legacyV2),
    /Legacy Galaxy morphology intermediate is unsupported; rebuild from fresh canonical source/,
  );
  assert.throws(
    () => composeThreejsGalaxyPatternCouplingRuntime(baseFixture),
    /Canonical Galaxy central morphology or disc haze is missing; rebuild from fresh canonical source/,
  );
  assert.throws(
    () => composeThreejsGalaxyPatternCouplingRuntime(partialCoupling),
    /Partial Galaxy haze pattern-coupling intermediate is unsupported; rebuild from fresh canonical source/,
  );
});

test("post-build Galaxy pattern-coupling stage is only a thin I/O adapter", () => {
  const adapter = readFileSync("scripts/apply-threejs-galaxy-central-bulge.mjs", "utf8");
  assert.match(adapter, /composeThreejsGalaxyPatternCouplingRuntime/);
  assert.match(adapter, /export const patchThreejsGalaxyCentralBulgeRuntime = composeThreejsGalaxyPatternCouplingRuntime/);
  assert.doesNotMatch(adapter, /CURRENT_DISC_TEXTURE_SIGNATURE|GALAXY_PATTERN_ANIMATE_WITH_HAZE|CURRENT_PATTERN_COUPLING_MARKERS/);
  assert.doesNotMatch(adapter, /new THREE\.CanvasTexture|new THREE\.CircleGeometry|count=innerWidth<720\?48:96/);
});

test("Galaxy pattern-coupling canonical composer and adapter pass Node syntax checks", () => {
  for (const path of ["scripts/public-threejs-galaxy-pattern-coupling.mjs", "scripts/apply-threejs-galaxy-central-bulge.mjs"]) {
    const result = spawnSync(process.execPath, ["--check", path], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `${path}: ${result.stderr}`);
  }
});
