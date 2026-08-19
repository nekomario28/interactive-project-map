import { copyFile, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PUBLIC_ACTION_REF = "2d35ec20a52d12d18f512c8b2d92590b6ed80a0b";
const BUILDER_ACTION_REF = "30c33c76008b282de8990333c879ae8c1da853d7";

const MOBILE_FIX = `

/* Emitted-site mobile hardening: keep the viewer inside narrow viewports. */
@media (max-width: 480px) {
  .app,
  .toolbar,
  .controls,
  .workspace,
  footer {
    min-width: 0;
    max-width: 100%;
  }

  .app {
    width: 100%;
  }

  .controls {
    width: 100%;
  }

  .field {
    min-width: 0;
  }

  .field:first-child {
    flex: 1 1 100%;
  }

  .field:nth-child(2) {
    flex: 1 1 150px;
  }

  .field select {
    width: 100%;
    min-width: 0;
  }

  .toolbar button {
    flex: 0 0 auto;
  }

  footer {
    overflow: hidden;
  }

  footer > span:first-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
`;

const VIEWER_FIT_OLD = "state.zoom = clamp(Math.min((size.width * 0.84) / width, (size.height * 0.78) / height), 0.25, 2.2);";
const VIEWER_FIT_NEW = "state.zoom = clamp(Math.min((size.width * 0.84) / width, (size.height * 0.78) / height), 0.04, 2.2);";
const VIEWER_SCRIPT = '<script src="../viewer.js" defer></script>';
const RUNTIME_SCRIPT = '<script src="../shared-runtime.js" defer></script>';
const OBSIDIAN_SCRIPT = '<script src="../obsidian-runtime.js" defer></script>';
const POLISH_SCRIPT = '<script src="../interaction-polish.js" defer></script>';
const SUNBURST_VIEWER_SCRIPT = '<script src="../sunburst-viewer.js" defer></script>';
const LEGACY_OBSIDIAN_FRAME = `          changed = stepObsidian();
          if (subtitle) subtitle.textContent = "Obsidian Graph-like · stable at rest · hover highlights links · drag reheats local force layout";
          if (!state.selected && detailsDescription) detailsDescription.textContent = "Stable force-directed graph: center, repulsion and link forces settle before display. Hover highlights links; dragging locally reheats connected nodes, then the graph becomes still again.";`;
const DEDICATED_OBSIDIAN_FRAME = "          changed = false; // Dedicated obsidian-runtime.js owns Obsidian physics and drag semantics.";

async function htmlFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await htmlFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) found.push(path);
  }
  return found;
}

async function hardenSharedViewer(outputDir) {
  const viewerPath = join(outputDir, "viewer.js");
  const source = await readFile(viewerPath, "utf8");
  if (!source.includes(VIEWER_FIT_OLD) && !source.includes(VIEWER_FIT_NEW)) throw new Error("Could not locate shared viewer Fit zoom contract");
  const patched = source
    .replace(VIEWER_FIT_OLD, VIEWER_FIT_NEW)
    .replaceAll(", 0.2, 4.5)", ", 0.04, 4.5)");
  if (!patched.includes(VIEWER_FIT_NEW) || patched.includes(VIEWER_FIT_OLD)) throw new Error("Could not lower shared viewer minimum zoom");
  if (patched !== source) await writeFile(viewerPath, patched);
}

async function emitSharedRuntime(outputDir) {
  const sourcePath = resolve(process.cwd(), "scripts/public-shared-runtime.js");
  const outputPath = join(outputDir, "shared-runtime.js");
  await copyFile(sourcePath, outputPath);

  const source = await readFile(outputPath, "utf8");
  if (!source.includes(LEGACY_OBSIDIAN_FRAME) && !source.includes(DEDICATED_OBSIDIAN_FRAME)) throw new Error("Could not locate legacy Obsidian runtime branch");
  const patched = source.replace(LEGACY_OBSIDIAN_FRAME, DEDICATED_OBSIDIAN_FRAME);
  if (!patched.includes(DEDICATED_OBSIDIAN_FRAME) || patched.includes("changed = stepObsidian();")) throw new Error("Could not disable legacy Obsidian dynamics");
  if (patched !== source) await writeFile(outputPath, patched);

  const htmlPath = join(outputDir, "u", "index.html");
  const html = await readFile(htmlPath, "utf8");
  if (!html.includes(VIEWER_SCRIPT)) throw new Error("Shared viewer script tag not found");
  const withRuntime = html.includes(RUNTIME_SCRIPT)
    ? html
    : html.replace(VIEWER_SCRIPT, `${VIEWER_SCRIPT}\n${RUNTIME_SCRIPT}`);
  if (!withRuntime.includes(RUNTIME_SCRIPT)) throw new Error("Could not attach shared runtime to /u/");
  if (withRuntime !== html) await writeFile(htmlPath, withRuntime);
}

