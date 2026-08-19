import { copyFile, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Keep generated consumer workflows on a reviewed, immutable main commit.
// This commit includes Galaxy family, Systems label LOD, and category-first static Systems SVG.
export const PUBLIC_ACTION_REF = "e9143aad2ffed2342cf135822c14cbf534a7dc15";
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
  .app,
  .controls { width: 100%; }
  .field { min-width: 0; }
  .field:first-child { flex: 1 1 100%; }
  .field:nth-child(2) { flex: 1 1 150px; }
  .field select { width: 100%; min-width: 0; }
  .toolbar button { flex: 0 0 auto; }
  footer { overflow: hidden; }
  footer > span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}
`;

const VIEWER_FIT_OLD = "state.zoom = clamp(Math.min((size.width * 0.84) / width, (size.height * 0.78) / height), 0.25, 2.2);";
const VIEWER_FIT_NEW = "state.zoom = clamp(Math.min((size.width * 0.84) / width, (size.height * 0.78) / height), 0.04, 2.2);";
const VIEWER_SCRIPT = '<script src="../viewer.js" defer></script>';
const COMMON_SCRIPT = '<script src="../galaxy-common.js" defer></script>';
const CLASSIC_SCRIPT = '<script src="../galaxy-classic-runtime.js" defer></script>';
const SYSTEMS_SCRIPT = '<script src="../galaxy-systems-runtime.js" defer></script>';
const HYBRID_SCRIPT = '<script src="../galaxy-hybrid-runtime.js" defer></script>';
const OBSIDIAN_SCRIPT = '<script src="../obsidian-runtime.js" defer></script>';
const EDGE_SCRIPT = '<script src="../galaxy-edge-policy.js" defer></script>';
const POLISH_SCRIPT = '<script src="../interaction-polish.js" defer></script>';
const DEDICATED_VIEWERS = new Map([
  ["radial", '<script src="../radial-viewer.js" defer></script>'],
  ["tree", '<script src="../tree-viewer.js" defer></script>'],
  ["treemap", '<script src="../treemap-viewer.js" defer></script>'],
  ["timeline", '<script src="../timeline-viewer.js" defer></script>'],
  ["cluster", '<script src="../cluster-viewer.js" defer></script>'],
  ["sunburst", '<script src="../sunburst-viewer.js" defer></script>'],
  ["matrix", '<script src="../matrix-viewer.js" defer></script>'],
  ["sankey", '<script src="../sankey-viewer.js" defer></script>'],
]);

async function htmlFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await htmlFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) found.push(path);
  }
  return found;
}

function patchViewerStyles(source) {
  let patched = source;
  patched = patched.replace(
    'const STYLE_VALUES = new Set(["galaxy", "obsidian"]);',
    'const STYLE_VALUES = new Set(["galaxy-classic", "galaxy-systems", "galaxy-hybrid", "obsidian"]);\nfunction normalizeGraphStyle(value) { return value === "galaxy" ? "galaxy-systems" : STYLE_VALUES.has(value) ? value : "galaxy-systems"; }',
  );
  patched = patched.replace(
    'let initialStyle = STYLE_VALUES.has(query.get("style")) ? query.get("style") : "galaxy";',
    'let initialStyle = normalizeGraphStyle(query.get("style"));',
  );
  patched = patched.replaceAll('state.style === "galaxy"', 'state.style !== "obsidian"');
  patched = patched.replace(
    'state.style = STYLE_VALUES.has(styleSelect.value) ? styleSelect.value : "galaxy";',
    'state.style = normalizeGraphStyle(styleSelect.value);',
  );
  return patched;
}

async function hardenSharedViewer(outputDir) {
  const viewerPath = join(outputDir, "viewer.js");
  const source = await readFile(viewerPath, "utf8");
  if (!source.includes(VIEWER_FIT_OLD) && !source.includes(VIEWER_FIT_NEW)) throw new Error("Could not locate shared viewer Fit zoom contract");
  const patched = patchViewerStyles(source)
    .replace(VIEWER_FIT_OLD, VIEWER_FIT_NEW)
    .replaceAll(", 0.2, 4.5)", ", 0.04, 4.5)");
  if (!patched.includes('"galaxy-classic", "galaxy-systems", "galaxy-hybrid", "obsidian"')) throw new Error("Could not expand shared viewer Galaxy style contract");
  if (!patched.includes(VIEWER_FIT_NEW) || patched.includes(VIEWER_FIT_OLD)) throw new Error("Could not lower shared viewer minimum zoom");
  if (patched !== source) await writeFile(viewerPath, patched);
}

function isolateRuntime(source, style) {
  let patched = source.replaceAll('"galaxy"', `"${style}"`);
  const listener = 'window.addEventListener("DOMContentLoaded", () => {';
  if (!patched.includes(listener)) throw new Error(`Could not locate DOMContentLoaded boundary for ${style}`);
  patched = patched.replace(listener, `${listener}\n  if (state.style !== "${style}") return;`);
  return patched;
}

function tuneSystemsRuntime(source) {
  let patched = isolateRuntime(source, "galaxy-systems");
  patched = patched.replace(
    "const direction = lane % 2 === 0 ? 1 : -1;",
    "const direction = (hash(`${group.id}:orbit-direction`) & 1) === 0 ? 1 : -1;",
  );
  patched = patched.replace("const period = 128 + lane * 54;", "const period = 360 + lane * 180;");
  const stepAnchor = "    if (dt <= 0 || motionMedia.matches) return false;\n    for (const target of runtime.repositories.values()) {";
  const stepReplacement = `    if (dt <= 0 || motionMedia.matches) return false;\n    for (const category of runtime.categories.values()) {\n      category.angle += tau * dt / (1800 * 1000);\n      category.node.x = Math.cos(category.angle) * category.categoryRadius;\n      category.node.y = Math.sin(category.angle) * category.categoryRadius;\n      category.node.vx = 0;\n      category.node.vy = 0;\n    }\n    for (const target of runtime.repositories.values()) {`;
  if (!patched.includes(stepAnchor)) throw new Error("Could not locate Galaxy Systems stepping boundary");
  patched = patched.replace(stepAnchor, stepReplacement);
  patched = patched.replace(
    "Living Galaxy Systems · categories are hubs · repositories orbit their category",
    "Galaxy Systems · slow category orbit · repositories orbit locally",
  );
  if (!patched.includes("360 + lane * 180") || !patched.includes("1800 * 1000")) throw new Error("Could not apply Galaxy Systems slow-motion policy");
  return patched;
}

async function emitGalaxyRuntimes(outputDir) {
  const sourceDir = resolve(process.cwd(), "scripts");
  await copyFile(join(sourceDir, "public-galaxy-common.js"), join(outputDir, "galaxy-common.js"));
  await copyFile(join(sourceDir, "public-galaxy-hybrid.js"), join(outputDir, "galaxy-hybrid-runtime.js"));
  await copyFile(join(sourceDir, "public-galaxy-edge-policy.js"), join(outputDir, "galaxy-edge-policy.js"));

  const classicTemplate = await readFile(join(sourceDir, "public-galaxy-classic.js"), "utf8");
  const systemsTemplate = await readFile(join(sourceDir, "public-galaxy-systems.js"), "utf8");
  await writeFile(join(outputDir, "galaxy-classic-runtime.js"), isolateRuntime(classicTemplate, "galaxy-classic"));
  await writeFile(join(outputDir, "galaxy-systems-runtime.js"), tuneSystemsRuntime(systemsTemplate));

  const htmlPath = join(outputDir, "u", "index.html");
  const html = await readFile(htmlPath, "utf8");
  if (!html.includes(VIEWER_SCRIPT)) throw new Error("Shared viewer script tag not found");
  const runtimeBlock = [COMMON_SCRIPT, CLASSIC_SCRIPT, SYSTEMS_SCRIPT, HYBRID_SCRIPT, OBSIDIAN_SCRIPT, EDGE_SCRIPT, POLISH_SCRIPT].join("\n");
  const next = html.includes(COMMON_SCRIPT) ? html : html.replace(VIEWER_SCRIPT, `${VIEWER_SCRIPT}\n${runtimeBlock}`);
  if (!next.includes(CLASSIC_SCRIPT) || !next.includes(SYSTEMS_SCRIPT) || !next.includes(HYBRID_SCRIPT)) throw new Error("Could not attach Galaxy family runtimes");
  if (next !== html) await writeFile(htmlPath, next);
}

async function emitObsidianRuntime(outputDir) {
  const sourcePath = resolve(process.cwd(), "scripts/public-obsidian-runtime.js");
  await copyFile(sourcePath, join(outputDir, "obsidian-runtime.js"));
}

async function emitInteractionPolish(outputDir) {
  const sourcePath = resolve(process.cwd(), "scripts/public-interaction-polish.js");
  await copyFile(sourcePath, join(outputDir, "interaction-polish.js"));
  for (const [route, viewerScript] of DEDICATED_VIEWERS) {
    const htmlPath = join(outputDir, route, "index.html");
    const html = await readFile(htmlPath, "utf8");
    if (!html.includes(viewerScript)) throw new Error(`Viewer script tag not found before interaction polish in ${htmlPath}`);
    const next = html.includes(POLISH_SCRIPT) ? html : html.replace(viewerScript, `${viewerScript}\n${POLISH_SCRIPT}`);
    if (next !== html) await writeFile(htmlPath, next);
  }
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
  await emitObsidianRuntime(outputDir);
  await emitGalaxyRuntimes(outputDir);
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
