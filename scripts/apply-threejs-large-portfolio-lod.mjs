import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const MARKER = "/* IPM_THREEJS_LARGE_PORTFOLIO_HALO_LOD_V1 */";
export const REPOSITORY_HALO_LOD_THRESHOLD = 240;

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function patchThreejsLargePortfolioLodRuntime(source) {
  if (source.includes(MARKER)) return source;
  let next = source;

  const sceneStart = 'function createSceneRuntime(THREE,graph,username){const threeStyle=currentThreeStyle(),threeTheme=THREE_STYLE_THEMES[threeStyle];';
  next = replaceRequired(
    next,
    sceneStart,
    `${sceneStart}${MARKER}const largePortfolioRepositoryHaloLod=graph.nodes.filter((node)=>node.type==="repository").length>=${REPOSITORY_HALO_LOD_THRESHOLD};`,
    "Three.js large-portfolio LOD scene boundary",
  );

  const haloState = 'halo.userData.baseOpacity=haloMaterial.opacity;mesh.add(halo);mesh.userData.halo=halo;';
  next = replaceRequired(
    next,
    haloState,
    'halo.userData.baseOpacity=haloMaterial.opacity;halo.userData.ambientVisible=!(largePortfolioRepositoryHaloLod&&node.type==="repository");halo.visible=halo.userData.ambientVisible;mesh.add(halo);mesh.userData.halo=halo;',
    "Three.js repository halo creation",
  );

  const hovered = 'function setHovered(mesh,event){if(hoveredMesh===mesh){showTip(event,mesh);return;}if(hoveredMesh&&hoveredMesh!==selectedMesh)hoveredMesh.userData.halo.material.opacity=hoveredMesh.userData.halo.userData?.baseOpacity||hoveredMesh.userData.halo.material.opacity;hoveredMesh=mesh;if(hoveredMesh)hoveredMesh.userData.halo.material.opacity=.62;showTip(event,hoveredMesh);}';
  const hoveredNext = 'function restoreNodeHalo(mesh){if(!mesh?.userData.halo)return;mesh.userData.halo.material.opacity=mesh.userData.halo.userData?.baseOpacity||mesh.userData.halo.material.opacity;mesh.userData.halo.visible=mesh.userData.halo.userData?.ambientVisible!==false;}function emphasizeNodeHalo(mesh,opacity){if(!mesh?.userData.halo)return;mesh.userData.halo.visible=true;mesh.userData.halo.material.opacity=opacity;}function setHovered(mesh,event){if(hoveredMesh===mesh){showTip(event,mesh);return;}if(hoveredMesh&&hoveredMesh!==selectedMesh)restoreNodeHalo(hoveredMesh);hoveredMesh=mesh;if(hoveredMesh)emphasizeNodeHalo(hoveredMesh,.62);showTip(event,hoveredMesh);}';
  next = replaceRequired(next, hovered, hoveredNext, "Three.js hover halo behavior");

  const selectionRestore = 'selectedMesh.userData.halo.material.opacity=selectedMesh.userData.halo.userData?.baseOpacity||.18;';
  const selectionRestoreCount = next.split(selectionRestore).length - 1;
  if (selectionRestoreCount !== 2) throw new Error(`Expected two Three.js selection halo restore sites, found ${selectionRestoreCount}`);
  next = next.split(selectionRestore).join('restoreNodeHalo(selectedMesh);');
  const clearSelectionStart = 'function clearSelection(){if(selectedMesh){const node=selectedMesh.userData.node;selectedMesh.scale.setScalar(nodeBaseScale.get(node.id)||1);restoreNodeHalo(selectedMesh);}selectedMesh=null;';
  next = replaceRequired(
    next,
    clearSelectionStart,
    'function clearSelection(){const clearedMesh=selectedMesh;if(selectedMesh){const node=selectedMesh.userData.node;selectedMesh.scale.setScalar(nodeBaseScale.get(node.id)||1);restoreNodeHalo(selectedMesh);}selectedMesh=null;if(hoveredMesh===clearedMesh)emphasizeNodeHalo(clearedMesh,.62);',
    "Three.js clear-selection hover halo continuity",
  );
  const selectEmphasis = 'mesh.userData.halo.material.opacity=.82;';
  next = replaceRequired(next, selectEmphasis, 'emphasizeNodeHalo(mesh,.82);', "Three.js selected halo emphasis");

  const pointerLeave = 'ui.canvas.addEventListener("pointerleave",()=>{if(!dragging){hoveredMesh=null;ui.tip.hidden=true;ui.canvas.classList.remove("is-node-hover");}});';
  next = replaceRequired(
    next,
    pointerLeave,
    'ui.canvas.addEventListener("pointerleave",()=>{if(!dragging){if(hoveredMesh&&hoveredMesh!==selectedMesh)restoreNodeHalo(hoveredMesh);hoveredMesh=null;ui.tip.hidden=true;ui.canvas.classList.remove("is-node-hover");}});',
    "Three.js pointer-leave halo restore",
  );

  const snapshotAnchor = 'window.ProjectMapThreejsLocalGraph=Object.freeze({version:1,snapshot:()=>({focusRoot,depth:focusDepth,nodeIds:(lastLocalProjection?.nodes||[]).map((node)=>node.id).sort(),edgeIds:[...(lastLocalProjection?.edges||[]),...(lastLocalProjection?.semanticEdges||[])].map((edge)=>`${edge.type||"edge"}:${edge.source}->${edge.target}`).sort()})});';
  next = replaceRequired(
    next,
    snapshotAnchor,
    `${snapshotAnchor}window.ProjectMapThreejsLargePortfolioLod=Object.freeze({version:1,snapshot:()=>({repositoryHaloLod:largePortfolioRepositoryHaloLod,threshold:${REPOSITORY_HALO_LOD_THRESHOLD}})});`,
    "Three.js large-portfolio LOD evidence snapshot",
  );

  return next;
}

export async function applyThreejsLargePortfolioLod({ siteDir = join(process.cwd(), "site") } = {}) {
  const runtimePath = join(siteDir, "threejs-viewer.js");
  const source = await readFile(runtimePath, "utf8");
  const next = patchThreejsLargePortfolioLodRuntime(source);
  if (next !== source) await writeFile(runtimePath, next);
  return { runtimePath, injected: next !== source };
}

async function main() {
  const result = await applyThreejsLargePortfolioLod();
  console.log(`Applied Three.js large-portfolio halo LOD${result.injected ? "" : " (already present)"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
