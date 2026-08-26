import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { projectMapViewModelRuntimeSource } from "./project-map-view-model-runtime.mjs";
import { projectMapViewStateRuntimeSource } from "./project-map-view-state-runtime.mjs";

const THREE_CDN_ORIGIN = "https://cdn.jsdelivr.net";

const THREE_BOOT_SANITIZER = "const graph=sanitizeGraph(await response.json(),username);";
const SHARED_BOOT_SANITIZER = "const graph=window.ProjectMapViewModel?.sanitizeGraph(await response.json(),username);";
const THREE_VISIBILITY = 'function applyVisibility(){let visibleRepositories=0;const visibleGroupIds=new Set(),visibleGroupLabels=new Set();for(const node of graph.nodes){const mesh=nodeMeshes.get(node.id);if(!mesh||node.type!=="repository")continue;const status=repositoryStatus(node),matchesFilter=filters.get(status)!==false,matchesSearch=!searchQuery||searchableText(node).includes(searchQuery);mesh.visible=matchesFilter&&matchesSearch;if(mesh.visible){visibleRepositories+=1;if(node.groupId)visibleGroupIds.add(node.groupId);if(node.groupLabel)visibleGroupLabels.add(node.groupLabel);}}for(const node of graph.nodes){if(node.type!=="group")continue;const mesh=nodeMeshes.get(node.id);if(!mesh)continue;mesh.visible=!searchQuery||visibleGroupIds.has(node.id)||visibleGroupIds.has(node.id.replace(/^group:/,""))||visibleGroupLabels.has(node.label)||node.label.toLowerCase().includes(searchQuery);}rebuildEdges();const totalRepositories=graph.nodes.filter((node)=>node.type==="repository").length;ui.resultCount.textContent=`${visibleRepositories} / ${totalRepositories} ${totalRepositories===1?"project":"projects"}`;if(selectedMesh&&!selectedMesh.visible)clearSelection();}';
const P0_VISIBILITY = 'function applyVisibility(){const activeStatuses=[...filters].filter(([,enabled])=>enabled).map(([status])=>status),projected=window.ProjectMapViewModel?.projectByStatuses(graph,activeStatuses),statusVisibleIds=new Set((projected?.nodes||[]).map((node)=>node.id));let visibleRepositories=0;const visibleGroupIds=new Set(),visibleGroupLabels=new Set();for(const node of graph.nodes){const mesh=nodeMeshes.get(node.id);if(!mesh||node.type!=="repository")continue;const matchesStatus=statusVisibleIds.has(node.id),matchesSearch=!searchQuery||searchableText(node).includes(searchQuery);mesh.visible=matchesStatus&&matchesSearch;if(mesh.visible){visibleRepositories+=1;if(node.groupId)visibleGroupIds.add(node.groupId);if(node.groupLabel)visibleGroupLabels.add(node.groupLabel);}}for(const node of graph.nodes){if(node.type!=="group")continue;const mesh=nodeMeshes.get(node.id);if(!mesh)continue;const matchesStatus=statusVisibleIds.has(node.id);mesh.visible=matchesStatus&&(!searchQuery||visibleGroupIds.has(node.id)||visibleGroupIds.has(node.id.replace(/^group:/,""))||visibleGroupLabels.has(node.label)||node.label.toLowerCase().includes(searchQuery));}rebuildEdges();const totalRepositories=graph.nodes.filter((node)=>node.type==="repository").length;ui.resultCount.textContent=`${visibleRepositories} / ${totalRepositories} ${totalRepositories===1?"project":"projects"}`;if(selectedMesh&&!selectedMesh.visible)clearSelection();}';
const P1_VISIBILITY = 'function statusLabel(value){return value==="original"?"Original":value==="fork"?"Fork":value==="archived"?"Archived":"Contributed";}function activeStatusValues(){return [...filters].filter(([,enabled])=>enabled).map(([status])=>status);}function updateStatusControls(){const counts=window.ProjectMapViewModel?.statusCounts(graph)||{},available=[...filters.keys()].filter((status)=>(counts[status]||0)>0);for(const status of filters.keys())if((counts[status]||0)===0)filters.set(status,false);if(available.length&&!available.some((status)=>filters.get(status)!==false))filters.set(available[0],true);for(const button of ui.statusButtons){const status=button.dataset.statusFilter,count=counts[status]||0,label=statusLabel(status),active=filters.get(status)!==false;button.disabled=count===0;button.dataset.statusCount=String(count);button.setAttribute("aria-pressed",String(active));button.setAttribute("aria-label",`${label} repositories: ${count}. ${count?"Toggle visibility.":"None are available in this map."}`);button.textContent=`${label} ${count}`;button.title=count?`${count} ${label.toLowerCase()} repositories in this map.`:`No ${label.toLowerCase()} repositories are available in this map.`;}return available;}function syncTransferableState(){const api=window.ProjectMapTransferableState;if(!api)return;const available=updateStatusControls(),current=api.parse(location.href),state={...current,username,q:searchQuery,statuses:activeStatusValues(),motionOff:!motionEnabled},next=api.applyToUrl(new URL(location.href),state,{availableStatuses:available});history.replaceState(null,"",next);const fallback=api.applyToUrl(new URL("../u/",location.href),state,{availableStatuses:available});fallback.searchParams.delete("render");ui.fallbackLink.href=fallback.toString();ui.twoDLink.href=fallback.toString();}function applyVisibility(){updateStatusControls();const activeStatuses=activeStatusValues(),projected=window.ProjectMapViewModel?.projectByStatuses(graph,activeStatuses),statusVisibleIds=new Set((projected?.nodes||[]).map((node)=>node.id));let visibleRepositories=0;const visibleGroupIds=new Set(),visibleGroupLabels=new Set();for(const node of graph.nodes){const mesh=nodeMeshes.get(node.id);if(!mesh||node.type!=="repository")continue;const matchesStatus=statusVisibleIds.has(node.id),matchesSearch=!searchQuery||searchableText(node).includes(searchQuery);mesh.visible=matchesStatus&&matchesSearch;if(mesh.visible){visibleRepositories+=1;if(node.groupId)visibleGroupIds.add(node.groupId);if(node.groupLabel)visibleGroupLabels.add(node.groupLabel);}}for(const node of graph.nodes){if(node.type!=="group")continue;const mesh=nodeMeshes.get(node.id);if(!mesh)continue;const matchesStatus=statusVisibleIds.has(node.id);mesh.visible=matchesStatus&&(!searchQuery||visibleGroupIds.has(node.id)||visibleGroupIds.has(node.id.replace(/^group:/,""))||visibleGroupLabels.has(node.label)||node.label.toLowerCase().includes(searchQuery));}rebuildEdges();const totalRepositories=graph.nodes.filter((node)=>node.type==="repository").length;ui.resultCount.textContent=`${visibleRepositories} / ${totalRepositories} ${totalRepositories===1?"project":"projects"}`;if(selectedMesh&&!selectedMesh.visible)clearSelection();syncTransferableState();}';

