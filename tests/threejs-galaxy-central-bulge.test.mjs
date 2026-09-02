import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { patchThreejsGalaxyCentralBulgeRuntime } from "../scripts/apply-threejs-galaxy-central-bulge.mjs";

const fixture = `
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

test("Galaxy arm-aware haze matches scaled dust spatial phase and stays pattern-locked", () => {
  const patched = patchThreejsGalaxyCentralBulgeRuntime(fixture);
  assert.match(patched, /function galaxyDiscSmooth\(value\)/);
  assert.match(patched, /function galaxyDiscNoise\(seed,x,y\)/);
  assert.match(patched, /function createGalaxyDiscHaze\(THREE,seed,armCount=4,pitch=0,referenceRadius=42\)/);
  assert.match(patched, /size=128,canvas=document\.createElement\("canvas"\)/);
  assert.match(patched, /galaxyDiscSmooth\(\(radius-\.12\)\/\.1\)/);
  assert.match(patched, /galaxyDiscSmooth\(\(radius-\.72\)\/\.26\)/);
  assert.match(patched, /coarse=galaxyDiscNoise\(seed,u\*4\.4,v\*4\.4\)/);
  assert.match(patched, /fine=galaxyDiscNoise\(seed\+":fine",u\*8\.2,v\*8\.2\)/);
  assert.match(patched, /angle=Math\.atan2\(-nz,nx\)/);
  assert.match(patched, /visualRadius=radius\*312/);
  assert.match(patched, /spiral=pitch>0\?Math\.log\(Math\.max\(1,visualRadius\/referenceRadius\)\)\/Math\.tan\(pitch\):0/);
  assert.doesNotMatch(patched, /visualRadius\/42/);
  assert.match(patched, /armWave=\.5\+\.5\*Math\.cos\(\(angle-spiral\)\*armCount\)/);
  assert.match(patched, /armMod=\.79\+\.56\*armWave\*armWave/);
  assert.match(patched, /\(\.38\+\.62\*cloud\)\*armMod/);
  assert.match(patched, /new THREE\.CanvasTexture\(canvas\)/);
  assert.match(patched, /new THREE\.CircleGeometry\(312,96\)/);
  assert.match(patched, /opacity:\.46/);
  assert.match(patched, /mesh\.rotation\.x=-Math\.PI\/2/);
  assert.match(patched, /mesh\.position\.y=-6/);
  assert.match(patched, /mesh\.raycast=\(\)=>\{\}/);
  assert.match(patched, /mesh\.userData\.decorative=true/);
  assert.match(patched, /mesh\.userData\.semantic=false/);
  assert.match(patched, /textureModel="procedural-low-frequency-log-arm-haze"/);
  assert.match(patched, /mesh\.userData\.armCount=armCount/);
  assert.match(patched, /mesh\.userData\.pitchAngleDeg=pitch\*180\/Math\.PI/);
  assert.match(patched, /mesh\.userData\.referenceRadius=referenceRadius/);
  assert.match(patched, /createGalaxyDiscHaze\(THREE,username,galaxyArmCount\(graph\),GALAXY_LOG_PITCH,42\*dust\.scale\.x\)/);
  assert.match(patched, /document\.body\.dataset\.galaxyDiscTexture="procedural-haze-v2"/);
  assert.doesNotMatch(patched, /document\.body\.dataset\.galaxyDiscTexture="procedural-haze-v1"/);

  assert.match(patched, /const galaxyPatternDelta=delta\*\(threeStyle==="galaxy"\?TAU\/GALAXY_PATTERN_PERIOD:\.0035\)/);
  assert.match(patched, /dust\.rotation\.y\+=galaxyPatternDelta/);
  assert.match(patched, /if\(threeStyle==="galaxy"&&galaxyDiscHaze\)galaxyDiscHaze\.rotation\.z\+=galaxyPatternDelta/);
  assert.match(patched, /discHazePatternFrame:galaxyDiscHaze\?"co-rotating-arm-pattern":"none"/);
  assert.match(patched, /dustPatternRotationY:dust\.rotation\.y/);
  assert.match(patched, /hazePatternRotationY:galaxyDiscHaze\?galaxyDiscHaze\.rotation\.z:null/);
  assert.match(patched, /dustPatternReferenceRadius:42\*dust\.scale\.x/);
  assert.match(patched, /hazePatternReferenceRadius:galaxyDiscHaze\?galaxyDiscHaze\.userData\.referenceRadius:null/);

  assert.match(patched, /function softenGalaxyCentralDust\(dust\)/);
  assert.match(patched, /fadeStart=30,fadeEnd=64/);
  assert.match(patched, /Math\.hypot\(position\.getX\(index\),position\.getZ\(index\)\)/);
  assert.match(patched, /\(radius-fadeStart\)\/\(fadeEnd-fadeStart\)/);
  assert.match(patched, /color\.setXYZ\(index,color\.getX\(index\)\*fade,color\.getY\(index\)\*fade,color\.getZ\(index\)\*fade\)/);
  assert.match(patched, /color\.needsUpdate=true/);
  assert.match(patched, /if\(threeStyle==="galaxy"\)softenGalaxyCentralDust\(dust\)/);
  assert.match(patched, /function createGalaxyCentralBulge\(THREE,seed,glowTexture\)/);
  assert.match(patched, /count=innerWidth<720\?48:96,clearRadius=14,outerRadius=44/);
  assert.match(patched, /radius=clearRadius\+\(outerRadius-clearRadius\)\*Math\.pow\(hashUnit\(seed\+":bulge:radius:"\+index\),1\.2\)/);
  assert.match(patched, /positions\[index\*3\]=Math\.cos\(theta\)\*radius/);
  assert.match(patched, /vertical\*radius\*\.42/);
  assert.match(patched, /size:innerWidth<720\?\.9:1\.08/);
  assert.match(patched, /opacity:\.1/);
  assert.match(patched, /color:0xffd8aa/);
  assert.match(patched, /color:0xffcf91/);
  assert.match(patched, /opacity:\.12/);
  assert.match(patched, /group\.name="galaxy-central-bulge"/);
  assert.match(patched, /group\.userData\.decorative=true/);
  assert.match(patched, /group\.userData\.semantic=false/);
  assert.match(patched, /group\.userData\.particleCount=count/);
  assert.match(patched, /group\.userData\.clearRadius=clearRadius/);
  assert.match(patched, /threeStyle==="galaxy"\?createGalaxyCentralBulge/);
  assert.match(patched, /document\.body\.dataset\.galaxyCentralStructure="bulge"/);
  assert.doesNotMatch(patched, /count=innerWidth<720\?180:360/);
  assert.doesNotMatch(patched, /radius=44\*Math\.pow/);
  assert.equal(patchThreejsGalaxyCentralBulgeRuntime(patched), patched);
});

test("Galaxy central-morphology postprocessor source passes Node syntax check", () => {
  const result = spawnSync(process.execPath, ["--check", "scripts/apply-threejs-galaxy-central-bulge.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
});
