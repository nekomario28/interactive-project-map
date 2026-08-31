import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const MARKER = "/* IPM_THREEJS_REPOSITORY_INSTANCING_V1 */";

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function patchThreejsRepositoryInstancing(source) {
  if (source.includes(MARKER)) return source;
  let next = source;
  next = replaceRequired(
    next,
    "function createSceneRuntime(THREE,graph,username){const threeStyle=",
    `function createSceneRuntime(THREE,graph,username){${MARKER}const largeRepositoryScene=graph.nodes.filter((node)=>node.type===\"repository\").length>240;const threeStyle=`,
    "Three.js scene startup",
  );
  next = replaceRequired(
    next,
    "mesh.position.copy(position);if(node.type===\"repository\")",
    "mesh.position.copy(position);if(largeRepositoryScene&&node.type===\"repository\")mesh.material.visible=false;if(node.type===\"repository\")",
    "repository proxy material boundary",
  );
  next = replaceRequired(
    next,
    "  }\n  let edgeLines=null;",
    `  }\n  const repositoryBatches=[],batchMatrix=new THREE.Matrix4(),zeroBatchScale=new THREE.Vector3(0,0,0);\n  function createRepositoryBatch(items,archived){if(!items.length)return;const material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,emissive:0x202838,emissiveIntensity:.46,roughness:.5,metalness:.12,transparent:archived,opacity:archived?.64:1,wireframe:threeStyle===\"wireframe\"}),batch=new THREE.InstancedMesh(geometries.repository,material,items.length);batch.frustumCulled=false;items.forEach((item,index)=>{item.index=index;item.batch=batch;batch.setColorAt(index,nodeColor(item.node));});root.add(batch);repositoryBatches.push({batch,items});}\n  if(largeRepositoryScene){const repositoryItems=graph.nodes.filter((node)=>node.type===\"repository\").map((node)=>({node,mesh:nodeMeshes.get(node.id)})).filter((item)=>item.mesh);createRepositoryBatch(repositoryItems.filter((item)=>!item.node.archived),false);createRepositoryBatch(repositoryItems.filter((item)=>item.node.archived),true);}\n  function syncRepositoryBatches(){if(!largeRepositoryScene)return;for(const entry of repositoryBatches){for(const item of entry.items){const scale=item.mesh.visible?item.mesh.scale:zeroBatchScale;batchMatrix.compose(item.mesh.position,item.mesh.quaternion,scale);entry.batch.setMatrixAt(item.index,batchMatrix);}entry.batch.instanceMatrix.needsUpdate=true;if(entry.batch.instanceColor)entry.batch.instanceColor.needsUpdate=true;}}\n  syncRepositoryBatches();\n  let edgeLines=null;`,
    "repository batch insertion point",
  );
  next = replaceRequired(
    next,
    "rebuildEdges();const totalRepositories=graph.nodes.filter((node)=>node.type===\"repository\").length;",
    "rebuildEdges();syncRepositoryBatches();const totalRepositories=graph.nodes.filter((node)=>node.type===\"repository\").length;",
    "repository visibility synchronization",
  );
  next = replaceRequired(
    next,
    "showDetails(node);appendSearchMatchReason(node);updateFocusControls();emitThreejsNavigatorChange();}",
    "showDetails(node);appendSearchMatchReason(node);updateFocusControls();syncRepositoryBatches();emitThreejsNavigatorChange();}",
    "repository selection synchronization",
  );
  next = replaceRequired(
    next,
    "desiredTarget.set(0,0,0);updateFocusControls();emitThreejsNavigatorChange();}",
    "desiredTarget.set(0,0,0);updateFocusControls();syncRepositoryBatches();emitThreejsNavigatorChange();}",
    "repository clear-selection synchronization",
  );
  next = replaceRequired(
    next,
    "const pulse=motionEnabled?1+Math.sin(pulseTime*.8+mesh.userData.phase)*(node.type===\"repository\"?.025:.018):1;",
    "const pulse=largeRepositoryScene&&node.type===\"repository\"?1:motionEnabled?1+Math.sin(pulseTime*.8+mesh.userData.phase)*(node.type===\"repository\"?.025:.018):1;",
    "large-scene repository pulse boundary",
  );
  next = replaceRequired(
    next,
    "edgeMaterial.dispose();for(const geometry of Object.values(geometries))geometry.dispose();",
    "edgeMaterial.dispose();for(const entry of repositoryBatches)entry.batch.material.dispose();for(const geometry of Object.values(geometries))geometry.dispose();",
    "repository batch disposal",
  );
  return next;
}

export async function applyThreejsRepositoryInstancing({ siteDir = join(process.cwd(), "site") } = {}) {
  const runtimePath = join(siteDir, "threejs-viewer.js");
  const source = await readFile(runtimePath, "utf8");
  const next = patchThreejsRepositoryInstancing(source);
  if (next !== source) await writeFile(runtimePath, next);
  return { runtimePath, changed: next !== source };
}

async function main() {
  const result = await applyThreejsRepositoryInstancing();
  console.log(`Applied Three.js repository instancing${result.changed ? "" : " (already present)"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
