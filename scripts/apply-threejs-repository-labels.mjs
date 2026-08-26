import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const MARKER = "/* IPM_THREEJS_BOUNDED_REPOSITORY_LABELS_P2 */";
const STYLE_TAG = '<link rel="stylesheet" href="../threejs-repository-labels.css">';
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

  const projectLabels = '  function projectLabels(){const rect=ui.canvas.getBoundingClientRect(),temp=new THREE.Vector3();for(const item of groupLabels){if(!item.mesh.visible){item.element.hidden=true;continue;}temp.copy(item.mesh.position).project(camera);const behind=temp.z< -1||temp.z>1,x=(temp.x*.5+.5)*rect.width,y=(-temp.y*.5+.5)*rect.height;item.element.hidden=behind||x< -70||x>rect.width+70||y< -30||y>rect.height+30;if(!item.element.hidden){item.element.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;item.element.style.opacity=String(clamp(1.18-temp.z*.55,.28,1));}}}\n';
  if (!next.includes(projectLabels)) throw new Error("Could not locate Three.js projected-label function");

  const replacement = `  ${MARKER}
  const DIRECT_SEARCH_LABEL_BUDGET=${DIRECT_SEARCH_LABEL_BUDGET};
  function desiredRepositoryLabelIds(){const ids=[],selectedId=selectedMesh?.visible&&selectedMesh.userData.node?.type==="repository"?selectedMesh.userData.node.id:"";if(selectedId)ids.push(selectedId);let directCount=0;for(const id of lastSearchProjection?.directRepositories?.()||[]){if(directCount>=DIRECT_SEARCH_LABEL_BUDGET)break;if(id===selectedId)continue;const mesh=nodeMeshes.get(id);if(!mesh?.visible||mesh.userData.node?.type!=="repository")continue;ids.push(id);directCount+=1;}return ids;}
  function syncRepositoryLabels(){const ids=desiredRepositoryLabelIds(),selectedId=selectedMesh?.visible&&selectedMesh.userData.node?.type==="repository"?selectedMesh.userData.node.id:"",directIds=new Set(lastSearchProjection?.directRepositories?.()||[]),key=\`${'${selectedId}'}|${'${ids.join(",")}'}\`;if(key===repositoryLabelKey)return;repositoryLabelKey=key;const desired=new Set(ids);for(const [id,item] of repositoryLabels){if(desired.has(id))continue;item.element.remove();repositoryLabels.delete(id);}for(const id of ids){let item=repositoryLabels.get(id);const mesh=nodeMeshes.get(id),node=mesh?.userData.node;if(!mesh||!node)continue;if(!item){const element=document.createElement("span");element.className="three-label three-label-repository";element.dataset.repositoryLabelId=id;element.setAttribute("aria-hidden","true");element.textContent=node.label;ui.labels.append(element);item={node,mesh,element};repositoryLabels.set(id,item);}item.element.classList.toggle("is-selected",id===selectedId);item.element.classList.toggle("is-search-match",id!==selectedId&&directIds.has(id));}}
  function projectRepositoryLabels(rect,temp){syncRepositoryLabels();for(const item of repositoryLabels.values()){if(!item.mesh.visible){item.element.hidden=true;continue;}temp.copy(item.mesh.position).project(camera);const behind=temp.z< -1||temp.z>1,x=(temp.x*.5+.5)*rect.width,y=(-temp.y*.5+.5)*rect.height;item.element.hidden=behind||x< -90||x>rect.width+90||y< -50||y>rect.height+50;if(!item.element.hidden){const selected=item.element.classList.contains("is-selected");item.element.style.transform=\`translate3d(${'${x}'}px,${'${y-9}'}px,0) translate(-50%,-100%)\`;item.element.style.opacity=selected?"0.98":"0.82";}}}
  function projectLabels(){const rect=ui.canvas.getBoundingClientRect(),temp=new THREE.Vector3();for(const item of groupLabels){if(!item.mesh.visible){item.element.hidden=true;continue;}temp.copy(item.mesh.position).project(camera);const behind=temp.z< -1||temp.z>1,x=(temp.x*.5+.5)*rect.width,y=(-temp.y*.5+.5)*rect.height;item.element.hidden=behind||x< -70||x>rect.width+70||y< -30||y>rect.height+30;if(!item.element.hidden){item.element.style.transform=\`translate3d(${'${x}'}px,${'${y}'}px,0) translate(-50%,-50%)\`;item.element.style.opacity=String(clamp(1.18-temp.z*.55,.28,1));}}projectRepositoryLabels(rect,temp);}
`;
  return next.replace(projectLabels, replacement);
}

export function patchThreejsRepositoryLabelsPage(html) {
  if (html.includes(STYLE_TAG)) return html;
  if (!html.includes("</head>")) throw new Error("Could not locate Three.js </head> for bounded repository labels");
  return html.replace("</head>", `${STYLE_TAG}\n</head>`);
}

export async function applyThreejsRepositoryLabels({
  siteDir = join(process.cwd(), "site"),
  sourceDir = join(process.cwd(), "scripts"),
} = {}) {
  const runtimePath = join(siteDir, "threejs-viewer.js");
  const pagePath = join(siteDir, "three", "index.html");
  const stylePath = join(siteDir, "threejs-repository-labels.css");
  const [runtime, page] = await Promise.all([readFile(runtimePath, "utf8"), readFile(pagePath, "utf8")]);
  const nextRuntime = patchThreejsRepositoryLabelsRuntime(runtime);
  const nextPage = patchThreejsRepositoryLabelsPage(page);
  if (nextRuntime !== runtime) await writeFile(runtimePath, nextRuntime);
  if (nextPage !== page) await writeFile(pagePath, nextPage);
  await copyFile(join(sourceDir, "public-threejs-repository-labels.css"), stylePath);
  return { runtimePath, pagePath, stylePath, injected: nextRuntime !== runtime || nextPage !== page };
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
