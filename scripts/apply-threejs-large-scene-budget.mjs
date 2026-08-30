import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const MARKER = "/* IPM_THREEJS_LARGE_SCENE_HALO_BUDGET_V1 */";
const SCENE_START = "function createSceneRuntime(THREE,graph,username){const threeStyle=currentThreeStyle(),threeTheme=THREE_STYLE_THEMES[threeStyle];";
const BUDGETED_SCENE_START = `function createSceneRuntime(THREE,graph,username){${MARKER}const repositoryCount=graph.nodes.filter((node)=>node.type===\"repository\").length,largeScene=repositoryCount>240;const threeStyle=currentThreeStyle(),threeTheme=THREE_STYLE_THEMES[threeStyle];`;
const HALO_ATTACH = "halo.scale.set(haloScale,haloScale,1);halo.userData.baseOpacity=haloMaterial.opacity;mesh.add(halo);mesh.userData.halo=halo;";
const BUDGETED_HALO_ATTACH = "halo.scale.set(haloScale,haloScale,1);halo.userData.baseOpacity=haloMaterial.opacity;mesh.add(halo);mesh.userData.halo=halo;mesh.userData.largeSceneHalo=largeScene&&node.type===\"repository\";if(mesh.userData.largeSceneHalo)halo.visible=false;";
const HOVER = "function setHovered(mesh,event){if(hoveredMesh===mesh){showTip(event,mesh);return;}if(hoveredMesh&&hoveredMesh!==selectedMesh)hoveredMesh.userData.halo.material.opacity=hoveredMesh.userData.halo.userData?.baseOpacity||hoveredMesh.userData.halo.material.opacity;hoveredMesh=mesh;if(hoveredMesh)hoveredMesh.userData.halo.material.opacity=.62;showTip(event,hoveredMesh);}";
const BUDGETED_HOVER = "function setHovered(mesh,event){if(hoveredMesh===mesh){showTip(event,mesh);return;}if(hoveredMesh&&hoveredMesh!==selectedMesh){hoveredMesh.userData.halo.material.opacity=hoveredMesh.userData.halo.userData?.baseOpacity||hoveredMesh.userData.halo.material.opacity;if(hoveredMesh.userData.largeSceneHalo)hoveredMesh.userData.halo.visible=false;}hoveredMesh=mesh;if(hoveredMesh){hoveredMesh.userData.halo.visible=true;hoveredMesh.userData.halo.material.opacity=.62;}showTip(event,hoveredMesh);}";
const SELECT = "function selectMesh(mesh){if(!mesh)return;if(selectedMesh&&selectedMesh!==mesh){const oldNode=selectedMesh.userData.node;selectedMesh.scale.setScalar(nodeBaseScale.get(oldNode.id)||1);selectedMesh.userData.halo.material.opacity=selectedMesh.userData.halo.userData?.baseOpacity||.18;}selectedMesh=mesh;const node=mesh.userData.node,baseScale=nodeBaseScale.get(node.id)||1;mesh.scale.setScalar(baseScale*1.22);mesh.userData.halo.material.opacity=.82;desiredTarget.copy(mesh.position);";
const BUDGETED_SELECT = "function selectMesh(mesh){if(!mesh)return;if(selectedMesh&&selectedMesh!==mesh){const oldNode=selectedMesh.userData.node;selectedMesh.scale.setScalar(nodeBaseScale.get(oldNode.id)||1);selectedMesh.userData.halo.material.opacity=selectedMesh.userData.halo.userData?.baseOpacity||.18;if(selectedMesh.userData.largeSceneHalo)selectedMesh.userData.halo.visible=false;}selectedMesh=mesh;const node=mesh.userData.node,baseScale=nodeBaseScale.get(node.id)||1;mesh.scale.setScalar(baseScale*1.22);mesh.userData.halo.visible=true;mesh.userData.halo.material.opacity=.82;desiredTarget.copy(mesh.position);";
const CLEAR = "function clearSelection(){if(selectedMesh){const node=selectedMesh.userData.node;selectedMesh.scale.setScalar(nodeBaseScale.get(node.id)||1);selectedMesh.userData.halo.material.opacity=selectedMesh.userData.halo.userData?.baseOpacity||.18;}selectedMesh=null;";
const BUDGETED_CLEAR = "function clearSelection(){if(selectedMesh){const node=selectedMesh.userData.node;selectedMesh.scale.setScalar(nodeBaseScale.get(node.id)||1);selectedMesh.userData.halo.material.opacity=selectedMesh.userData.halo.userData?.baseOpacity||.18;if(selectedMesh.userData.largeSceneHalo)selectedMesh.userData.halo.visible=false;}selectedMesh=null;";
const POINTER_LEAVE = "ui.canvas.addEventListener(\"pointerleave\",()=>{if(!dragging){hoveredMesh=null;ui.tip.hidden=true;ui.canvas.classList.remove(\"is-node-hover\");}});";
const BUDGETED_POINTER_LEAVE = "ui.canvas.addEventListener(\"pointerleave\",()=>{if(!dragging){if(hoveredMesh&&hoveredMesh!==selectedMesh&&hoveredMesh.userData.largeSceneHalo)hoveredMesh.userData.halo.visible=false;hoveredMesh=null;ui.tip.hidden=true;ui.canvas.classList.remove(\"is-node-hover\");}});";

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function patchThreejsLargeSceneBudget(source) {
  if (source.includes(MARKER)) return source;
  let next = replaceRequired(source, SCENE_START, BUDGETED_SCENE_START, "Three.js scene startup");
  next = replaceRequired(next, HALO_ATTACH, BUDGETED_HALO_ATTACH, "Three.js halo attachment");
  next = replaceRequired(next, HOVER, BUDGETED_HOVER, "Three.js hover emphasis");
  next = replaceRequired(next, SELECT, BUDGETED_SELECT, "Three.js selection emphasis");
  next = replaceRequired(next, CLEAR, BUDGETED_CLEAR, "Three.js selection clear");
  return replaceRequired(next, POINTER_LEAVE, BUDGETED_POINTER_LEAVE, "Three.js pointer leave cleanup");
}

export async function applyThreejsLargeSceneBudget({ siteDir = join(process.cwd(), "site") } = {}) {
  const runtimePath = join(siteDir, "threejs-viewer.js");
  const source = await readFile(runtimePath, "utf8");
  const next = patchThreejsLargeSceneBudget(source);
  if (next !== source) await writeFile(runtimePath, next);
  return { runtimePath, changed: next !== source };
}

async function main() {
  const result = await applyThreejsLargeSceneBudget();
  console.log(`Applied Three.js large-scene halo budget${result.changed ? "" : " (already present)"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
