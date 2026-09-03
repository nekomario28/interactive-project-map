import { copyFile, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  DEFAULT_FORCE_SETTINGS,
  hashText,
  linkForceEdges,
  normalizeWeightedEdges,
  stepForceLayout,
} from "../packages/spatial-core/src/index.js";

// Keep generated consumer workflows on the reviewed immutable Action release.
// Taxonomy artifact-identity F passed Verify #1054 and exact real-profile Action proof #203.
export const PUBLIC_ACTION_REF = "9d018370d7b22d82d8974ae1ac018de5589dd85a";
const BUILDER_ACTION_REF = "30c33c76008b282de8990333c879ae8c1da853d7";

const VIEWER_SCRIPT = '<script src="../viewer.js" defer></script>';
const COMMON_SCRIPT = '<script src="../galaxy-common.js" defer></script>';
const CLASSIC_SCRIPT = '<script src="../galaxy-classic-runtime.js" defer></script>';
const SYSTEMS_SCRIPT = '<script src="../galaxy-systems-runtime.js" defer></script>';
const HYBRID_SCRIPT = '<script src="../galaxy-hybrid-runtime.js" defer></script>';
const SPATIAL_CORE_SCRIPT = '<script src="../spatial-core-runtime.js" defer></script>';
const OBSIDIAN_SCRIPT = '<script src="../obsidian-runtime.js" defer></script>';
const EDGE_SCRIPT = '<script src="../galaxy-edge-policy.js" defer></script>';
const POLISH_SCRIPT = '<script src="../interaction-polish.js" defer></script>';
const OBSIDIAN_HOVER_SCRIPT = '<script src="../obsidian-hover.js" defer></script>';
const ADAPTIVE_LABELS_SCRIPT = '<script src="../adaptive-labels.js" defer></script>';
const SEARCH_EMPHASIS_SCRIPT = '<script src="../search-emphasis.js" defer></script>';
const DEDICATED_VIEWERS = new Map([
  ["radial", '<script src="../radial-viewer.js" defer></script>'],
  ["tree", '<script src="../tree-viewer.js" defer></script>'],
  ["treemap", '<script src="../treemap-viewer.js" defer></script>'],
  ["timeline", '<script src="../timeline-viewer.js" defer></script>'],
  ["cluster", '<script src="../cluster-viewer.js" defer></script>'],
  ["sunburst", '<script src="../sunburst-viewer.js" defer></script>'],
  ["matrix", '<script src="../matrix-viewer.js" defer></script>'],
  ["sankey", '<script src="../sankey-viewer.js" defer></script>'],
]);

async function htmlFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await htmlFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) found.push(path);
  }
  return found;
}

export function spatialCoreRuntimeSource() {
  return `"use strict";\n/* global window */\n(() => {\n  const DEFAULT_FORCE_SETTINGS = Object.freeze(${JSON.stringify(DEFAULT_FORCE_SETTINGS)});\n\n  ${hashText.toString()}\n\n  ${normalizeWeightedEdges.toString()}\n\n  ${linkForceEdges.toString()}\n\n  ${stepForceLayout.toString()}\n\n  window.ProjectMapSpatialCore = Object.freeze({\n    DEFAULT_FORCE_SETTINGS,\n    normalizeWeightedEdges,\n    linkForceEdges,\n    stepForceLayout,\n  });\n})();\n`;
}

