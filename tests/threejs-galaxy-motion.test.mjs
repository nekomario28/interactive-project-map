import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { patchThreejsGalaxyMotionRuntime } from "../scripts/apply-threejs-galaxy-motion.mjs";

const fixture = `
function layoutGalaxyGraph(THREE,graph){const count=2,armCount=count<=3?1:count<=8?2:3,angle=-Math.PI/2+arm*TAU/armCount+tier*.62+(hashUnit(group.id+":galaxy-angle")-.5)*.1,radius=baseRadius+tier*tierGap,y=(hashUnit(group.id+":galaxy-y")-.5)*14,thickness=(hashUnit(repo.id+":galaxy-thickness")-.5)*(10+ring*2.6);positions.set(repo.id,new THREE.Vector3(0,(hashUnit(repo.id+":galaxy-loose-y")-.5)*24,0));positions.set(repo.id,new THREE.Vector3(0,(hashUnit(repo.id+":galaxy-external-y")-.5)*34,0));}
function createSpiralDust(THREE,seed){const count=1800,positions=new Float32Array(count*3),colors=new Float32Array(count*3),blue=new THREE.Color(0x6387ff),violet=new THREE.Color(0xa86cff);for(let index=0;index<count;index+=1){const arm=index%4,t=hashUnit(\`${"${seed}"}:dust:t:${"${index}"}\`),radius=42+t*230,jitter=(hashUnit(\`${"${seed}"}:dust:j:${"${index}"}\`)-.5)*30,angle=arm*TAU/4+t*TAU*2.1+jitter*.008;positions[index*3]=Math.cos(angle)*(radius+jitter);}return new THREE.Points();}
function createSceneRuntime(THREE,graph,username){
const threeStyle="galaxy";
const positions=layoutGalaxyGraph(THREE,graph),nodeMeshes=new Map();
dust=createSpiralDust(THREE,username);
let edgeLines=null;const edgeMaterial=new THREE.LineBasicMaterial({color:0x607399,transparent:true,opacity:.25,blending:THREE.AdditiveBlending});
function rebuildEdges(){if(edgeLines){root.remove(edgeLines);edgeLines.geometry.dispose();}const values=[];for(const edge of graph.edges){const source=nodeMeshes.get(edge.source),targetMesh=nodeMeshes.get(edge.target);if(!source||!targetMesh||!source.visible||!targetMesh.visible)continue;values.push(source.position.x,source.position.y,source.position.z,targetMesh.position.x,targetMesh.position.y,targetMesh.position.z);}const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(values,3));edgeLines=new THREE.LineSegments(geometry,edgeMaterial);edgeLines.renderOrder=-1;root.add(edgeLines);}
function animate(now){const delta=.016;if(motionEnabled){farStars.rotation.y+=delta*.002;midStars.rotation.y-=delta*.004;nearStars.rotation.y+=delta*.006;dust.rotation.y+=delta*.0035;nebulae.forEach((sprite,index)=>{sprite.material.rotation+=delta*(index%2?-.004:.003);});}renderer.render(scene,camera);}
}
`;

test("Galaxy motion patch uses a flatter 2-4 arm logarithmic disc, co-rotation, an inertial star backdrop, radial slowdown, and membership-only dynamic edges", () => {
  const patched = patchThreejsGalaxyMotionRuntime(fixture);
  assert.match(patched, /GALAXY_LOG_PITCH_DEG=22/);
  assert.match(patched, /function galaxyLogAngle\(radius,referenceRadius\)/);
  assert.match(patched, /Math\.log\(Math\.max\(1,radius\/referenceRadius\)\)\/Math\.tan\(GALAXY_LOG_PITCH\)/);
  assert.match(patched, /function galaxyArmCount\(graph\)/);
  assert.match(patched, /count<=4\?2:count<=8\?3:4/);
  assert.match(patched, /armCount=count<=4\?2:count<=8\?3:4/);
  assert.match(patched, /radius=baseRadius\+tier\*tierGap,angle=-Math\.PI\/2\+arm\*TAU\/armCount\+galaxyLogAngle\(radius,baseRadius\)/);
  assert.match(patched, /galaxy-y"\)-\.5\)\*6/);
  assert.match(patched, /galaxy-thickness"\)-\.5\)\*\(5\+ring\*1\.4\)/);
  assert.match(patched, /galaxy-loose-y"\)-\.5\)\*10/);
  assert.match(patched, /galaxy-external-y"\)-\.5\)\*14/);
  assert.match(patched, /function createSpiralDust\(THREE,seed,armCount=4,winding=2\.1,pitch=0\)/);
  assert.match(patched, /const arm=index%armCount/);
  assert.match(patched, /pitch>0\?Math\.log\(Math\.max\(1,radius\/42\)\)\/Math\.tan\(pitch\):t\*TAU\*winding/);
  assert.match(patched, /threeStyle==="galaxy"\?galaxyArmCount\(graph\):4/);
  assert.match(patched, /threeStyle==="galaxy"\?GALAXY_LOG_PITCH:0/);
  assert.match(patched, /model:"flat-curve-inspired",direction:"co-rotating",armCount:galaxyArmCount\(graph\),spiralModel:"logarithmic",pitchAngleDeg:GALAXY_LOG_PITCH_DEG,edgePolicy:"membership-only",starfieldFrame:"inertial"/);
  assert.match(patched, /rotationPeriod=\(radius\)=>clamp\(radius\*16,1200,4200\)/);
  assert.match(patched, /period:480\+ring\*220/);
  assert.match(patched, /verticalAmplitude:Math\.min\(1\.4,localRadius\*\.06\)/);
  assert.match(patched, /ProjectMapThreejsGalaxyMotion/);
  assert.match(patched, /opacity:threeStyle==="galaxy"\?\.11:\.25/);
  assert.equal((patched.match(/edge\.type!=="membership"/g) || []).length, 2);
  assert.match(patched, /if\(threeStyle!=="galaxy"\)\{farStars\.rotation\.y\+=delta\*\.002;midStars\.rotation\.y-=delta\*\.004;nearStars\.rotation\.y\+=delta\*\.006;\}/);
  assert.match(patched, /function syncDynamicEdges\(\)/);
  assert.match(patched, /attribute\.needsUpdate=true/);
  assert.match(patched, /dust\.rotation\.y\+=delta\*\(threeStyle==="galaxy"\?\.0011:\.0035\)/);
  assert.match(patched, /if\(galaxyMotion&&galaxyMotion\.step\(delta\)\)/);
  assert.match(patched, /if\(selectedMesh\)desiredTarget\.copy\(selectedMesh\.position\)/);
  assert.equal(patchThreejsGalaxyMotionRuntime(patched), patched);
});

test("Galaxy motion postprocessor source passes Node syntax check", () => {
  const result = spawnSync(process.execPath, ["--check", "scripts/apply-threejs-galaxy-motion.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
});
