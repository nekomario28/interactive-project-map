import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { patchThreeDRendererSnapshot, patchTwoDRendererSnapshot } from "./public-renderer-snapshot.mjs";

export const BOOTSTRAP_GATE_MARKER = "/* IPM_2D_RUNTIME_BOOTSTRAP_GATE_V1 */";

export const TWO_D_VIEWER_FILES = Object.freeze([
  "viewer.js",
  "radial-viewer.js",
  "tree-viewer.js",
  "treemap-viewer.js",
  "timeline-viewer.js",
  "cluster-viewer.js",
  "sunburst-viewer.js",
  "matrix-viewer.js",
  "sankey-viewer.js",
]);

const START_MARKERS = Object.freeze(["if (username) {", "if(username){"]);

function graphBootstrapStart(source) {
  let start = -1;
  for (const marker of START_MARKERS) start = Math.max(start, source.lastIndexOf(marker));
  if (start < 0) throw new Error("Could not locate 2D graph bootstrap");
  const tail = source.slice(start);
  if (!tail.includes("graph.json") || !tail.includes("fetch(")) {
    throw new Error("Located 2D bootstrap does not contain graph fetch");
  }
  return start;
}

export function gate2DRuntimeBootstrap(source) {
  if (source.includes(BOOTSTRAP_GATE_MARKER)) return source;
  const start = graphBootstrapStart(source);
  const prefix = source.slice(0, start).trimEnd();
  const bootstrap = source.slice(start).trim();
  return `${prefix}\n${BOOTSTRAP_GATE_MARKER}\nfunction startProjectMapGraphLoad() {\n${bootstrap}\n}\nwindow.addEventListener("DOMContentLoaded", startProjectMapGraphLoad, { once: true });\n`;
}

async function applyRendererSnapshotBeforeBootstrap(root) {
  const twoDPath = join(root, "view-state.js");
  const threeDPath = join(root, "threejs-viewer.js");
  const [twoDSource, threeDSource] = await Promise.all([
    readFile(twoDPath, "utf8"),
    readFile(threeDPath, "utf8"),
  ]);
  const twoDNext = patchTwoDRendererSnapshot(twoDSource);
  const threeDNext = patchThreeDRendererSnapshot(threeDSource);
  await Promise.all([
    twoDNext !== twoDSource ? writeFile(twoDPath, twoDNext) : Promise.resolve(),
    threeDNext !== threeDSource ? writeFile(threeDPath, threeDNext) : Promise.resolve(),
  ]);
}

export async function apply2DRuntimeBootstrapGate(root = "site") {
  // Preserve the former adjacent stage order exactly: renderer snapshot first,
  // then gate the final 2D graph bootstraps behind DOMContentLoaded.
  await applyRendererSnapshotBeforeBootstrap(root);
  for (const file of TWO_D_VIEWER_FILES) {
    const path = join(root, file);
    const source = await readFile(path, "utf8");
    await writeFile(path, gate2DRuntimeBootstrap(source));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  await apply2DRuntimeBootstrapGate();
}