export function tuneObsidianRuntime(source) {
  let patched = source;
  const settingsStart = "  const settings = {";
  const settingsEnd = "  const SPAWN_ALPHA = 0.6;";
  const settingsIndex = patched.indexOf(settingsStart);
  const settingsEndIndex = patched.indexOf(settingsEnd, settingsIndex);
  if (settingsIndex < 0 || settingsEndIndex < 0) throw new Error("Could not locate Obsidian force settings boundary");
  patched = `${patched.slice(0, settingsIndex)}  const settings = window.ProjectMapSpatialCore.DEFAULT_FORCE_SETTINGS;\n${patched.slice(settingsEndIndex)}`;

  const linkedStart = "  function linkedEdges(graph, nodes) {";
  const linkedEnd = "\n\n  function compactSpawnPoint";
  const linkedIndex = patched.indexOf(linkedStart);
  const linkedEndIndex = patched.indexOf(linkedEnd, linkedIndex);
  if (linkedIndex < 0 || linkedEndIndex < 0) throw new Error("Could not locate Obsidian linked-edge boundary");
  const linkedReplacement = `  function linkedEdges(graph, nodes) {\n    return window.ProjectMapSpatialCore.linkForceEdges(graph?.edges, nodes);\n  }`;
  patched = `${patched.slice(0, linkedIndex)}${linkedReplacement}${patched.slice(linkedEndIndex)}`;

  const forceStart = "  function applyForceStep(nodes, edges, alpha, dragging = null) {";
  const forceEnd = "\n\n  buildObsidianLayout = function";
  const forceIndex = patched.indexOf(forceStart);
  const forceEndIndex = patched.indexOf(forceEnd, forceIndex);
  if (forceIndex < 0 || forceEndIndex < 0) throw new Error("Could not locate Obsidian force-step boundary");
  const forceReplacement = `  function applyForceStep(nodes, edges, alpha, dragging = null) {\n    window.ProjectMapSpatialCore.stepForceLayout(nodes, edges, alpha, {\n      settings,\n      draggingId: dragging?.id ?? null,\n      radius: physicsRadius,\n    });\n  }`;
  patched = `${patched.slice(0, forceIndex)}${forceReplacement}${patched.slice(forceEndIndex)}`;

  if (patched.includes("for (let first = 0; first < nodes.length; first += 1)")) throw new Error("Obsidian emitted runtime still contains duplicated force kernel");
  return patched;
}

export function tuneInteractionPolish(source) {
  const start = "      const deduped = new Map();";
  const end = "      if (semanticEdges.length) safe.semanticEdges = semanticEdges;";
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  if (startIndex < 0 || endIndex < 0) throw new Error("Could not locate semantic relation normalization boundary");
  const replacement = `      const spatialCore = window.ProjectMapSpatialCore;\n      if (!spatialCore) throw new Error("Spatial Core runtime must load before semantic normalization");\n      const semanticCandidates = [];\n      for (const raw of value.semanticEdges.slice(0, 2400)) {\n        if (!raw || typeof raw !== "object" || raw.type !== "semantic") continue;\n        const source = typeof raw.source === "string" ? raw.source.slice(0, 220) : "";\n        const target = typeof raw.target === "string" ? raw.target.slice(0, 220) : "";\n        semanticCandidates.push({ source, target, score: Number(raw.score) });\n      }\n      const semanticEdges = spatialCore.normalizeWeightedEdges(semanticCandidates, repositoryIds, {\n        maxInput: 2400,\n        maxOutput: 1200,\n        minScore: 0,\n        type: "semantic",\n      });\n      if (semanticEdges.length) safe.semanticEdges = semanticEdges;`;
  const patched = `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex + end.length)}`;
  if (patched.includes("const deduped = new Map();")) throw new Error("Emitted interaction runtime still contains duplicated semantic dedupe");
  return patched;
}

async function emitSpatialCoreRuntime(outputDir) {
  await writeFile(join(outputDir, "spatial-core-runtime.js"), spatialCoreRuntimeSource());
}

async function emitGalaxyRuntimes(outputDir) {
  const sourceDir = resolve(process.cwd(), "scripts");
  await copyFile(join(sourceDir, "public-galaxy-common.js"), join(outputDir, "galaxy-common.js"));
  await copyFile(join(sourceDir, "public-galaxy-classic.js"), join(outputDir, "galaxy-classic-runtime.js"));
  await copyFile(join(sourceDir, "public-galaxy-hybrid.js"), join(outputDir, "galaxy-hybrid-runtime.js"));
  await copyFile(join(sourceDir, "public-galaxy-systems.js"), join(outputDir, "galaxy-systems-runtime.js"));
  await copyFile(join(sourceDir, "public-galaxy-edge-policy.js"), join(outputDir, "galaxy-edge-policy.js"));
  await copyFile(join(sourceDir, "public-adaptive-labels.js"), join(outputDir, "adaptive-labels.js"));

  const htmlPath = join(outputDir, "u", "index.html");
  const html = await readFile(htmlPath, "utf8");
  if (!html.includes(VIEWER_SCRIPT)) throw new Error("Shared viewer script tag not found");
  const runtimeBlock = [COMMON_SCRIPT, CLASSIC_SCRIPT, SYSTEMS_SCRIPT, HYBRID_SCRIPT, SPATIAL_CORE_SCRIPT, OBSIDIAN_SCRIPT, EDGE_SCRIPT, POLISH_SCRIPT, OBSIDIAN_HOVER_SCRIPT, ADAPTIVE_LABELS_SCRIPT].join("\n");
  const next = html.includes(COMMON_SCRIPT) ? html : html.replace(VIEWER_SCRIPT, `${VIEWER_SCRIPT}\n${runtimeBlock}`);
  if (!next.includes(CLASSIC_SCRIPT) || !next.includes(SYSTEMS_SCRIPT) || !next.includes(HYBRID_SCRIPT) || !next.includes(SPATIAL_CORE_SCRIPT) || !next.includes(OBSIDIAN_HOVER_SCRIPT) || !next.includes(ADAPTIVE_LABELS_SCRIPT)) throw new Error("Could not attach Galaxy family runtimes");
  if (next !== html) await writeFile(htmlPath, next);
}

