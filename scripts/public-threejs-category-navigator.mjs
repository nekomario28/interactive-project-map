const MARKER = "/* IPM_THREEJS_CATEGORY_NAVIGATOR_P2 */";
const STYLE_TAG = '<link rel="stylesheet" href="../category-navigator.css">';
const SCRIPT_TAG = '<script src="../threejs-category-navigator.js" defer></script>';

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function composeThreejsCategoryNavigatorRuntime(source) {
  if (source.includes(MARKER)) return source;
  if (!source.includes("IPM_THREEJS_LOCAL_GRAPH_P2") || !source.includes("IPM_THREEJS_SHARED_SEARCH_P2")) {
    throw new Error("Three.js Local Graph and shared search adapters must run before Category Navigator");
  }

  let next = source;
  const searchMarker = "  /* IPM_THREEJS_SHARED_SEARCH_P2 */";
  next = replaceRequired(
    next,
    searchMarker,
    `${searchMarker}\n  ${MARKER}\n  function emitThreejsNavigatorChange(){window.dispatchEvent(new window.CustomEvent("projectmap:threejs-navigator-change"));}`,
    "Three.js shared-search marker",
  );

  const selectTail = 'showDetails(node);appendSearchMatchReason(node);updateFocusControls();}';
  next = replaceRequired(
    next,
    selectTail,
    'showDetails(node);appendSearchMatchReason(node);updateFocusControls();emitThreejsNavigatorChange();}',
    "Three.js selected-node navigator notification",
  );

  const clearTail = 'ui.detailsLink.hidden=true;desiredTarget.set(0,0,0);updateFocusControls();}';
  next = replaceRequired(
    next,
    clearTail,
    'ui.detailsLink.hidden=true;desiredTarget.set(0,0,0);updateFocusControls();emitThreejsNavigatorChange();}',
    "Three.js clear-selection navigator notification",
  );

  const visibilityTail = 'if(selectedMesh&&!selectedMesh.visible)clearSelection();updateFocusControls();syncTransferableState();}';
  next = replaceRequired(
    next,
    visibilityTail,
    'if(selectedMesh&&!selectedMesh.visible)clearSelection();updateFocusControls();syncTransferableState();emitThreejsNavigatorChange();}',
    "Three.js visibility navigator notification",
  );

  const localGraphSnapshot = 'window.ProjectMapThreejsLocalGraph=Object.freeze({version:1,snapshot:()=>({focusRoot,depth:focusDepth,nodeIds:(lastLocalProjection?.nodes||[]).map((node)=>node.id).sort(),edgeIds:[...(lastLocalProjection?.edges||[]),...(lastLocalProjection?.semanticEdges||[])].map((edge)=>`${edge.type||"edge"}:${edge.source}->${edge.target}`).sort()})});';
  const adapter = `const navigatorNodeById=(id)=>graph.nodes.find((node)=>node.id===id)||null,navigatorClearSelection=()=>{clearSelection();ui.canvas.focus({preventScroll:true});return true;},navigatorSelectNode=(id)=>{const mesh=nodeMeshes.get(id);if(!mesh?.visible)return false;if(selectedMesh===mesh)return navigatorClearSelection();selectMesh(mesh);ui.canvas.focus({preventScroll:true});return true;};window.ProjectMapThreejsNavigatorAdapter=Object.freeze({version:1,graph:()=>graph,node:(id)=>navigatorNodeById(id),isVisible:(id)=>Boolean(nodeMeshes.get(id)?.visible),selectedId:()=>selectedMesh?.userData.node?.id||"",selectNode:navigatorSelectNode,clearSelection:navigatorClearSelection,focusCanvas:()=>ui.canvas.focus({preventScroll:true}),snapshot:()=>({selectedId:selectedMesh?.userData.node?.id||"",visibleNodeIds:graph.nodes.filter((node)=>nodeMeshes.get(node.id)?.visible).map((node)=>node.id).sort(),scopeNodeIds:(lastLocalProjection?.nodes||[]).map((node)=>node.id).sort(),search:lastSearchProjection?.snapshot?.()||null})});window.dispatchEvent(new window.CustomEvent("projectmap:threejs-navigator-ready"));${localGraphSnapshot}`;
  next = replaceRequired(next, localGraphSnapshot, adapter, "Three.js navigator adapter export");
  return next;
}

export function composeThreejsCategoryNavigatorPage(html) {
  let next = html;
  if (!next.includes(STYLE_TAG)) {
    if (!next.includes("</head>")) throw new Error("Could not locate Three.js </head> for Category Navigator style");
    next = next.replace("</head>", `${STYLE_TAG}\n</head>`);
  }
  if (!next.includes(SCRIPT_TAG)) {
    if (!next.includes("</body>")) throw new Error("Could not locate Three.js </body> for Category Navigator runtime");
    next = next.replace("</body>", `${SCRIPT_TAG}\n</body>`);
  }
  return next;
}
