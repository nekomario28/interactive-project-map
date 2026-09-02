import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { patchThreejsGalaxyCentralBulgeRuntime } from "../scripts/apply-threejs-galaxy-central-bulge.mjs";

const fixture = `
const TAU=Math.PI*2;
function hashUnit(value){return .5;}
function createSceneRuntime(THREE,graph,username){
const threeStyle="galaxy",glowTexture={};
scene.add(farStars,midStars,nearStars,dust);dust.visible=threeStyle!=="wireframe";if(threeStyle==="galaxy"){dust.scale.setScalar(1.08);dust.material.opacity=.44;}
}
`;

test("Galaxy center becomes glow-dominant while preserving spiral-dust geometry", () => {
  const patched = patchThreejsGalaxyCentralBulgeRuntime(fixture);
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

test("Galaxy central-bulge postprocessor source passes Node syntax check", () => {
  const result = spawnSync(process.execPath, ["--check", "scripts/apply-threejs-galaxy-central-bulge.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
});