async function emitObsidianRuntime(outputDir) {
  const sourceDir = resolve(process.cwd(), "scripts");
  const source = await readFile(join(sourceDir, "public-obsidian-runtime.js"), "utf8");
  await writeFile(join(outputDir, "obsidian-runtime.js"), tuneObsidianRuntime(source));
  await copyFile(join(sourceDir, "public-obsidian-hover.js"), join(outputDir, "obsidian-hover.js"));
}

async function emitInteractionPolish(outputDir) {
  const sourcePath = resolve(process.cwd(), "scripts/public-interaction-polish.js");
  const emphasisSourcePath = resolve(process.cwd(), "scripts/public-search-emphasis.js");
  const source = await readFile(sourcePath, "utf8");
  await writeFile(join(outputDir, "interaction-polish.js"), tuneInteractionPolish(source));
  await copyFile(emphasisSourcePath, join(outputDir, "search-emphasis.js"));
  for (const [route, viewerScript] of DEDICATED_VIEWERS) {
    const htmlPath = join(outputDir, route, "index.html");
    const html = await readFile(htmlPath, "utf8");
    if (!html.includes(viewerScript)) throw new Error(`Viewer script tag not found before interaction polish in ${htmlPath}`);
    let next = html;
    if (!next.includes(SPATIAL_CORE_SCRIPT)) next = next.replace(viewerScript, `${viewerScript}\n${SPATIAL_CORE_SCRIPT}`);
    if (!next.includes(POLISH_SCRIPT)) next = next.replace(SPATIAL_CORE_SCRIPT, `${SPATIAL_CORE_SCRIPT}\n${POLISH_SCRIPT}`);
    if (!next.includes(SEARCH_EMPHASIS_SCRIPT)) next = next.replace(POLISH_SCRIPT, `${POLISH_SCRIPT}\n${SEARCH_EMPHASIS_SCRIPT}`);
    if (!next.includes(SPATIAL_CORE_SCRIPT) || !next.includes(SEARCH_EMPHASIS_SCRIPT)) throw new Error(`Could not attach Spatial Core and search emphasis runtimes in ${htmlPath}`);
    if (next !== html) await writeFile(htmlPath, next);
  }
}

export async function postprocessPublicPages(outputDir = resolve(process.cwd(), "site")) {
  for (const path of await htmlFiles(outputDir)) {
    const source = await readFile(path, "utf8");
    const cleaned = source
      .replace(/;?\s*frame-ancestors\s+'none'/g, "")
      .replace(/style-src\s+'self'(?!\s+'unsafe-inline')/g, "style-src 'self' 'unsafe-inline'");
    if (cleaned !== source) await writeFile(path, cleaned);
  }

  await emitSpatialCoreRuntime(outputDir);
  await emitObsidianRuntime(outputDir);
  await emitGalaxyRuntimes(outputDir);
  await emitInteractionPolish(outputDir);

  const appPath = join(outputDir, "app.js");
  const app = await readFile(appPath, "utf8");
  if (!app.includes(BUILDER_ACTION_REF) && !app.includes(PUBLIC_ACTION_REF)) throw new Error("Emitted app.js does not contain the expected installer Action ref");
  const promotedApp = app.replaceAll(BUILDER_ACTION_REF, PUBLIC_ACTION_REF);
  if (!promotedApp.includes(PUBLIC_ACTION_REF) || promotedApp.includes(BUILDER_ACTION_REF)) throw new Error("Could not promote emitted installer Action ref");
  if (promotedApp !== app) await writeFile(appPath, promotedApp);
}

async function main() {
  const outputDir = resolve(process.argv[2] || join(process.cwd(), "site"));
  await postprocessPublicPages(outputDir);
  console.log(`Postprocessed public Pages output in ${outputDir}`);
  console.log(`Published installer Action ref: ${PUBLIC_ACTION_REF}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
