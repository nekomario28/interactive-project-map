import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const TWO_D_MARKER = "/* IPM_COMMON_RENDERER_SNAPSHOT_2D_V1 */";
const THREE_D_MARKER = "/* IPM_COMMON_RENDERER_SNAPSHOT_3D_V1 */";

const TWO_D_END = "\n  }\n\n  window.ProjectMapViewState = Object.freeze({ motionOff, snapshot: () => ({ motionOff: motionOff() }) });";
const TWO_D_ADAPTER = `
    ${TWO_D_MARKER}
    function rendererEvidenceSnapshot() {
      const api = window.ProjectMapViewModel;
      if (typeof api?.createRendererSnapshot !== "function") return null;
      const repositories = visibleRepositories();
      const repositoryIds = new Set(repositories.map((node) => node.id));
      const groupIds = new Set();
      for (const node of repositories) {
        if (node.relation === "contributed" || !node.groupId) continue;
        const groupId = String(node.groupId);
        groupIds.add(groupId.startsWith("group:") ? groupId : \`group:\${groupId}\`);
      }
      for (const edge of state.graph?.edges || []) {
        if (edge?.type === "membership" && repositoryIds.has(edge.target)) groupIds.add(edge.source);
      }
      const rect = canvas.getBoundingClientRect();
      return api.createRendererSnapshot({
        rendererId: "canvas2d",
        styleId: state.style || document.body.dataset.mapStyle || null,
        experimental: false,
        semantic: { repositories: repositories.length, groups: groupIds.size },
        selectedId: state.selected?.id || null,
        capabilities: {
          categoryNavigation: true,
          localGraph: true,
          motion: true,
          qualityEvidence: true,
          repositoryLabels: true,
          search: true,
          selection: true,
          statusFilters: true,
        },
        viewport: { width: rect.width, height: rect.height },
        backingStore: { width: canvas.width, height: canvas.height },
      });
    }
    window.ProjectMapRenderer = Object.freeze({ version: 1, snapshot: rendererEvidenceSnapshot });
`;

const THREE_D_INITIAL = 'rebuildEdges();applyVisibility();fitScene(true);resize();ui.motion.setAttribute("aria-pressed",String(motionEnabled));ui.motion.textContent=motionEnabled?"Motion On":"Motion Off";animationFrame=requestAnimationFrame(animate);';
const THREE_D_INITIAL_WITH_ADAPTER = `rebuildEdges();applyVisibility();fitScene(true);resize();ui.motion.setAttribute("aria-pressed",String(motionEnabled));ui.motion.textContent=motionEnabled?"Motion On":"Motion Off";${THREE_D_MARKER}window.ProjectMapRenderer=Object.freeze({version:1,snapshot:()=>{const api=window.ProjectMapViewModel;if(typeof api?.createRendererSnapshot!=="function")return null;let repositories=0,groups=0;for(const node of graph.nodes){const mesh=nodeMeshes.get(node.id);if(!mesh?.visible)continue;if(node.type==="repository")repositories+=1;else if(node.type==="group")groups+=1;}const rect=ui.canvas.getBoundingClientRect();return api.createRendererSnapshot({rendererId:"threejs",styleId:currentThreeStyle(),experimental:true,semantic:{repositories,groups},selectedId:selectedMesh?.userData?.node?.id||null,capabilities:{categoryNavigation:true,localGraph:false,motion:true,qualityEvidence:false,repositoryLabels:true,search:true,selection:true,statusFilters:true},viewport:{width:rect.width,height:rect.height},backingStore:{width:ui.canvas.width,height:ui.canvas.height}});}});animationFrame=requestAnimationFrame(animate);`;

export function patchTwoDRendererSnapshot(source) {
  if (source.includes(TWO_D_MARKER)) return source;
  if (!source.includes(TWO_D_END)) throw new Error("Could not locate 2D view-state adapter insertion point");
  return source.replace(TWO_D_END, `${TWO_D_ADAPTER}${TWO_D_END}`);
}

export function patchThreeDRendererSnapshot(source) {
  if (source.includes(THREE_D_MARKER)) return source;
  if (!source.includes(THREE_D_INITIAL)) throw new Error("Could not locate Three.js renderer snapshot insertion point");
  return source.replace(THREE_D_INITIAL, THREE_D_INITIAL_WITH_ADAPTER);
}

export async function applyRendererSnapshot({ siteDir = join(process.cwd(), "site") } = {}) {
  const twoDPath = join(siteDir, "view-state.js");
  const threeDPath = join(siteDir, "threejs-viewer.js");
  const [twoDSource, threeDSource] = await Promise.all([readFile(twoDPath, "utf8"), readFile(threeDPath, "utf8")]);
  const twoDNext = patchTwoDRendererSnapshot(twoDSource);
  const threeDNext = patchThreeDRendererSnapshot(threeDSource);
  await Promise.all([
    twoDNext !== twoDSource ? writeFile(twoDPath, twoDNext) : Promise.resolve(),
    threeDNext !== threeDSource ? writeFile(threeDPath, threeDNext) : Promise.resolve(),
  ]);
  return { twoDPath, threeDPath, changed: twoDNext !== twoDSource || threeDNext !== threeDSource };
}

async function main() {
  const result = await applyRendererSnapshot();
  console.log(`Applied common renderer snapshot contract${result.changed ? "" : " (already present)"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
