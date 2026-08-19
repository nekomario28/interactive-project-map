import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { renderPagesHome, renderPagesViewer } from "./pages-app.mjs";

// Immutable Action commit used by the source builder. postprocess-public-pages.mjs
// promotes generated setup to the latest reviewed public Action commit.
export const PUBLIC_ACTION_REF = "30c33c76008b282de8990333c879ae8c1da853d7";

const PRESETS = [
  { id: "radial", label: "Radial Tree", badge: "Classic", description: "Compact Owner → Category → Repository hierarchy around one center." },
  { id: "galaxy-classic", label: "Galaxy Classic", badge: "Galaxy", description: "The original living single-galaxy presentation with global differential motion." },
  { id: "galaxy-systems", label: "Galaxy Systems", badge: "Galaxy", description: "Categories orbit the owner very slowly; repositories orbit their local category system." },
  { id: "galaxy-hybrid", label: "Galaxy Hybrid", badge: "Galaxy", description: "A single spiral galaxy whose category systems retain local elliptical repository orbits." },
  { id: "obsidian", label: "Obsidian-like", badge: "Organic", description: "Settled global force graph with Obsidian-style interaction behavior." },
  { id: "tree", label: "Tree", badge: "Explicit", description: "Top-down hierarchy for immediately obvious structure." },
  { id: "treemap", label: "Treemap", badge: "Dense", description: "Category area contains repository tiles for dense portfolios." },
  { id: "timeline", label: "Timeline", badge: "History", description: "Repository creation history across category lanes." },
  { id: "cluster", label: "Cluster / Bubble", badge: "Density", description: "Category bubbles expose concentration and density." },
  { id: "sunburst", label: "Sunburst", badge: "Analytics", description: "Concentric Owner → Category → Repository rings." },
  { id: "matrix", label: "Matrix / Heatmap", badge: "Analytics", description: "Category × Language cells reveal technical concentration." },
  { id: "sankey", label: "Sankey", badge: "Analytics", description: "Owner → Category → Status flows summarize the portfolio." },
];

const DEDICATED_STYLES = ["radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"];

function externalizeBrowserScript(html, src) {
  const pattern = /<script>[\s\S]*?<\/script>/;
  if (!pattern.test(html)) throw new Error(`Expected one inline browser script for ${src}`);
  return html.replace("script-src 'unsafe-inline'", "script-src 'self'").replace(pattern, `<script src="${src}" defer></script>`);
}

function normalizePublicHtml(html) {
  return html
    .replace('<input id="username"', '<input id="username" type="text"')
    .replace('<a id="openMap" class="button" target="_blank" rel="noopener">', '<a id="openMap" class="button" href="./radial/" target="_blank" rel="noopener">');
}

function galaxyPreview(kind) {
  if (kind === "galaxy-classic") return '<path class="preview-edge" d="M120 60C76 22 35 40 40 78C44 112 96 103 126 74C156 45 207 19 215 55"/><circle class="preview-owner" cx="120" cy="60" r="9"/><circle class="preview-original" cx="54" cy="44" r="4"/><circle class="preview-fork" cx="44" cy="86" r="4"/><circle class="preview-original" cx="178" cy="35" r="4"/><circle class="preview-archived" cx="205" cy="68" r="4"/>';
  if (kind === "galaxy-systems") return '<circle class="preview-owner" cx="120" cy="60" r="9"/><circle class="preview-ring" cx="62" cy="42" r="22"/><circle class="preview-ring" cx="179" cy="44" r="22"/><circle class="preview-ring" cx="119" cy="95" r="18"/><circle class="preview-group" cx="62" cy="42" r="5"/><circle class="preview-group" cx="179" cy="44" r="5"/><circle class="preview-group" cx="119" cy="95" r="5"/><circle class="preview-original" cx="42" cy="42" r="4"/><circle class="preview-fork" cx="184" cy="64" r="4"/><circle class="preview-original" cx="135" cy="101" r="4"/>';
  return '<path class="preview-edge" d="M120 60C91 22 54 17 40 44M120 60C150 91 187 99 211 73"/><circle class="preview-owner" cx="120" cy="60" r="9"/><ellipse class="preview-ring" cx="61" cy="38" rx="24" ry="14"/><ellipse class="preview-ring" cx="182" cy="86" rx="25" ry="15"/><circle class="preview-group" cx="61" cy="38" r="5"/><circle class="preview-group" cx="182" cy="86" r="5"/><circle class="preview-original" cx="42" cy="34" r="4"/><circle class="preview-fork" cx="82" cy="43" r="4"/><circle class="preview-original" cx="161" cy="82" r="4"/><circle class="preview-archived" cx="204" cy="91" r="4"/>';
}

