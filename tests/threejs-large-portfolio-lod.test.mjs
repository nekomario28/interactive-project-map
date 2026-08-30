import assert from "node:assert/strict";
import test from "node:test";

import {
  REPOSITORY_HALO_LOD_THRESHOLD,
  patchThreejsLargePortfolioLodRuntime,
} from "../scripts/apply-threejs-large-portfolio-lod.mjs";

function runtimeFixture({ restoreSites = 2 } = {}) {
  const restore = 'selectedMesh.userData.halo.material.opacity=selectedMesh.userData.halo.userData?.baseOpacity||.18;';
  const selectRestore = restoreSites >= 1 ? restore : "";
  const clearRestore = restoreSites >= 2 ? restore : "";
  return `
function createSceneRuntime(THREE,graph,username){const threeStyle=currentThreeStyle(),threeTheme=THREE_STYLE_THEMES[threeStyle];
const haloMaterial={opacity:.18};const halo={userData:{},material:{},visible:true};const mesh={userData:{halo},scale:{setScalar(){}}};const node={type:"repository"};
halo.userData.baseOpacity=haloMaterial.opacity;mesh.add(halo);mesh.userData.halo=halo;
function showTip(){}
let hoveredMesh=null,selectedMesh=null;const nodeBaseScale=new Map();
function setHovered(mesh,event){if(hoveredMesh===mesh){showTip(event,mesh);return;}if(hoveredMesh&&hoveredMesh!==selectedMesh)hoveredMesh.userData.halo.material.opacity=hoveredMesh.userData.halo.userData?.baseOpacity||hoveredMesh.userData.halo.material.opacity;hoveredMesh=mesh;if(hoveredMesh)hoveredMesh.userData.halo.material.opacity=.62;showTip(event,hoveredMesh);}
function selectMesh(mesh){if(!mesh)return;if(selectedMesh&&selectedMesh!==mesh){const oldNode=selectedMesh.userData.node;selectedMesh.scale.setScalar(nodeBaseScale.get(oldNode.id)||1);${selectRestore}}selectedMesh=mesh;mesh.userData.halo.material.opacity=.82;}
function clearSelection(){if(selectedMesh){const node=selectedMesh.userData.node;selectedMesh.scale.setScalar(nodeBaseScale.get(node.id)||1);${clearRestore}}selectedMesh=null;}
ui.canvas.addEventListener("pointerleave",()=>{if(!dragging){hoveredMesh=null;ui.tip.hidden=true;ui.canvas.classList.remove("is-node-hover");}});
window.ProjectMapThreejsLocalGraph=Object.freeze({version:1,snapshot:()=>({focusRoot,depth:focusDepth,nodeIds:(lastLocalProjection?.nodes||[]).map((node)=>node.id).sort(),edgeIds:[...(lastLocalProjection?.edges||[]),...(lastLocalProjection?.semanticEdges||[])].map((edge)=>\`${'${edge.type||"edge"}'}:${'${edge.source}'}->${'${edge.target}'}\`).sort()})});
}
`;
}

test("large-portfolio halo LOD is bounded and preserves interaction emphasis", () => {
  const patched = patchThreejsLargePortfolioLodRuntime(runtimeFixture());
  assert.equal(REPOSITORY_HALO_LOD_THRESHOLD, 240);
  assert.match(patched, /largePortfolioRepositoryHaloLod=graph\.nodes\.filter\(\(node\)=>node\.type==="repository"\)\.length>=240/);
  assert.match(patched, /ambientVisible=!\(largePortfolioRepositoryHaloLod&&node\.type==="repository"\)/);
  assert.match(patched, /function emphasizeNodeHalo\(mesh,opacity\)/);
  assert.equal((patched.match(/restoreNodeHalo\(selectedMesh\)/g) || []).length, 2);
  assert.match(patched, /if\(hoveredMesh===clearedMesh\)emphasizeNodeHalo\(clearedMesh,\.62\)/);
  assert.match(patched, /repositoryHaloLod:largePortfolioRepositoryHaloLod,threshold:240/);
});

test("large-portfolio halo LOD patch is idempotent", () => {
  const once = patchThreejsLargePortfolioLodRuntime(runtimeFixture());
  assert.equal(patchThreejsLargePortfolioLodRuntime(once), once);
});

test("large-portfolio halo LOD fails closed if selection restore sites drift", () => {
  assert.throws(
    () => patchThreejsLargePortfolioLodRuntime(runtimeFixture({ restoreSites: 1 })),
    /Expected two Three\.js selection halo restore sites, found 1/,
  );
});
