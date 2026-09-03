import { copyFile, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PROJECT_MAP_ACTION_REF } from "../src/action-ref.ts";

// Compatibility export for validators/tests that consume the emitted Pages
// release surface. The authority lives in src/action-ref.ts.
export const PUBLIC_ACTION_REF = PROJECT_MAP_ACTION_REF;

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
  await copyFile(join(sourceDir, "public-obsidian-runtime.js"), join(outputDir, "obsidian-runtime.js"));
  await copyFile(join(sourceDir, "public-obsidian-hover.js"), join(outputDir, "obsidian-hover.js"));
}

async function emitInteractionPolish(outputDir) {
  const sourcePath = resolve(process.cwd(), "scripts/public-interaction-polish.js");
  const emphasisSourcePath = resolve(process.cwd(), "scripts/public-search-emphasis.js");
  await copyFile(sourcePath, join(outputDir, "interaction-polish.js"));
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

  await emitObsidianRuntime(outputDir);
  await emitGalaxyRuntimes(outputDir);
  await emitInteractionPolish(outputDir);
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
