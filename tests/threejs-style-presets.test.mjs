import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { patchThreejsStylePage, patchThreejsStyleRuntime } from "../scripts/apply-threejs-style-presets.mjs";

const fixture = `
const TAU = Math.PI * 2;
const ui = {
  quality: document.getElementById("renderDensityToggle"),
  motion: document.getElementById("motionToggle"),
};
function createSceneRuntime(THREE,graph,username){
let hoveredMesh=null,selectedMesh=null,quality=(["auto","high","low"].includes(new URL(location.href).searchParams.get("render"))?new URL(location.href).searchParams.get("render"):"auto"),motionEnabled=true;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x02040b);scene.fog=new THREE.FogExp2(0x030610,.00225);
const root=new THREE.Group();scene.add(root);scene.add(new THREE.HemisphereLight(0x91aaff,0x080510,1.35));const centerLight=new THREE.PointLight(0x8fb8ff,680,520,1.7);centerLight.position.set(0,18,0);scene.add(centerLight);const rimLight=new THREE.PointLight(0xb36cff,340,480,2);rimLight.position.set(-120,80,120);scene.add(rimLight);
scene.add(farStars,midStars,nearStars,dust);
const nebulae=[];[218,258,302,188].forEach((hue,index)=>{const material=new THREE.SpriteMaterial({map:makeNebulaTexture(THREE,hue),transparent:true,opacity:.64-index*.08,depthWrite:false,blending:THREE.AdditiveBlending})
const material=new THREE.MeshStandardMaterial({metalness:node.type==="repository"?.12:.28,transparent:node.archived===true});
function resize(){const rect=ui.canvas.getBoundingClientRect(),width=Math.max(1,rect.width),height=Math.max(1,rect.height);camera.aspect=width/height;camera.updateProjectionMatrix();const mobile=width<720,autoRatio=mobile?1:Math.min(devicePixelRatio||1,1.45),ratio=quality==="high"?Math.min(devicePixelRatio||1,mobile?1.25:1.8):quality==="low"?.85:autoRatio;renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);}
function setQuality(next){quality=next;ui.quality.dataset.renderDensity=next;ui.quality.textContent=\`Render ${"${next[0].toUpperCase()}"}${"${next.slice(1)}"}\`;const url=new URL(location.href);if(next==="auto")url.searchParams.delete("render");else url.searchParams.set("render",next);history.replaceState(null,"",url);resize();}
ui.quality.addEventListener("click",()=>setQuality(quality==="auto"?"high":quality==="high"?"low":"auto"));
rebuildEdges();applyVisibility();fitScene(true);setQuality(quality);ui.motion.setAttribute("aria-pressed",String(motionEnabled));
}
document.title=\`${"${username}"} · Three.js Cosmic Lab\`;
window.ProjectMapThreejsLab=Object.freeze({snapshot:()=>({renderer:"threejs-cosmic",experimental:true})});
`;

const pageFixture = `<div class="controls"><button id="renderDensityToggle" type="button" data-render-density="auto" title="Adjust WebGL backing-store density without changing repository Quality evidence.">Render Auto</button>\n      <button id="fit">Fit</button></div>`;

test("Three.js style patch keeps three scene themes and removes the user quality switch", () => {
  const patched = patchThreejsStyleRuntime(fixture);
  assert.match(patched, /THREE_STYLE_IDS=new Set\(\["cosmic","aurora","wireframe"\]\)/);
  assert.match(patched, /const threeStyle=currentThreeStyle\(\),threeTheme=THREE_STYLE_THEMES\[threeStyle\]/);
  assert.match(patched, /canonicalUrl\.searchParams\.delete\("render"\)/);
  assert.match(patched, /scene\.background=new THREE\.Color\(threeTheme\.background\)/);
  assert.match(patched, /new THREE\.HemisphereLight\(threeTheme\.hemiSky/);
  assert.match(patched, /threeTheme\.nebulaHues\.forEach/);
  assert.match(patched, /dust\.visible=threeStyle!=="wireframe"/);
  assert.match(patched, /wireframe:threeStyle==="wireframe"/);
  assert.match(patched, /renderer:`threejs-\$\{currentThreeStyle\(\)\}`,style:currentThreeStyle\(\)/);
  assert.match(patched, /threeStyleLabel\(currentThreeStyle\(\)\)/);
  assert.doesNotMatch(patched, /renderDensityToggle/);
  assert.doesNotMatch(patched, /quality==="high"/);
  assert.doesNotMatch(patched, /setQuality/);
  assert.match(patched, /const mobile=width<720,ratio=mobile\?1:Math\.min\(devicePixelRatio\|\|1,1\.45\)/);
  assert.equal(patchThreejsStyleRuntime(patched), patched);
});

test("Three.js page removes the render-density button", () => {
  const patched = patchThreejsStylePage(pageFixture);
  assert.doesNotMatch(patched, /renderDensityToggle|Render Auto/);
  assert.match(patched, /id="fit"/);
  assert.equal(patchThreejsStylePage(patched), patched);
});

test("Three.js style preset patch source passes Node syntax check", () => {
  const result = spawnSync(process.execPath, ["--check", "scripts/apply-threejs-style-presets.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
});
