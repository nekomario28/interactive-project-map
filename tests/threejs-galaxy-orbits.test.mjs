import assert from "node:assert/strict";
import test from "node:test";
import { patchThreejsGalaxyOrbits } from "../scripts/threejs-galaxy-orbits.mjs";

const source = `
const TAU=Math.PI*2;
function layoutGalaxyGraph(THREE,graph){return new Map();}
function createSceneRuntime(THREE,graph,username){
const positions=threeStyle==="galaxy"?layoutGalaxyGraph(THREE,graph):layoutGraph(THREE,graph),nodeMeshes=new Map(),pickable=[];
let edgeLines=null;
function rebuildEdges(){if(edgeLines){root.remove(edgeLines);edgeLines.geometry.dispose();}const values=[];for(const edge of graph.edges){const source=nodeMeshes.get(edge.source),targetMesh=nodeMeshes.get(edge.target);if(!source||!targetMesh||!source.visible||!targetMesh.visible)continue;values.push(source.position.x,source.position.y,source.position.z,targetMesh.position.x,targetMesh.position.y,targetMesh.position.z);}const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(values,3));edgeLines=new THREE.LineSegments(geometry,edgeMaterial);edgeLines.renderOrder=-1;root.add(edgeLines);}
function resize(){}
function animate(now){if(disposed)return;const delta=Math.min(.05,Math.max(0,(now-previousTime)/1000));previousTime=now;setCameraFromOrbit(false);if(motionEnabled){farStars.rotation.y+=delta*.002;midStars.rotation.y-=delta*.004;nearStars.rotation.y+=delta*.006;dust.rotation.y+=delta*.0035;}renderer.render(scene,camera);animationFrame=requestAnimationFrame(animate);}
}
`;

test("Galaxy orbit patch adds slow differential galactic rotation and Kepler-like local planet periods", () => {
  const patched = patchThreejsGalaxyOrbits(source);
  assert.match(patched, /function createGalaxyMotionModel\(graph,positions\)/);
  assert.match(patched, /period=clamp\(radius\*20,1800,4200\)/);
  assert.match(patched, /480\*Math\.pow\(Math\.max\(radius,8\)\/12,1\.5\)/);
  assert.match(patched, /360,1440/);
  assert.match(patched, /repo\.relation==="contributed"/);
  assert.match(patched, /period=clamp\(radius\*18,3000,5400\)/);
  assert.match(patched, /galaxyMotion=threeStyle==="galaxy"\?createGalaxyMotionModel\(graph,positions\):null/);
});

test("Galaxy orbit patch moves nodes only while motion is enabled and keeps edge endpoints synchronized", () => {
  const patched = patchThreejsGalaxyOrbits(source);
  assert.match(patched, /function advanceGalaxyMotion\(delta\)/);
  assert.match(patched, /galaxyMotion\.time\+=delta/);
  assert.match(patched, /center\.position\.x\+Math\.cos\(angle\)\*orbit\.radius/);
  assert.match(patched, /function syncEdgePositions\(\)/);
  assert.match(patched, /attribute\.setXYZ\(cursor\+\+,source\.position\.x/);
  assert.match(patched, /if\(motionEnabled&&galaxyMotion\)\{advanceGalaxyMotion\(delta\);syncEdgePositions\(\);\}/);
});

test("Galaxy orbit patch is idempotent and ignores pre-Galaxy runtimes", () => {
  const once = patchThreejsGalaxyOrbits(source);
  const twice = patchThreejsGalaxyOrbits(once);
  assert.equal(twice, once);
  assert.equal(patchThreejsGalaxyOrbits('const THREE_URL="x";'), 'const THREE_URL="x";');
});