const SCENE_START = "function createSceneRuntime(THREE,graph,username){";
const P1_SCENE_START = "function createSceneRuntime(THREE,graph,username){const initialViewState=window.ProjectMapTransferableState?.parse(location.href)||{};";
const CAMERA_STATE = 'selectedMesh=null,quality="auto",motionEnabled=!matchMedia("(prefers-reduced-motion: reduce)").matches,animationFrame=0';
const P1_CAMERA_STATE = 'selectedMesh=null,quality=(["auto","high","low"].includes(new URL(location.href).searchParams.get("render"))?new URL(location.href).searchParams.get("render"):"auto"),motionEnabled=!initialViewState.motionOff&&!matchMedia("(prefers-reduced-motion: reduce)").matches,animationFrame=0';
const FILTER_STATE = 'const filters=new Map(ui.statusButtons.map((button)=>[button.dataset.statusFilter,true]));let searchQuery="";';
const P1_FILTER_STATE = 'const initialStatuses=new Set(initialViewState.statuses||[]),filters=new Map(ui.statusButtons.map((button)=>[button.dataset.statusFilter,initialStatuses.size?initialStatuses.has(button.dataset.statusFilter):true]));let searchQuery=String(initialViewState.q||"").normalize("NFKC").toLocaleLowerCase("en-US").trim();if(initialViewState.q)ui.search.value=initialViewState.q;';
const QUALITY_SELECTOR = 'quality: document.getElementById("qualityToggle"),';
const RENDER_SELECTOR = 'quality: document.getElementById("renderDensityToggle"),';
const QUALITY_SETTER = 'function setQuality(next){quality=next;ui.quality.dataset.quality=next;ui.quality.textContent=`Quality ${next[0].toUpperCase()}${next.slice(1)}`;resize();}';
const RENDER_SETTER = 'function setQuality(next){quality=next;ui.quality.dataset.renderDensity=next;ui.quality.textContent=`Render ${next[0].toUpperCase()}${next.slice(1)}`;const url=new URL(location.href);if(next==="auto")url.searchParams.delete("render");else url.searchParams.set("render",next);history.replaceState(null,"",url);resize();}';
const MOTION_TOGGLE = 'function toggleMotion(){motionEnabled=!motionEnabled;ui.motion.setAttribute("aria-pressed",String(motionEnabled));ui.motion.textContent=motionEnabled?"Motion On":"Motion Off";}';
const P1_MOTION_TOGGLE = 'function toggleMotion(){motionEnabled=!motionEnabled;ui.motion.setAttribute("aria-pressed",String(motionEnabled));ui.motion.textContent=motionEnabled?"Motion On":"Motion Off";syncTransferableState();}';
const INPUT_HANDLERS = 'ui.search.addEventListener("input",()=>{searchQuery=ui.search.value.trim().toLowerCase();applyVisibility();});for(const button of ui.statusButtons)button.addEventListener("click",()=>{const key=button.dataset.statusFilter,next=filters.get(key)===false;filters.set(key,next);button.setAttribute("aria-pressed",String(next));applyVisibility();});';
const P1_INPUT_HANDLERS = 'ui.search.addEventListener("input",()=>{searchQuery=ui.search.value.normalize("NFKC").toLocaleLowerCase("en-US").trim();applyVisibility();});for(const button of ui.statusButtons)button.addEventListener("click",()=>{if(button.disabled)return;const key=button.dataset.statusFilter,next=filters.get(key)===false;filters.set(key,next);button.setAttribute("aria-pressed",String(next));applyVisibility();});';
const INITIAL_RENDER = 'rebuildEdges();applyVisibility();fitScene(true);resize();ui.motion.setAttribute("aria-pressed",String(motionEnabled));ui.motion.textContent=motionEnabled?"Motion On":"Motion Off";animationFrame=requestAnimationFrame(animate);';
const P1_INITIAL_RENDER = 'rebuildEdges();applyVisibility();fitScene(true);setQuality(quality);ui.motion.setAttribute("aria-pressed",String(motionEnabled));ui.motion.textContent=motionEnabled?"Motion On":"Motion Off";animationFrame=requestAnimationFrame(animate);';
const FALLBACK_SETUP = 'document.title=`${username} · Three.js Cosmic Lab`;ui.title.textContent=`${username} · Project Map`;ui.canvas.setAttribute("aria-label",`Experimental Three.js project galaxy for ${username}`);const fallback=new URL("../u/",location.href);fallback.searchParams.set("username",username);ui.fallbackLink.href=fallback.toString();ui.twoDLink.href=fallback.toString();';
const P1_FALLBACK_SETUP = 'document.title=`${username} · Three.js Cosmic Lab`;ui.title.textContent=`${username} · Project Map`;ui.canvas.setAttribute("aria-label",`Experimental Three.js project galaxy for ${username}`);const stateApi=window.ProjectMapTransferableState,fallback=stateApi?stateApi.transfer(location.href,new URL("../u/",location.href),{username}):new URL(`../u/?username=${encodeURIComponent(username)}`,location.href);fallback.searchParams.delete("render");ui.fallbackLink.href=fallback.toString();ui.twoDLink.href=fallback.toString();';

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function patchThreejsViewModelRuntime(source) {
  let next = replaceRequired(source, THREE_BOOT_SANITIZER, SHARED_BOOT_SANITIZER, "Three.js graph admission boundary");
  if (next.includes(THREE_VISIBILITY)) next = next.replace(THREE_VISIBILITY, P1_VISIBILITY);
  else next = replaceRequired(next, P0_VISIBILITY, P1_VISIBILITY, "Three.js status projection boundary");
  next = replaceRequired(next, SCENE_START, P1_SCENE_START, "Three.js transferable state startup");
  next = replaceRequired(next, CAMERA_STATE, P1_CAMERA_STATE, "Three.js motion and render-density state");
  next = replaceRequired(next, FILTER_STATE, P1_FILTER_STATE, "Three.js initial search/status state");
  next = replaceRequired(next, QUALITY_SELECTOR, RENDER_SELECTOR, "Three.js render-density control selector");
  next = replaceRequired(next, QUALITY_SETTER, RENDER_SETTER, "Three.js render-density control copy");
  next = replaceRequired(next, MOTION_TOGGLE, P1_MOTION_TOGGLE, "Three.js motion state synchronization");
  next = replaceRequired(next, INPUT_HANDLERS, P1_INPUT_HANDLERS, "Three.js search/status state synchronization");
  next = replaceRequired(next, INITIAL_RENDER, P1_INITIAL_RENDER, "Three.js initial render-density state");
  return replaceRequired(next, FALLBACK_SETUP, P1_FALLBACK_SETUP, "Three.js 2D fallback state transfer");
}

