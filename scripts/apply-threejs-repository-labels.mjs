import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  composeThreejsRepositoryLabelsPage,
  composeThreejsRepositoryLabelsRuntime,
  DIRECT_SEARCH_LABEL_BUDGET,
} from "./public-threejs-repository-labels.mjs";

export { DIRECT_SEARCH_LABEL_BUDGET };
export const patchThreejsRepositoryLabelsRuntime = composeThreejsRepositoryLabelsRuntime;
export const patchThreejsRepositoryLabelsPage = composeThreejsRepositoryLabelsPage;

export async function applyThreejsRepositoryLabels({
  siteDir = join(process.cwd(), "site"),
  sourceDir = join(process.cwd(), "scripts"),
} = {}) {
  const runtimePath = join(siteDir, "threejs-viewer.js");
  const pagePath = join(siteDir, "three", "index.html");
  const stylePath = join(siteDir, "threejs-repository-labels.css");
  const [runtime, page] = await Promise.all([readFile(runtimePath, "utf8"), readFile(pagePath, "utf8")]);
  const nextRuntime = composeThreejsRepositoryLabelsRuntime(runtime);
  const nextPage = composeThreejsRepositoryLabelsPage(page);
  if (nextRuntime !== runtime) await writeFile(runtimePath, nextRuntime);
  if (nextPage !== page) await writeFile(pagePath, nextPage);
  await copyFile(join(sourceDir, "public-threejs-repository-labels.css"), stylePath);
  return { runtimePath, pagePath, stylePath, injected: nextRuntime !== runtime || nextPage !== page };
}

async function main() {
  const result = await applyThreejsRepositoryLabels();
  console.log(`Applied bounded Three.js repository labels to ${result.runtimePath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
