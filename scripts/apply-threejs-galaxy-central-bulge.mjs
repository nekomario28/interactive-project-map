import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { composeThreejsGalaxyPatternCouplingRuntime } from "./public-threejs-galaxy-pattern-coupling.mjs";

// Compatibility alias while canonical pattern-coupling ownership lives in
// public-threejs-galaxy-pattern-coupling.mjs.
export const patchThreejsGalaxyCentralBulgeRuntime = composeThreejsGalaxyPatternCouplingRuntime;

export async function applyThreejsGalaxyCentralBulge({ siteDir = join(process.cwd(), "site") } = {}) {
  const runtimePath = join(siteDir, "threejs-viewer.js");
  const source = await readFile(runtimePath, "utf8");
  const next = composeThreejsGalaxyPatternCouplingRuntime(source);
  if (next !== source) await writeFile(runtimePath, next);
  return { runtimePath, changed: next !== source };
}

async function main() {
  const result = await applyThreejsGalaxyCentralBulge();
  console.log(`Applied Three.js Galaxy haze pattern coupling${result.changed ? "" : " (already present)"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
