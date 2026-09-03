import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { patchThreejsLocalGraphPage, patchThreejsLocalGraphRuntime } from "./public-threejs-local-graph.mjs";
import { patchThreejsSearchContextRuntime } from "./public-threejs-search-context.mjs";
import {
  composeThreejsCategoryNavigatorPage,
  composeThreejsCategoryNavigatorRuntime,
} from "./public-threejs-category-navigator.mjs";
import {
  composeThreejsRepositoryLabelsPage,
  composeThreejsRepositoryLabelsRuntime,
} from "./public-threejs-repository-labels.mjs";

export async function applyThreejsSearchContext({
  siteDir = join(process.cwd(), "site"),
  sourceDir = join(process.cwd(), "scripts"),
} = {}) {
  const runtimePath = join(siteDir, "threejs-viewer.js");
  const pagePath = join(siteDir, "three", "index.html");
  const navigatorPath = join(siteDir, "threejs-category-navigator.js");
  const repositoryLabelStylePath = join(siteDir, "threejs-repository-labels.css");
  const [runtime, page] = await Promise.all([
    readFile(runtimePath, "utf8"),
    readFile(pagePath, "utf8"),
  ]);
  const localRuntime = patchThreejsLocalGraphRuntime(runtime);
  const searchRuntime = patchThreejsSearchContextRuntime(localRuntime);
  const navigatorRuntime = composeThreejsCategoryNavigatorRuntime(searchRuntime);
  const nextRuntime = composeThreejsRepositoryLabelsRuntime(navigatorRuntime);
  const localPage = patchThreejsLocalGraphPage(page);
  const navigatorPage = composeThreejsCategoryNavigatorPage(localPage);
  const nextPage = composeThreejsRepositoryLabelsPage(navigatorPage);
  if (nextRuntime !== runtime) await writeFile(runtimePath, nextRuntime);
  if (nextPage !== page) await writeFile(pagePath, nextPage);
  await Promise.all([
    copyFile(join(sourceDir, "public-threejs-category-navigator.js"), navigatorPath),
    copyFile(join(sourceDir, "public-threejs-repository-labels.css"), repositoryLabelStylePath),
  ]);
  return {
    runtimePath,
    pagePath,
    navigatorPath,
    repositoryLabelStylePath,
    injected: nextRuntime !== runtime || nextPage !== page,
  };
}

async function main() {
  const result = await applyThreejsSearchContext();
  console.log(`Applied Local Graph, shared search, Category Navigator, and repository labels to ${result.runtimePath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
