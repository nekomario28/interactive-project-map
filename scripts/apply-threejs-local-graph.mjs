import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { patchThreejsLocalGraphPage, patchThreejsLocalGraphRuntime } from "./public-threejs-local-graph.mjs";

export async function applyThreejsLocalGraph({ siteDir = join(process.cwd(), "site") } = {}) {
  const runtimePath = join(siteDir, "threejs-viewer.js");
  const pagePath = join(siteDir, "three", "index.html");
  const [runtime, page] = await Promise.all([
    readFile(runtimePath, "utf8"),
    readFile(pagePath, "utf8"),
  ]);
  const nextRuntime = patchThreejsLocalGraphRuntime(runtime);
  const nextPage = patchThreejsLocalGraphPage(page);
  if (nextRuntime !== runtime) await writeFile(runtimePath, nextRuntime);
  if (nextPage !== page) await writeFile(pagePath, nextPage);
  return {
    runtimePath,
    pagePath,
    injected: nextRuntime !== runtime || nextPage !== page,
  };
}

async function main() {
  const result = await applyThreejsLocalGraph();
  console.log(`Applied shared Local Graph adapter to ${result.runtimePath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