export function renderThreejsLabPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="description" content="Experimental Three.js depth view for Interactive Project Map." />
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' ${THREE_CDN_ORIGIN}; style-src 'self'; connect-src https://raw.githubusercontent.com ${THREE_CDN_ORIGIN}; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'" />
<title>Three.js Cosmic Lab · Interactive Project Map</title>
<link rel="stylesheet" href="../viewer.css" />
<link rel="stylesheet" href="../threejs-viewer.css" />
</head>
<body data-map-style="threejs-cosmic">
<main class="app three-app">
  <header class="toolbar three-toolbar">
    <div class="title-block">
      <div class="three-title-row"><span class="lab-badge">3D LAB</span><span class="engine-badge">Three.js · WebGL</span></div>
      <h1 id="title">Interactive Project Map</h1>
      <p id="subtitle">Loading a depth-aware project galaxy…</p>
    </div>
    <div class="controls three-controls">
      <label class="field three-search"><span>Search</span><input id="search" type="search" placeholder="Project, category, language or topic" autocomplete="off" /></label>
      <div class="control-cluster status-cluster" role="group" aria-label="Repository status filters">
        <button type="button" data-status-filter="original" aria-pressed="true">Original</button>
        <button type="button" data-status-filter="fork" aria-pressed="true">Fork</button>
        <button type="button" data-status-filter="archived" aria-pressed="true">Archived</button>
        <button type="button" data-status-filter="contributed" aria-pressed="true">Contributed</button>
      </div>
      <button id="motionToggle" type="button" aria-pressed="true">Motion On</button>
      <button id="renderDensityToggle" type="button" data-render-density="auto" title="Adjust WebGL backing-store density without changing repository Quality evidence.">Render Auto</button>
      <button id="fit" type="button">Fit</button>
      <button id="reset" type="button">Reset</button>
      <a id="twoDLink" class="three-link-button" href="../u/">2D Map</a>
      <span id="resultCount" class="result-count" aria-live="polite"></span>
    </div>
  </header>
  <section class="workspace three-workspace">
    <canvas id="galaxy3d" tabindex="0" aria-label="Experimental Three.js project galaxy"></canvas>
    <div class="three-nebula-wash" aria-hidden="true"></div>
    <div id="threeLabels" class="three-label-layer" aria-hidden="true"></div>
    <aside id="details" class="details three-details" aria-live="polite">
      <button id="detailsClose" class="details-close" type="button" aria-label="Close project details">×</button>
      <div class="details-kicker">THREE-DIMENSIONAL VIEW</div>
      <h2 id="detailsTitle">Project map</h2>
      <p id="detailsDescription">Select a project sphere to inspect it.</p>
      <dl id="detailsMeta" hidden></dl>
      <a id="detailsLink" href="https://github.com/" target="_blank" rel="noopener" hidden>Open on GitHub ↗</a>
    </aside>
    <div class="legend three-legend">
      <span><i class="owner"></i>Owner</span><span><i class="group"></i>Category</span><span><i class="original"></i>Original</span><span><i class="fork"></i>Fork</span><span><i class="archived"></i>Archived</span><span><i class="relation"></i>Contributed</span>
    </div>
    <div id="tip" class="tip three-tip" role="status" hidden></div>
    <div id="status" class="status three-status">Loading Three.js engine…</div>
    <div id="error" class="error three-error" role="alert">
      <div id="errorText">Could not load the Three.js view.</div>
      <a id="fallbackLink" href="../u/">Open the current 2D viewer instead</a>
    </div>
    <div class="three-depth-markers" aria-hidden="true"><span>NEAR</span><span>MID</span><span>DEEP SPACE</span></div>
  </section>
  <footer><span>Experimental renderer · canonical graph remains unchanged</span><span class="shortcuts"><kbd>drag</kbd> Orbit · <kbd>wheel</kbd> Dolly · <kbd>0</kbd> Fit · <kbd>Enter</kbd> Open · <kbd>Esc</kbd> Close</span></footer>