function previewSvg(style) {
  const galaxy = style.startsWith("galaxy-") ? galaxyPreview(style) : null;
  const generic = {
    radial: '<circle class="preview-ring" cx="120" cy="60" r="38"/><circle class="preview-owner" cx="120" cy="60" r="9"/><circle class="preview-group" cx="120" cy="22" r="5"/><circle class="preview-group" cx="84" cy="72" r="5"/><circle class="preview-group" cx="156" cy="72" r="5"/>',
    obsidian: '<line class="preview-obsidian-edge" x1="48" y1="34" x2="111" y2="57"/><line class="preview-obsidian-edge" x1="111" y1="57" x2="177" y2="27"/><line class="preview-obsidian-edge" x1="111" y1="57" x2="191" y2="83"/><circle class="preview-obsidian-node" cx="111" cy="57" r="8"/><circle class="preview-original" cx="177" cy="27" r="5"/><circle class="preview-fork" cx="191" cy="83" r="5"/>',
    tree: '<path class="tree-line" d="M120 18V44M54 44H186M54 44V70M120 44V70M186 44V70"/><circle class="preview-owner" cx="120" cy="18" r="7"/><circle class="preview-group" cx="54" cy="72" r="5"/><circle class="preview-group" cx="120" cy="72" r="5"/><circle class="preview-group" cx="186" cy="72" r="5"/>',
    treemap: '<rect class="preview-group-box" x="10" y="10" width="132" height="100" rx="6"/><rect class="preview-group-box" x="148" y="10" width="82" height="100" rx="6"/><rect class="preview-original" x="18" y="34" width="70" height="68" rx="3"/><rect class="preview-fork" x="94" y="34" width="40" height="68" rx="3"/>',
    timeline: '<line class="preview-edge" x1="24" y1="30" x2="220" y2="30"/><line class="preview-edge" x1="24" y1="60" x2="220" y2="60"/><line class="preview-edge" x1="24" y1="90" x2="220" y2="90"/><circle class="preview-original" cx="54" cy="30" r="5"/><circle class="preview-fork" cx="112" cy="60" r="5"/><circle class="preview-archived" cx="184" cy="90" r="5"/>',
    cluster: '<circle class="preview-cluster" cx="65" cy="58" r="42"/><circle class="preview-cluster" cx="160" cy="45" r="31"/><circle class="preview-cluster" cx="175" cy="91" r="22"/>',
    sunburst: '<circle class="preview-owner" cx="120" cy="60" r="17"/><circle class="preview-ring" cx="120" cy="60" r="29"/><circle class="preview-ring" cx="120" cy="60" r="43"/>',
    matrix: '<g class="preview-matrix-grid"><rect x="28" y="18" width="52" height="25"/><rect x="84" y="18" width="52" height="25"/><rect x="140" y="18" width="52" height="25"/><rect x="28" y="47" width="52" height="25"/><rect x="84" y="47" width="52" height="25"/><rect x="140" y="47" width="52" height="25"/></g>',
    sankey: '<rect class="preview-owner" x="20" y="24" width="10" height="72" rx="3"/><path class="preview-sankey-flow" d="M30 28C70 28 72 20 108 20V48C72 48 70 48 30 48Z"/><path class="preview-sankey-flow" d="M30 54C70 54 72 64 108 64V92C72 92 70 80 30 80Z"/><rect class="preview-group" x="108" y="20" width="10" height="28" rx="3"/><rect class="preview-group" x="108" y="64" width="10" height="28" rx="3"/>',
  };
  return `<svg viewBox="0 0 240 120" aria-hidden="true" focusable="false">${galaxy || generic[style] || ""}</svg>`;
}

function stylePresetGallery() {
  return `<div class="preset-title">Choose a visual language</div><div class="preset-gallery">${PRESETS.map((preset, index) => `<button class="preset-card${index === 0 ? " is-selected" : ""}" type="button" data-style-preset="${preset.id}" aria-pressed="${index === 0}"><span class="badge">${preset.badge}</span>${previewSvg(preset.id)}<strong>${preset.label}</strong><small>${preset.description}</small></button>`).join("")}</div>`;
}

function styleOptions(active = "radial") {
  return PRESETS.map((preset) => `<option value="${preset.id}"${preset.id === active ? " selected" : ""}>${preset.id === "radial" ? "Radial Tree (Classic)" : preset.label}</option>`).join("");
}

function addHomeStylePreset(html) {
  const marker = '<div class="options">';
  const control = `<label>Map style <select id="mapStyle">${styleOptions("radial")}</select></label>`;
  if (!html.includes(marker)) throw new Error("Could not find generator options container");
  return html.replace("style-src 'unsafe-inline'", "style-src 'self' 'unsafe-inline'").replace("</head>", '<link rel="stylesheet" href="./presets.css">\n</head>').replace(marker, `${stylePresetGallery()}\n${marker}\n${control}`);
}

