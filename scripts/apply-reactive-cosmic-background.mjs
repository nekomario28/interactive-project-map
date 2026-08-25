import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const COSMIC_SCRIPT_NAME = "cosmic-background.js";
const COSMIC_SOURCE_NAME = "public-cosmic-background.js";
const CAMERA_SCRIPT_NAME = "camera-coherence.js";
const CAMERA_SOURCE_NAME = "public-camera-coherence.js";
const VIEWER_HTML = join("u", "index.html");
const SCRIPT_MARKER = '<script src="../viewer.js" defer></script>';
const CAMERA_SCRIPT_TAG = '<script src="../camera-coherence.js" defer></script>';
const COSMIC_SCRIPT_TAG = '<script src="../cosmic-background.js" defer></script>';

export async function applyReactiveCosmicBackground(outputDir = resolve(process.cwd(), "site")) {
  const sourceDir = resolve(process.cwd(), "scripts");
  const [cameraSource, cosmicSource] = await Promise.all([
    readFile(join(sourceDir, CAMERA_SOURCE_NAME), "utf8"),
    readFile(join(sourceDir, COSMIC_SOURCE_NAME), "utf8"),
  ]);
  await Promise.all([
    writeFile(join(outputDir, CAMERA_SCRIPT_NAME), cameraSource),
    writeFile(join(outputDir, COSMIC_SCRIPT_NAME), cosmicSource),
  ]);

  const htmlPath = join(outputDir, VIEWER_HTML);
  const html = await readFile(htmlPath, "utf8");
  if (html.includes(CAMERA_SCRIPT_TAG) && html.includes(COSMIC_SCRIPT_TAG)) return;
  if (!html.includes(SCRIPT_MARKER)) throw new Error("Could not locate shared viewer script in Pages viewer");
  // Install camera coherence immediately after viewer.js, then cosmic depth.
  // postprocess-public-pages installs Galaxy and Obsidian style runtimes after the
  // same marker, so this final pass keeps both scene-level layers beneath styles.
  const block = `${SCRIPT_MARKER}\n${CAMERA_SCRIPT_TAG}\n${COSMIC_SCRIPT_TAG}`;
  let next = html.replace(SCRIPT_MARKER, block);
  if (html.includes(CAMERA_SCRIPT_TAG)) next = next.replace(`${CAMERA_SCRIPT_TAG}\n${CAMERA_SCRIPT_TAG}\n`, `${CAMERA_SCRIPT_TAG}\n`);
  if (html.includes(COSMIC_SCRIPT_TAG)) next = next.replace(`${COSMIC_SCRIPT_TAG}\n${COSMIC_SCRIPT_TAG}\n`, `${COSMIC_SCRIPT_TAG}\n`);
  await writeFile(htmlPath, next);
}

async function main() {
  const outputDir = resolve(process.argv[2] || join(process.cwd(), "site"));
  await applyReactiveCosmicBackground(outputDir);
  console.log("Installed camera-coherent zoom, reactive cosmic depth, and low-frequency meteors");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
