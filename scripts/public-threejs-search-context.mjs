const MARKER = "/* IPM_THREEJS_SHARED_SEARCH_P2 */";

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function patchThreejsSearchContextRuntime(source) {
  if (source.includes(MARKER)) return source;
  if (!source.includes("IPM_THREEJS_LOCAL_GRAPH_P2")) throw new Error("Three.js Local Graph adapter must run before shared search context");

  let next = source;
  const initialState = 'lastLocalProjection=null;';
  next = replaceRequired(next, initialState, 'lastLocalProjection=null,lastSearchProjection=null;', "Three.js shared search state");

  const visibilityPattern = /  function applyVisibility\(\)\{[\s\S]*?\}\n(?=  function resize\(\)\{)/;
  if (!visibilityPattern.test(next)) throw new Error("Could not locate Three.js Local Graph visibility adapter");
  next = next.replace(visibilityPattern, `  ${MARKER}
  function appendSearchMatchReason(node){const reasons=lastSearchProjection?.reasons?.(node)||[];if(!reasons.length)return;const dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent="Match";dd.textContent=reasons.join(" · ");ui.detailsMeta.append(dt,dd);ui.detailsMeta.hidden=false;}
  function directSearchMeshes(){const ids=lastSearchProjection?.directRepositories?.()||[];return ids.map((id)=>nodeMeshes.get(id)).filter((mesh)=>mesh?.visible);}
  function navigateDirectSearch(step){const hits=directSearchMeshes();if(!hits.length)return null;const current=hits.findIndex((mesh)=>mesh===selectedMesh),nextIndex=current<0?(step>0?0:hits.length-1):(current+step+hits.length)%hits.length,target=hits[nextIndex];selectMesh(target);return target;}
  function applyVisibility(){updateStatusControls();const activeStatuses=activeStatusValues(),statusProjected=window.ProjectMapViewModel?.projectByStatuses(graph,activeStatuses);let projected=statusProjected;if(focusRoot){const local=window.ProjectMapViewModel?.projectLocalGraph?.(graph,focusRoot,focusDepth,activeStatuses);if(local)projected=local;else focusRoot="";}lastLocalProjection=projected;const scopeVisibleIds=new Set((projected?.nodes||[]).map((node)=>node.id)),searchProjection=window.ProjectMapViewModel?.projectSearchContext?.(projected||graph,searchQuery)||null;lastSearchProjection=searchProjection;let visibleRepositories=0;const visibleGroupIds=new Set(),visibleGroupLabels=new Set();for(const node of graph.nodes){const mesh=nodeMeshes.get(node.id);if(!mesh||node.type!=="repository")continue;const matchesScope=scopeVisibleIds.has(node.id),matchesSearch=!searchQuery||(searchProjection?searchProjection.matches(node):searchableText(node).includes(searchQuery));mesh.visible=matchesScope&&matchesSearch;if(mesh.visible){visibleRepositories+=1;if(node.groupId)visibleGroupIds.add(node.groupId);if(node.groupLabel)visibleGroupLabels.add(node.groupLabel);}}for(const node of graph.nodes){if(node.type!=="group")continue;const mesh=nodeMeshes.get(node.id);if(!mesh)continue;const matchesScope=scopeVisibleIds.has(node.id),fallbackSearch=visibleGroupIds.has(node.id)||visibleGroupIds.has(node.id.replace(/^group:/,""))||visibleGroupLabels.has(node.label)||node.label.toLowerCase().includes(searchQuery),matchesSearch=!searchQuery||(searchProjection?searchProjection.matches(node):fallbackSearch);mesh.visible=matchesScope&&matchesSearch;}rebuildEdges();const totalRepositories=graph.nodes.filter((node)=>node.type==="repository").length;ui.resultCount.textContent=\`${'${visibleRepositories}'} / ${'${totalRepositories}'} ${'${totalRepositories===1?"project":"projects"}'}\`;if(selectedMesh&&!selectedMesh.visible)clearSelection();updateFocusControls();syncTransferableState();}
`);

  const selectTail = 'desiredDistance=node.type==="owner"?132:node.type==="group"?82:56;showDetails(node);updateFocusControls();}';
  next = replaceRequired(next, selectTail, 'desiredDistance=node.type==="owner"?132:node.type==="group"?82:56;showDetails(node);appendSearchMatchReason(node);updateFocusControls();}', "Three.js search match details");

  const inputHandler = 'ui.search.addEventListener("input",()=>{searchQuery=ui.search.value.normalize("NFKC").toLocaleLowerCase("en-US").trim();applyVisibility();});';
  const sharedApi = `window.ProjectMapSearchContext=Object.freeze({snapshot:()=>lastSearchProjection?.snapshot?.()||{query:searchQuery,directRepositoryIds:[],directCategoryIds:[],contextCategoryIds:[],categoryMemberIds:[],matchReasons:{}},level:(nodeOrId)=>lastSearchProjection?.level?.(nodeOrId)??(searchQuery?"none":"all"),matches:(nodeOrId)=>lastSearchProjection?.matches?.(nodeOrId)??!searchQuery,reasons:(nodeOrId)=>lastSearchProjection?.reasons?.(nodeOrId)||[],directRepositories:()=>lastSearchProjection?.directRepositories?.()||[]});${inputHandler}ui.search.addEventListener("keydown",(event)=>{if(event.isComposing)return;if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();navigateDirectSearch(event.key==="ArrowDown"?1:-1);return;}if(event.key!=="Enter")return;const hits=directSearchMeshes();if(!hits.length)return;event.preventDefault();const target=hits.find((mesh)=>mesh===selectedMesh)||hits[0];if(selectedMesh!==target)selectMesh(target);const node=target.userData.node;if(node?.url)window.open(node.url,"_blank","noopener");});`;
  next = replaceRequired(next, inputHandler, sharedApi, "Three.js shared search browser API and keyboard navigation");
  return next;
}