function viewerBody({ mode = "graph" } = {}) {
  const activeStyle = mode === "graph" ? "galaxy-systems" : mode;
  const scripts = DEDICATED_STYLES.includes(mode)
    ? `<script src="../tree-nav.js" defer></script>\n<script src="../${mode}-viewer.js" defer></script>`
    : '<script src="../tree-router.js" defer></script>\n<script src="../viewer.js" defer></script>';
  return `<body data-map-style="${activeStyle}"><main class="app"><header class="toolbar"><div class="title-block"><h1 id="title">Interactive Project Map</h1><p id="subtitle">Loading project graph…</p></div><div class="controls"><label class="field"><span>Search</span><input id="search" type="search" placeholder="Project, category, language or topic" autocomplete="off"></label><label class="field"><span>Style</span><select id="style">${styleOptions(activeStyle)}</select></label><button id="fit" type="button">Fit</button><button id="reset" type="button">Reset</button></div></header><section class="workspace"><canvas id="galaxy" tabindex="0" aria-label="Interactive project graph"></canvas><aside id="details" class="details" aria-live="polite"><button id="detailsClose" class="details-close" type="button" aria-label="Close project details">×</button><h2 id="detailsTitle">Project map</h2><p id="detailsDescription">Select a project to inspect it.</p><dl id="detailsMeta" hidden></dl><a id="detailsLink" href="https://github.com/" target="_blank" rel="noopener" hidden>Open on GitHub ↗</a></aside><div class="legend"><span><i class="owner"></i>Owner</span><span><i class="group"></i>Category</span><span><i class="original"></i>Original</span><span><i class="fork"></i>Fork</span><span><i class="archived"></i>Archived</span><span><i class="relation"></i>Relation</span></div><div id="tip" class="tip" role="status" hidden></div><div id="status" class="status">Loading map…</div><div id="error" class="error" role="alert"><div id="errorText">Could not load project map.</div><a id="setup" href="../">Generate setup</a></div></section><footer><span>Static graph from the profile repository · no shared GitHub REST request while viewing</span><span class="shortcuts"><kbd>0</kbd> Fit · <kbd>+</kbd>/<kbd>−</kbd> Zoom · <kbd>Enter</kbd> Open · <kbd>Esc</kbd> Close</span></footer></main>${scripts}</body>`;
}

function enhanceViewer(html, options = {}) {
  const bodyPattern = /<body>[\s\S]*?<\/body>/;
  if (!bodyPattern.test(html)) throw new Error("Could not find viewer body");
  return html.replace(/<style>[\s\S]*?<\/style>/, "").replace("style-src 'unsafe-inline'", "style-src 'self'").replace("</head>", '<link rel="stylesheet" href="../viewer.css">\n</head>').replace(bodyPattern, viewerBody(options));
}

export async function buildPublicPages(outputDir = join(process.cwd(), "site")) {
  await rm(outputDir, { recursive: true, force: true });
  for (const dir of ["u", ...DEDICATED_STYLES]) await mkdir(join(outputDir, dir), { recursive: true });
  const sourceDir = join(process.cwd(), "scripts");
  const homeScript = (await readFile(join(sourceDir, "public-home.js"), "utf8")).replaceAll("__PROJECT_MAP_ACTION_REF__", PUBLIC_ACTION_REF);
  const viewerScript = await readFile(join(sourceDir, "public-viewer.js"), "utf8");
  const routerScript = await readFile(join(sourceDir, "public-tree-router.js"), "utf8");
  const navScript = await readFile(join(sourceDir, "public-tree-nav.js"), "utf8");
  const viewerCss = await readFile(join(sourceDir, "public-viewer.css"), "utf8");
  const presetCss = await readFile(join(sourceDir, "public-home-presets.css"), "utf8");
  const baseHome = normalizePublicHtml(externalizeBrowserScript(renderPagesHome(), "./app.js"));
  const baseViewer = normalizePublicHtml(externalizeBrowserScript(renderPagesViewer(), "../viewer.js"));
  await writeFile(join(outputDir, ".nojekyll"), "\n");
  await writeFile(join(outputDir, "index.html"), addHomeStylePreset(baseHome));
  await writeFile(join(outputDir, "app.js"), homeScript);
  await writeFile(join(outputDir, "presets.css"), presetCss);
  await writeFile(join(outputDir, "viewer.js"), viewerScript);
  await writeFile(join(outputDir, "tree-router.js"), routerScript);
  await writeFile(join(outputDir, "tree-nav.js"), navScript);
  await writeFile(join(outputDir, "viewer.css"), viewerCss);
  await writeFile(join(outputDir, "u", "index.html"), enhanceViewer(baseViewer, { mode: "graph" }));
  for (const mode of DEDICATED_STYLES) {
    await writeFile(join(outputDir, `${mode}-viewer.js`), await readFile(join(sourceDir, `public-${mode}-viewer.js`), "utf8"));
    await writeFile(join(outputDir, mode, "index.html"), enhanceViewer(baseViewer, { mode }));
  }
}

async function main() {
  const outputDir = join(process.cwd(), "site");
  await buildPublicPages(outputDir);
  console.log(`Built public GitHub Pages app into ${outputDir}`);
  console.log(`Installer Action ref: ${PUBLIC_ACTION_REF}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
