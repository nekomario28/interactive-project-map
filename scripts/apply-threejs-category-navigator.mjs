import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  composeThreejsRepositoryLabelsPage,
  composeThreejsRepositoryLabelsRuntime,
} from "./public-threejs-repository-labels.mjs";

const MARKER = "/* IPM_THREEJS_CATEGORY_NAVIGATOR_P2 */";
const STYLE_TAG = '<link rel="stylesheet" href="../category-navigator.css">';
const SCRIPT_TAG = '<script src="../threejs-category-navigator.js" defer></script>';

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function patchThreejsCategoryNavigatorRuntime(source) {
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

export function patchThreejsCategoryNavigatorPage(html) {
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

export async function applyThreejsCategoryNavigator({
  siteDir = join(process.cwd(), "site"),
  sourceDir = join(process.cwd(), "scripts"),
} = {}) {
  const runtimePath = join(siteDir, "threejs-viewer.js");
  const pagePath = join(siteDir, "three", "index.html");
  const navigatorPath = join(siteDir, "threejs-category-navigator.js");
  const repositoryLabelStylePath = join(siteDir, "threejs-repository-labels.css");
  const [runtime, page] = await Promise.all([
    readFile(runtimePath, "utf8"),
    readFile(pagePath, "utf8"),
  ]);
  const navigatorRuntime = patchThreejsCategoryNavigatorRuntime(runtime);
  const nextRuntime = composeThreejsRepositoryLabelsRuntime(navigatorRuntime);
  const navigatorPage = patchThreejsCategoryNavigatorPage(page);
  const nextPage = composeThreejsRepositoryLabelsPage(navigatorPage);
  if (nextRuntime !== runtime) await writeFile(runtimePath, nextRuntime);
  if (nextPage !== page) await writeFile(pagePath, nextPage);
  await Promise.all([
    copyFile(join(sourceDir, "public-threejs-category-navigator.js"), navigatorPath),
    copyFile(join(sourceDir, "public-threejs-repository-labels.css"), repositoryLabelStylePath),
  ]);
  return {
    runtimePath,
    pagePath,
    navigatorPath,
    repositoryLabelStylePath,
    injected: nextRuntime !== runtime || nextPage !== page,
  };
}

async function main() {
  const result = await applyThreejsCategoryNavigator();
  console.log(`Applied Three.js Category Navigator and repository labels to ${result.pagePath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