async function emitObsidianRuntime(outputDir) {
  const sourcePath = resolve(process.cwd(), "scripts/public-obsidian-runtime.js");
  const outputPath = join(outputDir, "obsidian-runtime.js");
  await copyFile(sourcePath, outputPath);

  const htmlPath = join(outputDir, "u", "index.html");
  const html = await readFile(htmlPath, "utf8");
  if (!html.includes(RUNTIME_SCRIPT)) throw new Error("Shared runtime script tag not found before Obsidian runtime");
  const withObsidian = html.includes(OBSIDIAN_SCRIPT)
    ? html
    : html.replace(RUNTIME_SCRIPT, `${RUNTIME_SCRIPT}\n${OBSIDIAN_SCRIPT}`);
  if (!withObsidian.includes(OBSIDIAN_SCRIPT)) throw new Error("Could not attach Obsidian runtime to /u/");
  if (withObsidian !== html) await writeFile(htmlPath, withObsidian);
}

async function emitInteractionPolish(outputDir) {
  const sourcePath = resolve(process.cwd(), "scripts/public-interaction-polish.js");
  const outputPath = join(outputDir, "interaction-polish.js");
  await copyFile(sourcePath, outputPath);

  const sharedHtmlPath = join(outputDir, "u", "index.html");
  const sharedHtml = await readFile(sharedHtmlPath, "utf8");
  const sharedAnchor = sharedHtml.includes(OBSIDIAN_SCRIPT) ? OBSIDIAN_SCRIPT : RUNTIME_SCRIPT;
  if (!sharedHtml.includes(sharedAnchor)) throw new Error("Graph runtime script tag not found before interaction polish");
  const sharedWithPolish = sharedHtml.includes(POLISH_SCRIPT)
    ? sharedHtml
    : sharedHtml.replace(sharedAnchor, `${sharedAnchor}\n${POLISH_SCRIPT}`);
  if (!sharedWithPolish.includes(POLISH_SCRIPT)) throw new Error("Could not attach interaction polish to /u/");
  if (sharedWithPolish !== sharedHtml) await writeFile(sharedHtmlPath, sharedWithPolish);

  const sunburstHtmlPath = join(outputDir, "sunburst", "index.html");
  const sunburstHtml = await readFile(sunburstHtmlPath, "utf8");
  if (!sunburstHtml.includes(SUNBURST_VIEWER_SCRIPT)) throw new Error("Sunburst viewer script tag not found before interaction polish");
  const sunburstWithPolish = sunburstHtml.includes(POLISH_SCRIPT)
    ? sunburstHtml
    : sunburstHtml.replace(SUNBURST_VIEWER_SCRIPT, `${SUNBURST_VIEWER_SCRIPT}\n${POLISH_SCRIPT}`);
  if (!sunburstWithPolish.includes(POLISH_SCRIPT)) throw new Error("Could not attach interaction polish to /sunburst/");
  if (sunburstWithPolish !== sunburstHtml) await writeFile(sunburstHtmlPath, sunburstWithPolish);
}

export async function postprocessPublicPages(outputDir = resolve(process.cwd(), "site")) {
  for (const path of await htmlFiles(outputDir)) {
    const source = await readFile(path, "utf8");
    const cleaned = source
      .replace(/;?\s*frame-ancestors\s+'none'/g, "")
      .replace(/style-src\s+'self'(?!\s+'unsafe-inline')/g, "style-src 'self' 'unsafe-inline'");
    if (cleaned !== source) await writeFile(path, cleaned);
  }

  const cssPath = join(outputDir, "viewer.css");
  const css = await readFile(cssPath, "utf8");
  if (!css.includes("Emitted-site mobile hardening")) await writeFile(cssPath, css + MOBILE_FIX);

  await hardenSharedViewer(outputDir);
  await emitSharedRuntime(outputDir);
  await emitObsidianRuntime(outputDir);
  await emitInteractionPolish(outputDir);

  const appPath = join(outputDir, "app.js");
  const app = await readFile(appPath, "utf8");
  if (!app.includes(BUILDER_ACTION_REF) && !app.includes(PUBLIC_ACTION_REF)) throw new Error("Emitted app.js does not contain the expected installer Action ref");
  const promotedApp = app.replaceAll(BUILDER_ACTION_REF, PUBLIC_ACTION_REF);
  if (!promotedApp.includes(PUBLIC_ACTION_REF) || promotedApp.includes(BUILDER_ACTION_REF)) throw new Error("Could not promote emitted installer Action ref");
  if (promotedApp !== app) await writeFile(appPath, promotedApp);
}

async function main() {
  const outputDir = resolve(process.argv[2] || join(process.cwd(), "site"));
  await postprocessPublicPages(outputDir);
  console.log(`Postprocessed public Pages output in ${outputDir}`);
  console.log(`Published installer Action ref: ${PUBLIC_ACTION_REF}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