</main>
<script src="../project-map-view-state.js"></script>
<script src="../project-map-view-model.js"></script>
<script type="module" src="../threejs-viewer.js"></script>
</body>
</html>`;
}

export async function buildThreejsLab({ siteDir = join(process.cwd(), "site"), sourceDir = join(process.cwd(), "scripts") } = {}) {
  const threeDir = join(siteDir, "three");
  await mkdir(threeDir, { recursive: true });
  const [sourceRuntime, css] = await Promise.all([
    readFile(join(sourceDir, "public-threejs-viewer.js"), "utf8"),
    readFile(join(sourceDir, "public-threejs-viewer.css"), "utf8"),
  ]);
  const runtime = patchThreejsViewModelRuntime(sourceRuntime);
  const viewModelRuntime = projectMapViewModelRuntimeSource();
  const viewStateRuntime = projectMapViewStateRuntimeSource();
  await Promise.all([
    writeFile(join(siteDir, "project-map-view-model.js"), viewModelRuntime),
    writeFile(join(siteDir, "project-map-view-state.js"), viewStateRuntime),
    writeFile(join(siteDir, "threejs-viewer.js"), runtime),
    writeFile(join(siteDir, "threejs-viewer.css"), css),
    writeFile(join(threeDir, "index.html"), renderThreejsLabPage()),
  ]);
  return {
    threeDir,
    viewModelRuntimePath: join(siteDir, "project-map-view-model.js"),
    viewStateRuntimePath: join(siteDir, "project-map-view-state.js"),
    runtimePath: join(siteDir, "threejs-viewer.js"),
    cssPath: join(siteDir, "threejs-viewer.css"),
  };
}

async function main() {
  const result = await buildThreejsLab();
  console.log(`Built experimental Three.js cosmic lab into ${result.threeDir}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
