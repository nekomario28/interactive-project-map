import assert from "node:assert/strict";
import test from "node:test";
import { patchThreejsLargeSceneBudget } from "../scripts/apply-threejs-large-scene-budget.mjs";

const fixture = `function createSceneRuntime(THREE,graph,username){const threeStyle=currentThreeStyle(),threeTheme=THREE_STYLE_THEMES[threeStyle];
halo.scale.set(haloScale,haloScale,1);halo.userData.baseOpacity=haloMaterial.opacity;mesh.add(halo);mesh.userData.halo=halo;
function setHovered(mesh,event){if(hoveredMesh===mesh){showTip(event,mesh);return;}if(hoveredMesh&&hoveredMesh!==selectedMesh)hoveredMesh.userData.halo.material.opacity=hoveredMesh.userData.halo.userData?.baseOpacity||hoveredMesh.userData.halo.material.opacity;hoveredMesh=mesh;if(hoveredMesh)hoveredMesh.userData.halo.material.opacity=.62;showTip(event,hoveredMesh);}
function selectMesh(mesh){if(!mesh)return;if(selectedMesh&&selectedMesh!==mesh){const oldNode=selectedMesh.userData.node;selectedMesh.scale.setScalar(nodeBaseScale.get(oldNode.id)||1);selectedMesh.userData.halo.material.opacity=selectedMesh.userData.halo.userData?.baseOpacity||.18;}selectedMesh=mesh;const node=mesh.userData.node,baseScale=nodeBaseScale.get(node.id)||1;mesh.scale.setScalar(baseScale*1.22);mesh.userData.halo.material.opacity=.82;desiredTarget.copy(mesh.position);
function clearSelection(){if(selectedMesh){const node=selectedMesh.userData.node;selectedMesh.scale.setScalar(nodeBaseScale.get(node.id)||1);selectedMesh.userData.halo.material.opacity=selectedMesh.userData.halo.userData?.baseOpacity||.18;}selectedMesh=null;
ui.canvas.addEventListener("pointerleave",()=>{if(!dragging){hoveredMesh=null;ui.tip.hidden=true;ui.canvas.classList.remove("is-node-hover");}});`;

test("large-scene budget hides only normal repository halos and restores interaction emphasis", () => {
  const patched = patchThreejsLargeSceneBudget(fixture);
  assert.match(patched, /repositoryCount>240/);
  assert.match(patched, /largeScene&&node\.type==="repository"/);
  assert.match(patched, /if\(mesh\.userData\.largeSceneHalo\)halo\.visible=false/);
  assert.match(patched, /hoveredMesh\.userData\.halo\.visible=true/);
  assert.match(patched, /mesh\.userData\.halo\.visible=true;mesh\.userData\.halo\.material\.opacity=\.82/);
  assert.match(patched, /if\(selectedMesh\.userData\.largeSceneHalo\)selectedMesh\.userData\.halo\.visible=false/);
  assert.equal(patchThreejsLargeSceneBudget(patched), patched);
});

test("large-scene budget fails closed when the generated runtime shape changes", () => {
  assert.throws(() => patchThreejsLargeSceneBudget("function createSceneRuntime(){}"), /Could not locate Three\.js scene startup/);
});
