const MARKER = "/* IPM_THREEJS_LOCAL_GRAPH_P2 */";

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function patchThreejsLocalGraphRuntime(source) {
  if (source.includes(MARKER)) return source;
  let next = source;

  const statusButtons = '  statusButtons: [...document.querySelectorAll("[data-status-filter]")],';
  next = replaceRequired(next, statusButtons, `${statusButtons}
  focusButton: document.getElementById("focusButton"),
  focusControls: document.getElementById("focusControls"),
  focusLabel: document.getElementById("focusLabel"),
  focusDepthButtons: [...document.querySelectorAll("[data-focus-depth]")],
  exitFocus: document.getElementById("exitFocus"),`, "Three.js Local Graph controls");

  const initialSearch = 'let searchQuery=String(initialViewState.q||"").normalize("NFKC").toLocaleLowerCase("en-US").trim();if(initialViewState.q)ui.search.value=initialViewState.q;';
  next = replaceRequired(next, initialSearch, `${initialSearch}let focusRoot=String(initialViewState.focus||"").slice(0,180),focusDepth=Math.max(1,Math.min(3,Math.round(Number(initialViewState.depth)||1))),lastLocalProjection=null;`, "Three.js Local Graph initial state");

  const visibilityPattern = /  function statusLabel\(value\)\{[\s\S]*?(?=  function resize\(\)\{)/;
  if (!visibilityPattern.test(next)) throw new Error("Could not locate Three.js P1 visibility adapter");
  next = next.replace(visibilityPattern, `  ${MARKER}
  function statusLabel(value){return value==="original"?"Original":value==="fork"?"Fork":value==="archived"?"Archived":"Contributed";}
  function activeStatusValues(){return [...filters].filter(([,enabled])=>enabled).map(([status])=>status);}
  function updateStatusControls(){const counts=window.ProjectMapViewModel?.statusCounts(graph)||{},available=[...filters.keys()].filter((status)=>(counts[status]||0)>0);for(const status of filters.keys())if((counts[status]||0)===0)filters.set(status,false);if(available.length&&!available.some((status)=>filters.get(status)!==false))filters.set(available[0],true);for(const button of ui.statusButtons){const status=button.dataset.statusFilter,count=counts[status]||0,label=statusLabel(status),active=filters.get(status)!==false;button.disabled=count===0;button.dataset.statusCount=String(count);button.setAttribute("aria-pressed",String(active));button.setAttribute("aria-label",\`${'${label}'} repositories: ${'${count}'}. ${'${count?"Toggle visibility.":"None are available in this map."}'}\`);button.textContent=\`${'${label}'} ${'${count}'}\`;button.title=count?\`${'${count}'} ${'${label.toLowerCase()}'} repositories in this map.\`:\`No ${'${label.toLowerCase()}'} repositories are available in this map.\`;}return available;}
  function updateFocusControls(){const selected=selectedMesh?.userData.node,selectedRepository=selected?.type==="repository"?selected:null;ui.focusButton.hidden=!selectedRepository;if(selectedRepository)ui.focusButton.textContent=focusRoot===selectedRepository.id?"Exit focus":focusRoot?"Focus here":"Focus";ui.focusControls.hidden=!focusRoot;const rootNode=graph.nodes.find((node)=>node.id===focusRoot);ui.focusLabel.textContent=rootNode?\`Focus: ${'${rootNode.label}'}\`:"Focus";for(const button of ui.focusDepthButtons)button.setAttribute("aria-pressed",String(Number(button.dataset.focusDepth)===focusDepth));}
  function syncTransferableState(){const api=window.ProjectMapTransferableState;if(!api)return;const available=updateStatusControls(),current=api.parse(location.href),state={...current,username,q:searchQuery,statuses:activeStatusValues(),motionOff:!motionEnabled,focus:focusRoot,depth:focusDepth},next=api.applyToUrl(new URL(location.href),state,{availableStatuses:available});history.replaceState(null,"",next);const fallback=api.applyToUrl(new URL("../u/",location.href),state,{availableStatuses:available});fallback.searchParams.delete("render");ui.fallbackLink.href=fallback.toString();ui.twoDLink.href=fallback.toString();}
  function applyVisibility(){updateStatusControls();const activeStatuses=activeStatusValues(),statusProjected=window.ProjectMapViewModel?.projectByStatuses(graph,activeStatuses);let projected=statusProjected;if(focusRoot){const local=window.ProjectMapViewModel?.projectLocalGraph?.(graph,focusRoot,focusDepth,activeStatuses);if(local)projected=local;else focusRoot="";}lastLocalProjection=projected;const scopeVisibleIds=new Set((projected?.nodes||[]).map((node)=>node.id));let visibleRepositories=0;const visibleGroupIds=new Set(),visibleGroupLabels=new Set();for(const node of graph.nodes){const mesh=nodeMeshes.get(node.id);if(!mesh||node.type!=="repository")continue;const matchesScope=scopeVisibleIds.has(node.id),matchesSearch=!searchQuery||searchableText(node).includes(searchQuery);mesh.visible=matchesScope&&matchesSearch;if(mesh.visible){visibleRepositories+=1;if(node.groupId)visibleGroupIds.add(node.groupId);if(node.groupLabel)visibleGroupLabels.add(node.groupLabel);}}for(const node of graph.nodes){if(node.type!=="group")continue;const mesh=nodeMeshes.get(node.id);if(!mesh)continue;const matchesScope=scopeVisibleIds.has(node.id);mesh.visible=matchesScope&&(!searchQuery||visibleGroupIds.has(node.id)||visibleGroupIds.has(node.id.replace(/^group:/,""))||visibleGroupLabels.has(node.label)||node.label.toLowerCase().includes(searchQuery));}rebuildEdges();const totalRepositories=graph.nodes.filter((node)=>node.type==="repository").length;ui.resultCount.textContent=\`${'${visibleRepositories}'} / ${'${totalRepositories}'} ${'${totalRepositories===1?"project":"projects"}'}\`;if(selectedMesh&&!selectedMesh.visible)clearSelection();updateFocusControls();syncTransferableState();}
`);

  const selectTail = 'desiredDistance=node.type==="owner"?132:node.type==="group"?82:56;showDetails(node);}';
  next = replaceRequired(next, selectTail, 'desiredDistance=node.type==="owner"?132:node.type==="group"?82:56;showDetails(node);updateFocusControls();}', "Three.js selection Local Graph control update");
  const clearTail = 'ui.detailsLink.hidden=true;desiredTarget.set(0,0,0);}';
  next = replaceRequired(next, clearTail, 'ui.detailsLink.hidden=true;desiredTarget.set(0,0,0);updateFocusControls();}', "Three.js clear-selection Local Graph control update");

  const fitHandler = 'ui.fit.addEventListener("click",()=>fitScene(false));';
  const focusHandlers = `ui.focusButton.addEventListener("click",()=>{const node=selectedMesh?.userData.node;if(node?.type!=="repository")return;focusRoot=focusRoot===node.id?"":node.id;applyVisibility();if(focusRoot&&selectedMesh){desiredTarget.copy(selectedMesh.position);desiredDistance=Math.min(desiredDistance,82);}else fitScene(false);});for(const button of ui.focusDepthButtons)button.addEventListener("click",()=>{const nextDepth=Math.max(1,Math.min(3,Number(button.dataset.focusDepth)||1));if(!focusRoot||nextDepth===focusDepth)return;focusDepth=nextDepth;applyVisibility();});ui.exitFocus.addEventListener("click",()=>{if(!focusRoot)return;focusRoot="";applyVisibility();fitScene(false);});${fitHandler}`;
  next = replaceRequired(next, fitHandler, focusHandlers, "Three.js Local Graph event handlers");

  const initialRender = 'rebuildEdges();applyVisibility();fitScene(true);setQuality(quality);ui.motion.setAttribute("aria-pressed",String(motionEnabled));ui.motion.textContent=motionEnabled?"Motion On":"Motion Off";animationFrame=requestAnimationFrame(animate);';
  const snapshot = 'window.ProjectMapThreejsLocalGraph=Object.freeze({version:1,snapshot:()=>({focusRoot,depth:focusDepth,nodeIds:(lastLocalProjection?.nodes||[]).map((node)=>node.id).sort(),edgeIds:[...(lastLocalProjection?.edges||[]),...(lastLocalProjection?.semanticEdges||[])].map((edge)=>`${edge.type||"edge"}:${edge.source}->${edge.target}`).sort()})});';
  next = replaceRequired(next, initialRender, `${snapshot}${initialRender}`, "Three.js Local Graph evidence snapshot");
  return next;
}

export function patchThreejsLocalGraphPage(html) {
  if (html.includes('id="focusButton"')) return html;
  const anchor = '      <button id="motionToggle" type="button" aria-pressed="true">Motion On</button>';
  if (!html.includes(anchor)) throw new Error("Could not locate Three.js toolbar motion control");
  const controls = `      <button id="focusButton" type="button" hidden>Focus</button>
      <span id="focusControls" role="group" aria-label="Local Graph depth" hidden>
        <span id="focusLabel">Focus</span>
        <button type="button" data-focus-depth="1" aria-pressed="true">1</button>
        <button type="button" data-focus-depth="2" aria-pressed="false">2</button>
        <button type="button" data-focus-depth="3" aria-pressed="false">3</button>
        <button id="exitFocus" type="button">Exit focus</button>
      </span>
`;
  return html.replace(anchor, `${controls}${anchor}`);
}
