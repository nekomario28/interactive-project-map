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

test("Galaxy central-bulge patch adds a non-semantic warm stellar concentration only to Galaxy", () => {
  const patched = patchThreejsGalaxyCentralBulgeRuntime(fixture);
  assert.match(patched, /function createGalaxyCentralBulge\(THREE,seed,glowTexture\)/);
  assert.match(patched, /count=innerWidth<720\?180:360/);
  assert.match(patched, /radius=44\*Math\.pow\(hashUnit\(seed\+":bulge:radius:"\+index\),1\.9\)/);
  assert.match(patched, /vertical\*radius\*\.72/);
  assert.match(patched, /color:0xffd8aa/);
  assert.match(patched, /color:0xffcf91/);
  assert.match(patched, /group\.name="galaxy-central-bulge"/);
  assert.match(patched, /group\.userData\.decorative=true/);
  assert.match(patched, /group\.userData\.semantic=false/);
  assert.match(patched, /threeStyle==="galaxy"\?createGalaxyCentralBulge/);
  assert.match(patched, /document\.body\.dataset\.galaxyCentralStructure="bulge"/);
  assert.equal(patchThreejsGalaxyCentralBulgeRuntime(patched), patched);
});

test("Galaxy central-bulge postprocessor source passes Node syntax check", () => {
  const result = spawnSync(process.execPath, ["--check", "scripts/apply-threejs-galaxy-central-bulge.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
});
