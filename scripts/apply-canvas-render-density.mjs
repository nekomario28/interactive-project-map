import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SCRIPT_TAG = '<script src="../render-density.js"></script>';
const CANVAS_RUNTIME_FILES = [
  "viewer.js",
  "radial-viewer.js",
  "tree-viewer.js",
  "treemap-viewer.js",
  "timeline-viewer.js",
  "cluster-viewer.js",
  "sunburst-viewer.js",
  "tree-router.js",
];
const CANVAS_VIEWER_DIRS = ["u", "radial", "tree", "treemap", "timeline", "cluster", "sunburst"];
const DPR_SOURCE = "const dpr = window.devicePixelRatio || 1;";
const DPR_REPLACEMENT = "const dpr = window.ProjectMapRenderDensity?.pixelRatio({ width: canvas?.getBoundingClientRect?.().width, devicePixelRatio: window.devicePixelRatio || 1 }) || window.devicePixelRatio || 1;";

export function patchCanvasRuntime(source, fileName = "Canvas runtime") {
  if (source.includes(DPR_REPLACEMENT)) return source;
  const occurrences = source.split(DPR_SOURCE).length - 1;
  if (occurrences !== 1) throw new Error(`${fileName} must contain exactly one native DPR assignment; found ${occurrences}`);
  return source.replace(DPR_SOURCE, DPR_REPLACEMENT);
}

export function patchCanvasViewerPage(html, viewerDir = "Canvas viewer") {
  if (html.includes(SCRIPT_TAG)) return html;
  if (!html.includes("</head>")) throw new Error(`Missing </head> in ${viewerDir}`);
  return html.replace("</head>", `${SCRIPT_TAG}\n</head>`);
}

export async function applyCanvasRenderDensity({
  siteDir = join(process.cwd(), "site"),
  sourceDir = join(process.cwd(), "scripts"),
} = {}) {
  await copyFile(join(sourceDir, "public-render-density.js"), join(siteDir, "render-density.js"));

  let patchedRuntimes = 0;
  for (const fileName of CANVAS_RUNTIME_FILES) {
    const filePath = join(siteDir, fileName);
    const source = await readFile(filePath, "utf8");
    const next = patchCanvasRuntime(source, fileName);
    if (next !== source) {
      await writeFile(filePath, next);
      patchedRuntimes += 1;
    }
  }

  let patchedPages = 0;
  for (const viewerDir of CANVAS_VIEWER_DIRS) {
    const pagePath = join(siteDir, viewerDir, "index.html");
    const html = await readFile(pagePath, "utf8");
    const next = patchCanvasViewerPage(html, viewerDir);
    if (next !== html) {
      await writeFile(pagePath, next);
      patchedPages += 1;
    }
  }

  return { patchedRuntimes, patchedPages };
}

async function main() {
  const result = await applyCanvasRenderDensity();
  console.log(`Applied Canvas render density policy to ${result.patchedRuntimes} runtimes and ${result.patchedPages} pages`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
