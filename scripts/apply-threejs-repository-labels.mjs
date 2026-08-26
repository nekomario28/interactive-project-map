import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const MARKER = "/* IPM_THREEJS_BOUNDED_REPOSITORY_LABELS_P2 */";
export const DIRECT_SEARCH_LABEL_BUDGET = 8;

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function patchThreejsRepositoryLabelsRuntime(source) {
  if (source.includes(MARKER)) return source;
  if (!source.includes("IPM_THREEJS_CATEGORY_NAVIGATOR_P2")) {
    throw new Error("Three.js Category Navigator adapter must run before bounded repository labels");
  }

  let next = source;
  next = replaceRequired(
    next,
    "nodeMeshes=new Map(),pickable=[],groupLabels=[],nodeBaseScale=new Map()",
    "nodeMeshes=new Map(),pickable=[],groupLabels=[],repositoryLabels=new Map(),repositoryLabelKey=\"\",nodeBaseScale=new Map()",
    "Three.js label registries",
  );

  const projectPattern = /  function projectLabels\(\)\{[\s\S]*?\}\n(?=  function setQuality\(next\)\{)/;
  const match = next.match(projectPattern);
  if (!match) throw new Error("Could not locate Three.js projected-label function");

  const replacement = `  ${MARKER}
  const DIRECT_SEARCH_LABEL_BUDGET=${DIRECT_SEARCH_LABEL_BUDGET};
  function desiredRepositoryLabelIds(){const ids=[],selectedId=selectedMesh?.visible&&selectedMesh.userData.node?.type==="repository"?selectedMesh.userData.node.id:"";if(selectedId)ids.push(selectedId);let directCount=0;for(const id of lastSearchProjection?.directRepositories?.()||[]){if(directCount>=DIRECT_SEARCH_LABEL_BUDGET)break;if(id===selectedId)continue;const mesh=nodeMeshes.get(id);if(!mesh?.visible||mesh.userData.node?.type!=="repository")continue;ids.push(id);directCount+=1;}return ids;}
  function syncRepositoryLabels(){const ids=desiredRepositoryLabelIds(),selectedId=selectedMesh?.visible&&selectedMesh.userData.node?.type==="repository"?selectedMesh.userData.node.id:"",key=\`${'${selectedId}'}|${'${ids.join(",")}'}\`;if(key===repositoryLabelKey)return;repositoryLabelKey=key;const desired=new Set(ids);for(const [id,item] of repositoryLabels){if(desired.has(id))continue;item.element.remove();repositoryLabels.delete(id);}for(const id of ids){let item=repositoryLabels.get(id);const mesh=nodeMeshes.get(id),node=mesh?.userData.node;if(!mesh||!node)continue;if(!item){const element=document.createElement("span");element.className="three-label three-label-repository";element.dataset.repositoryLabelId=id;element.setAttribute("aria-hidden","true");element.textContent=node.label;ui.labels.append(element);item={node,mesh,element};repositoryLabels.set(id,item);}item.element.classList.toggle("is-selected",id===selectedId);item.element.classList.toggle("is-search-match",id!==selectedId&&Boolean(lastSearchProjection?.directRepositories?.().includes(id)));}}
  function projectLabelItem(item,rect,temp,{repository=false}={}){if(!item.mesh.visible){item.element.style.opacity="0";return;}temp.copy(item.mesh.position).project(camera);const visible=temp.z>-1&&temp.z<1;if(!visible){item.element.style.opacity="0";return;}const x=(temp.x*.5+.5)*rect.width,y=(-temp.y*.5+.5)*rect.height,d=camera.position.distanceTo(item.mesh.position),scale=repository?clamp(1.04-d/720,.76,1):clamp(1.08-d/700,.72,1);item.element.style.transform=repository?\`translate(${'${x}'}px,${'${y-9}'}px) translate(-50%,-100%) scale(${'${scale}'})\`:\`translate(${'${x}'}px,${'${y}'}px) translate(-50%,-50%) scale(${'${scale}'})\`;item.element.style.opacity=String(repository?(item.element.classList.contains("is-selected")?.98:.82):clamp(1.25-d/480,.34,.95));}
  function projectLabels(){const rect=ui.canvas.getBoundingClientRect(),temp=new THREE.Vector3();for(const item of groupLabels)projectLabelItem(item,rect,temp);syncRepositoryLabels();for(const item of repositoryLabels.values())projectLabelItem(item,rect,temp,{repository:true});}
`;
  next = next.replace(projectPattern, replacement);

  const snapshotPattern = /window\.ProjectMapThreejsLab=Object\.freeze\(\{snapshot:\(\)=>\(\{renderer:"threejs"[\s\S]*?\}\)\}\);/;
  const snapshotMatch = next.match(snapshotPattern);
  if (snapshotMatch) {
    const current = snapshotMatch[0];
    const augmented = current.replace(
      "experimental:true",
      'experimental:true,repositoryLabels:{budget:DIRECT_SEARCH_LABEL_BUDGET,total:repositoryLabels.size,ids:[...repositoryLabels.keys()].sort()}',
    );
    next = next.replace(current, augmented);
  }

  return next;
}

export async function applyThreejsRepositoryLabels({ siteDir = join(process.cwd(), "site") } = {}) {
  const runtimePath = join(siteDir, "threejs-viewer.js");
  const runtime = await readFile(runtimePath, "utf8");
  const nextRuntime = patchThreejsRepositoryLabelsRuntime(runtime);
  if (nextRuntime !== runtime) await writeFile(runtimePath, nextRuntime);
  return { runtimePath, injected: nextRuntime !== runtime };
}

async function main() {
  const result = await applyThreejsRepositoryLabels();
  console.log(`Applied bounded Three.js repository labels to ${result.runtimePath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
