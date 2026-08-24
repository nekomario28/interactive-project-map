import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SCRIPT_NAME = "cosmic-background.js";
const SOURCE_NAME = "public-cosmic-background.js";
const VIEWER_HTML = join("u", "index.html");
const SCRIPT_MARKER = '<script src="../view-state.js" defer></script>';
const SCRIPT_TAG = '<script src="../cosmic-background.js" defer></script>';

export async function applyReactiveCosmicBackground(outputDir = resolve(process.cwd(), "site")) {
  const sourceDir = resolve(process.cwd(), "scripts");
  const source = await readFile(join(sourceDir, SOURCE_NAME), "utf8");
  await writeFile(join(outputDir, SCRIPT_NAME), source);

  const htmlPath = join(outputDir, VIEWER_HTML);
  const html = await readFile(htmlPath, "utf8");
  if (html.includes(SCRIPT_TAG)) return;
  if (!html.includes(SCRIPT_MARKER)) throw new Error("Could not locate shared view-state script in Pages viewer");
  await writeFile(htmlPath, html.replace(SCRIPT_MARKER, `${SCRIPT_MARKER}\n${SCRIPT_TAG}`));
}

async function main() {
  const outputDir = resolve(process.argv[2] || join(process.cwd(), "site"));
  await applyReactiveCosmicBackground(outputDir);
  console.log("Installed reactive parallax starfield and low-frequency meteor background");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
