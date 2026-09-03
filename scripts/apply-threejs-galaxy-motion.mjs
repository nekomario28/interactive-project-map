import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { composeThreejsGalaxyMotionRuntime } from "./public-threejs-galaxy-motion.mjs";

// Compatibility alias for existing callers while canonical ownership lives in
// public-threejs-galaxy-motion.mjs.
export const patchThreejsGalaxyMotionRuntime = composeThreejsGalaxyMotionRuntime;

export async function applyThreejsGalaxyMotion({ siteDir = join(process.cwd(), "site") } = {}) {
  const runtimePath = join(siteDir, "threejs-viewer.js");
  const source = await readFile(runtimePath, "utf8");
  const next = composeThreejsGalaxyMotionRuntime(source);
  if (next !== source) await writeFile(runtimePath, next);
  return { runtimePath, changed: next !== source };
}

async function main() {
  const result = await applyThreejsGalaxyMotion();
  console.log(`Applied Three.js Galaxy motion${result.changed ? "" : " (already present)"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
