import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { projectMapViewModelRuntimeSource } from "./project-map-view-model-runtime.mjs";

const MARKER = "/* IPM_SHARED_SEARCH_CONTEXT_2D */";
const VIEW_MODEL_SCRIPT = '<script src="../project-map-view-model.js" defer></script>';
const POLISH_SCRIPT = '<script src="../interaction-polish.js" defer></script>';
const TWO_D_DIRS = ["u", "radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"];

export function patchInteractionSearchRuntime(source) {
  if (source.includes(MARKER)) return source;
  const start = source.indexOf("  // Shared search semantics for every interactive preset.");
  const end = source.indexOf('  if (typeof matchesQuery === "function") {', start);
  if (start < 0 || end < 0) throw new Error("Could not locate 2D search semantic core boundary");

  const replacement = `  ${MARKER}\n  // The Project Map view-model owns matching semantics. This browser layer only\n  // adapts that pure projection to existing 2D selection/drawing hooks.\n  let cachedSearchQuery = null;\n  let cachedSearchGraph = null;\n  let cachedSearchNodeCount = -1;\n  let cachedSearchContext = null;\n\n  function currentSearchContext() {\n    const api = window.ProjectMapViewModel;\n    if (typeof api?.projectSearchContext !== "function") throw new Error("Project Map view-model must load before search interaction polish");\n    const query = typeof api.normalizeSearchQuery === "function"\n      ? api.normalizeSearchQuery(state.query)\n      : String(state.query || "").normalize("NFKC").toLocaleLowerCase("en-US").trim();\n    const graph = state.graph;\n    const graphNodes = Array.isArray(graph?.nodes) ? graph.nodes : Array.isArray(state.nodes) ? state.nodes : [];\n    if (cachedSearchContext\n      && cachedSearchQuery === query\n      && cachedSearchGraph === graph\n      && cachedSearchNodeCount === graphNodes.length) return cachedSearchContext;\n\n    const shared = api.projectSearchContext(graph || { nodes: graphNodes, edges: [] }, query);\n    if (!shared) throw new Error("Project Map shared search projection is unavailable");\n    const snapshot = shared.snapshot();\n    cachedSearchQuery = query;\n    cachedSearchGraph = graph;\n    cachedSearchNodeCount = graphNodes.length;\n    cachedSearchContext = {\n      query: shared.query,\n      directRepositoryIds: new Set(snapshot.directRepositoryIds),\n      directCategoryIds: new Set(snapshot.directCategoryIds),\n      contextCategoryIds: new Set(snapshot.contextCategoryIds),\n      categoryMemberIds: new Set(snapshot.categoryMemberIds),\n      matchReasons: new Map(Object.entries(snapshot.matchReasons)),\n    };\n    return cachedSearchContext;\n  }\n\n  function searchLevel(node) {\n    const context = currentSearchContext();\n    if (!context.query || !node) return "all";\n    if (node.type === "repository") {\n      if (context.directRepositoryIds.has(node.id)) return "direct";\n      if (context.categoryMemberIds.has(node.id)) return "category-member";\n      return "none";\n    }\n    if (node.type === "group") {\n      if (context.directCategoryIds.has(node.id)) return "direct-category";\n      if (context.contextCategoryIds.has(node.id)) return "category-context";\n    }\n    return "none";\n  }\n\n  function searchContextMatches(node) {\n    return searchLevel(node) !== "none";\n  }\n\n  function searchReasons(nodeOrId) {\n    const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId?.id;\n    return [...(currentSearchContext().matchReasons.get(id) || [])];\n  }\n\n  function directRepositoryNodes() {\n    const context = currentSearchContext();\n    const nodes = Array.isArray(state.nodes) ? state.nodes : Array.isArray(state.graph?.nodes) ? state.graph.nodes : [];\n    return nodes.filter((node) => node?.type === "repository" && context.directRepositoryIds.has(node.id));\n  }\n\n`;

  const patched = `${source.slice(0, start)}${replacement}${source.slice(end)}`;
  for (const legacy of ["function normalizedSearch(", "function groupNodeId(", "function searchText(", "function directMatchReasons(", "function categoryMatches("]) {
    if (patched.includes(legacy)) throw new Error(`Emitted 2D search runtime still contains duplicated semantic helper: ${legacy}`);
  }
  if (!patched.includes("ProjectMapViewModel") || !patched.includes("projectSearchContext")) throw new Error("Could not delegate emitted 2D search runtime to the shared view-model");
  return patched;
}

function attachViewModel(html, path) {
  if (html.includes(VIEW_MODEL_SCRIPT)) return html;
  if (!html.includes(POLISH_SCRIPT)) throw new Error(`Could not locate interaction-polish script in ${path}`);
  return html.replace(POLISH_SCRIPT, `${VIEW_MODEL_SCRIPT}\n${POLISH_SCRIPT}`);
}

export async function applySharedSearchContext2D({ siteDir = join(process.cwd(), "site") } = {}) {
  const runtimePath = join(siteDir, "interaction-polish.js");
  const runtime = await readFile(runtimePath, "utf8");
  const nextRuntime = patchInteractionSearchRuntime(runtime);
  if (nextRuntime !== runtime) await writeFile(runtimePath, nextRuntime);

  const viewModelPath = join(siteDir, "project-map-view-model.js");
  await writeFile(viewModelPath, projectMapViewModelRuntimeSource());

  const changedPages = [];
  for (const dir of TWO_D_DIRS) {
    const htmlPath = join(siteDir, dir, "index.html");
    const html = await readFile(htmlPath, "utf8");
    const next = attachViewModel(html, htmlPath);
    if (next !== html) {
      await writeFile(htmlPath, next);
      changedPages.push(htmlPath);
    }
  }

  return {
    runtimePath,
    viewModelPath,
    changedPages,
    injected: nextRuntime !== runtime || changedPages.length > 0,
  };
}

async function main() {
  const result = await applySharedSearchContext2D();
  console.log(`Delegated 2D search semantics to the Project Map view-model across ${result.changedPages.length} viewer pages`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
