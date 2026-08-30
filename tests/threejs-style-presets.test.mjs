import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { patchThreejsStyleRuntime } from "../scripts/apply-threejs-style-presets.mjs";

const fixture = `
const TAU = Math.PI * 2;
function createSceneRuntime(THREE,graph,username){
const scene=new THREE.Scene();scene.background=new THREE.Color(0x02040b);scene.fog=new THREE.FogExp2(0x030610,.00225);
const root=new THREE.Group();scene.add(root);scene.add(new THREE.HemisphereLight(0x91aaff,0x080510,1.35));const centerLight=new THREE.PointLight(0x8fb8ff,680,520,1.7);centerLight.position.set(0,18,0);scene.add(centerLight);const rimLight=new THREE.PointLight(0xb36cff,340,480,2);rimLight.position.set(-120,80,120);scene.add(rimLight);
scene.add(farStars,midStars,nearStars,dust);
const nebulae=[];[218,258,302,188].forEach((hue,index)=>{const material=new THREE.SpriteMaterial({map:makeNebulaTexture(THREE,hue),transparent:true,opacity:.64-index*.08,depthWrite:false,blending:THREE.AdditiveBlending})
const material=new THREE.MeshStandardMaterial({metalness:node.type==="repository"?.12:.28,transparent:node.archived===true});
}
document.title=\`${"${username}"} · Three.js Cosmic Lab\`;
window.ProjectMapThreejsLab=Object.freeze({snapshot:()=>({renderer:"threejs-cosmic",experimental:true})});
`;

test("Three.js style patch adds three bounded scene themes without changing geometry contracts", () => {
  const patched = patchThreejsStyleRuntime(fixture);
  assert.match(patched, /THREE_STYLE_IDS=new Set\(\["cosmic","aurora","wireframe"\]\)/);
  assert.match(patched, /const threeStyle=currentThreeStyle\(\),threeTheme=THREE_STYLE_THEMES\[threeStyle\]/);
  assert.match(patched, /scene\.background=new THREE\.Color\(threeTheme\.background\)/);
  assert.match(patched, /new THREE\.HemisphereLight\(threeTheme\.hemiSky/);
  assert.match(patched, /threeTheme\.nebulaHues\.forEach/);
  assert.match(patched, /dust\.visible=threeStyle!=="wireframe"/);
  assert.match(patched, /wireframe:threeStyle==="wireframe"/);
  assert.match(patched, /renderer:`threejs-\$\{currentThreeStyle\(\)\}`,style:currentThreeStyle\(\)/);
  assert.match(patched, /threeStyleLabel\(currentThreeStyle\(\)\)/);
  assert.equal(patchThreejsStyleRuntime(patched), patched);
});

test("Three.js style preset patch source passes Node syntax check", () => {
  const result = spawnSync(process.execPath, ["--check", "scripts/apply-threejs-style-presets.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
});
