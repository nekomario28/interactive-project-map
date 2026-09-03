import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { patchThreeDRendererSnapshot, patchTwoDRendererSnapshot } from "./public-renderer-snapshot.mjs";

export async function applyRendererSnapshot({ siteDir = join(process.cwd(), "site") } = {}) {
  const twoDPath = join(siteDir, "view-state.js");
  const threeDPath = join(siteDir, "threejs-viewer.js");
  const [twoDSource, threeDSource] = await Promise.all([readFile(twoDPath, "utf8"), readFile(threeDPath, "utf8")]);
  const twoDNext = patchTwoDRendererSnapshot(twoDSource);
  const threeDNext = patchThreeDRendererSnapshot(threeDSource);
  await Promise.all([
    twoDNext !== twoDSource ? writeFile(twoDPath, twoDNext) : Promise.resolve(),
    threeDNext !== threeDSource ? writeFile(threeDPath, threeDNext) : Promise.resolve(),
  ]);
  return { twoDPath, threeDPath, changed: twoDNext !== twoDSource || threeDNext !== threeDSource };
}

async function main() {
  const result = await applyRendererSnapshot();
  console.log(`Applied common renderer snapshot contract${result.changed ? "" : " (already present)"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
