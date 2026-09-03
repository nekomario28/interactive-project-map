import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { composeThreejsGalaxyMotionRuntime } from "./public-threejs-galaxy-motion.mjs";
import {
  composeThreejsStylePage,
  composeThreejsStyleRuntime,
} from "./public-threejs-style-presets.mjs";

// Compatibility aliases while canonical style ownership lives in
// public-threejs-style-presets.mjs.
export const patchThreejsStyleRuntime = composeThreejsStyleRuntime;
export const patchThreejsStylePage = composeThreejsStylePage;

export async function applyThreejsStylePresets({ siteDir = join(process.cwd(), "site") } = {}) {
  const runtimePath = join(siteDir, "threejs-viewer.js");
  const pagePath = join(siteDir, "three", "index.html");
  const [source, html] = await Promise.all([readFile(runtimePath, "utf8"), readFile(pagePath, "utf8")]);
  const styledRuntime = composeThreejsStyleRuntime(source);
  const next = composeThreejsGalaxyMotionRuntime(styledRuntime);
  const nextHtml = composeThreejsStylePage(html);
  await Promise.all([
    next !== source ? writeFile(runtimePath, next) : Promise.resolve(),
    nextHtml !== html ? writeFile(pagePath, nextHtml) : Promise.resolve(),
  ]);
  return { runtimePath, pagePath, changed: next !== source || nextHtml !== html };
}

async function main() {
  const result = await applyThreejsStylePresets();
  console.log(`Applied Three.js style presets and Galaxy motion${result.changed ? "" : " (already present)"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
