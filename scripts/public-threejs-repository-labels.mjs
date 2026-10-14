const MARKER = "/* IPM_THREEJS_BOUNDED_REPOSITORY_LABELS_P2 */";
const STYLE_TAG = '<link rel="stylesheet" href="../threejs-repository-labels.css">';
export const DIRECT_SEARCH_LABEL_BUDGET = 8;

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function composeThreejsRepositoryLabelsRuntime(source) {
  if (source.includes(MARKER)) return source;
  if (!source.includes("IPM_THREEJS_CATEGORY_NAVIGATOR_P2")) {
    throw new Error("Three.js Category Navigator adapter must run before bounded repository labels");
  }

  let next = source;
  next = replaceRequired(
    next,
    "nodeMeshes=new Map(),pickable=[],groupLabels=[],nodeBaseScale=new Map()",
    "nodeMeshes=new Map(),pickable=[],groupLabels=[],repositoryLabels=new Map(),repositoryLabelState={key:\"\"},nodeBaseScale=new Map()",
    "Three.js label registries",
  );

  const projectLabels = '  // Only perform DOM geometry reads while selected/search labels are present.
  // The selected repository wins a genuine collision against its category.
  function suppressProjectLabelCollisions(){
    if(!repositoryLabels.size)return;
    const viewport=ui.labels.getBoundingClientRect(),accepted=[];
    const selected=[...repositoryLabels.values()].filter(item=>item.element.classList.contains("is-selected"));
    const rest=[...repositoryLabels.values()].filter(item=>!item.element.classList.contains("is-selected"));
    for(const item of [...selected,...groupLabels,...rest]){
      const element=item.element;
      if(element.hidden)continue;
      const box=element.getBoundingClientRect();
      if(box.width<=0||box.height<=0||box.left<viewport.left+2||box.right>viewport.right-2||box.top<viewport.top+2||box.bottom>viewport.bottom-2){element.hidden=true;continue;}
      let collision=false;
      for(const other of accepted){
        const w=Math.max(0,Math.min(box.right,other.right)-Math.max(box.left,other.left));
        const h=Math.max(0,Math.min(box.bottom,other.bottom)-Math.max(box.top,other.top));
        if(w*h>0.35*Math.min(box.width*box.height,other.width*other.height)){collision=true;break;}
      }
      if(collision){element.hidden=true;continue;}
      accepted.push(box);
    }
  }
  function projectLabels(){const rect=ui.canvas.getBoundingClientRect(),temp=new THREE.Vector3();for(const item of groupLabels){if(!item.mesh.visible){item.element.hidden=true;continue;}temp.copy(item.mesh.position).project(camera);const behind=temp.z< -1||temp.z>1,x=(temp.x*.5+.5)*rect.width,y=(-temp.y*.5+.5)*rect.height;item.element.hidden=behind||x< -70||x>rect.width+70||y< -30||y>rect.height+30;if(!item.element.hidden){item.element.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;item.element.style.opacity=String(clamp(1.18-temp.z*.55,.28,1));}}}\n';
  if (!next.includes(projectLabels)) throw new Error("Could not locate Three.js projected-label function");

  const replacement = `  ${MARKER}
  const DIRECT_SEARCH_LABEL_BUDGET=${DIRECT_SEARCH_LABEL_BUDGET};
  function desiredRepositoryLabelIds(){const ids=[],selectedId=selectedMesh?.visible&&selectedMesh.userData.node?.type==="repository"?selectedMesh.userData.node.id:"";if(selectedId)ids.push(selectedId);let directCount=0;for(const id of lastSearchProjection?.directRepositories?.()||[]){if(directCount>=DIRECT_SEARCH_LABEL_BUDGET)break;if(id===selectedId)continue;const mesh=nodeMeshes.get(id);if(!mesh?.visible||mesh.userData.node?.type!=="repository")continue;ids.push(id);directCount+=1;}return ids;}
  function syncRepositoryLabels(){const ids=desiredRepositoryLabelIds(),selectedId=selectedMesh?.visible&&selectedMesh.userData.node?.type==="repository"?selectedMesh.userData.node.id:"",directIds=new Set(lastSearchProjection?.directRepositories?.()||[]),key=\`${'${selectedId}'}|${'${ids.join(",")}'}\`;if(key===repositoryLabelState.key)return;repositoryLabelState.key=key;const desired=new Set(ids);for(const [id,item] of repositoryLabels){if(desired.has(id))continue;item.element.remove();repositoryLabels.delete(id);}for(const id of ids){let item=repositoryLabels.get(id);const mesh=nodeMeshes.get(id),node=mesh?.userData.node;if(!mesh||!node)continue;if(!item){const element=document.createElement("span");element.className="three-label three-label-repository";element.dataset.repositoryLabelId=id;element.setAttribute("aria-hidden","true");element.textContent=node.label;ui.labels.append(element);item={node,mesh,element};repositoryLabels.set(id,item);}item.element.classList.toggle("is-selected",id===selectedId);item.element.classList.toggle("is-search-match",id!==selectedId&&directIds.has(id));}}
  function projectRepositoryLabels(rect,temp){syncRepositoryLabels();for(const item of repositoryLabels.values()){if(!item.mesh.visible){item.element.hidden=true;continue;}temp.copy(item.mesh.position).project(camera);const behind=temp.z< -1||temp.z>1,x=(temp.x*.5+.5)*rect.width,y=(-temp.y*.5+.5)*rect.height;item.element.hidden=behind||x< -90||x>rect.width+90||y< -50||y>rect.height+50;if(!item.element.hidden){const selected=item.element.classList.contains("is-selected");item.element.style.transform=\`translate3d(${'${x}'}px,${'${y-9}'}px,0) translate(-50%,-100%)\`;item.element.style.opacity=selected?"0.98":"0.82";}}}
  function projectLabels(){const rect=ui.canvas.getBoundingClientRect(),temp=new THREE.Vector3();for(const item of groupLabels){if(!item.mesh.visible){item.element.hidden=true;continue;}temp.copy(item.mesh.position).project(camera);const behind=temp.z< -1||temp.z>1,x=(temp.x*.5+.5)*rect.width,y=(-temp.y*.5+.5)*rect.height;item.element.hidden=behind||x< -70||x>rect.width+70||y< -30||y>rect.height+30;if(!item.element.hidden){item.element.style.transform=\`translate3d(${'${x}'}px,${'${y}'}px,0) translate(-50%,-50%)\`;item.element.style.opacity=String(clamp(1.18-temp.z*.55,.28,1));}}projectRepositoryLabels(rect,temp);suppressProjectLabelCollisions();}
`;
  return next.replace(projectLabels, replacement);
}

export function composeThreejsRepositoryLabelsPage(html) {
  if (html.includes(STYLE_TAG)) return html;
  if (!html.includes("</head>")) throw new Error("Could not locate Three.js </head> for bounded repository labels");
  return html.replace("</head>", `${STYLE_TAG}\n</head>`);
}
