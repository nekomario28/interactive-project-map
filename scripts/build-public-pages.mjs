import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { renderPagesHome, renderPagesViewer } from "./pages-app.mjs";

// Immutable Action commit containing all ten static renderers and Action wiring.
export const PUBLIC_ACTION_REF = "30c33c76008b282de8990333c879ae8c1da853d7";

const PRESETS = [
  { id: "radial", label: "Radial Tree", badge: "Classic", description: "Current classic: compact Owner → Category → Repository hierarchy around one center." },
  { id: "galaxy", label: "Galaxy", badge: "Spatial", description: "Semantic sectors and radial lanes. Best for a portfolio with many domains." },
  { id: "obsidian", label: "Obsidian-like", badge: "Organic", description: "Force-directed graph with a restrained desktop graph-tool feel." },
  { id: "tree", label: "Tree", badge: "Explicit", description: "Top-down hierarchy. Best when structure should be immediately obvious." },
  { id: "treemap", label: "Treemap", badge: "Dense", description: "Category area contains repository tiles. Best for dense portfolios and relative emphasis." },
  { id: "timeline", label: "Timeline", badge: "History", description: "Repository creation history across category lanes. Best for showing how a portfolio evolved." },
  { id: "cluster", label: "Cluster / Bubble", badge: "Density", description: "Category bubbles expose concentration and density. Best for very large repository sets." },
  { id: "sunburst", label: "Sunburst", badge: "Analytics", description: "Concentric Owner → Category → Repository rings with exterior category labels." },
  { id: "matrix", label: "Matrix / Heatmap", badge: "Analytics", description: "Category × Language cells reveal technical concentration and Original/Fork/Archived mix." },
  { id: "sankey", label: "Sankey", badge: "Analytics", description: "Owner → Category → Status flows summarize where projects concentrate and how much is original, forked or archived." },
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

function previewSvg(style) {
  const common = {
    radial: '<circle class="preview-ring" cx="120" cy="60" r="37"/><circle class="preview-ring" cx="120" cy="60" r="54"/><line class="preview-edge" x1="120" y1="60" x2="120" y2="23"/><line class="preview-edge" x1="120" y1="60" x2="84" y2="69"/><line class="preview-edge" x1="120" y1="60" x2="156" y2="72"/><circle class="preview-owner" cx="120" cy="60" r="9"/><circle class="preview-group" cx="120" cy="23" r="5"/><circle class="preview-group" cx="84" cy="69" r="5"/><circle class="preview-group" cx="156" cy="72" r="5"/><circle class="preview-original" cx="94" cy="12" r="4"/><circle class="preview-fork" cx="145" cy="12" r="4"/><circle class="preview-original" cx="56" cy="94" r="4"/><circle class="preview-archived" cx="190" cy="93" r="4"/>',
    galaxy: '<line class="preview-edge" x1="120" y1="58" x2="58" y2="32"/><line class="preview-edge" x1="120" y1="58" x2="181" y2="31"/><line class="preview-edge" x1="120" y1="58" x2="64" y2="91"/><line class="preview-edge" x1="120" y1="58" x2="178" y2="92"/><circle class="preview-owner" cx="120" cy="58" r="10"/><circle class="preview-group" cx="58" cy="32" r="5"/><circle class="preview-group" cx="181" cy="31" r="5"/><circle class="preview-original" cx="31" cy="22" r="4"/><circle class="preview-fork" cx="83" cy="17" r="4"/><circle class="preview-original" cx="208" cy="20" r="4"/><circle class="preview-archived" cx="202" cy="50" r="4"/><circle class="preview-original" cx="38" cy="101" r="4"/><circle class="preview-fork" cx="87" cy="105" r="4"/><circle class="preview-original" cx="207" cy="102" r="4"/>',
    obsidian: '<line class="preview-obsidian-edge" x1="48" y1="34" x2="111" y2="57"/><line class="preview-obsidian-edge" x1="111" y1="57" x2="177" y2="27"/><line class="preview-obsidian-edge" x1="111" y1="57" x2="191" y2="83"/><line class="preview-obsidian-edge" x1="111" y1="57" x2="70" y2="94"/><line class="preview-obsidian-edge" x1="70" y1="94" x2="24" y2="78"/><circle class="preview-obsidian-node" cx="111" cy="57" r="8"/><circle class="preview-obsidian-node" cx="48" cy="34" r="5"/><circle class="preview-original" cx="177" cy="27" r="5"/><circle class="preview-fork" cx="191" cy="83" r="5"/><circle class="preview-archived" cx="24" cy="78" r="4"/>',
    tree: '<path class="tree-line" d="M120 20V39M54 39H186M54 39V57M120 39V57M186 39V57M54 65V82M28 82H80M28 82V99M54 82V99M80 82V99M120 65V99M186 65V82M164 82H208M164 82V99M208 82V99"/><circle class="preview-owner" cx="120" cy="18" r="7"/><circle class="preview-group" cx="54" cy="62" r="5"/><circle class="preview-group" cx="120" cy="62" r="5"/><circle class="preview-group" cx="186" cy="62" r="5"/><circle class="preview-original" cx="28" cy="103" r="4"/><circle class="preview-fork" cx="54" cy="103" r="4"/><circle class="preview-archived" cx="120" cy="103" r="4"/><circle class="preview-original" cx="208" cy="103" r="4"/>',
    treemap: '<rect class="preview-group-box" x="8" y="8" width="128" height="104" rx="6"/><rect class="preview-group-box" x="142" y="8" width="90" height="55" rx="6"/><rect class="preview-group-box" x="142" y="69" width="90" height="43" rx="6"/><rect class="preview-original" x="13" y="30" width="62" height="76" rx="3"/><rect class="preview-fork" x="80" y="30" width="51" height="36" rx="3"/><rect class="preview-archived" x="80" y="71" width="51" height="35" rx="3"/><rect class="preview-original" x="147" y="29" width="47" height="29" rx="3"/><rect class="preview-fork" x="199" y="29" width="28" height="29" rx="3"/>',
    timeline: '<line class="preview-edge" x1="24" y1="28" x2="222" y2="28"/><line class="preview-edge" x1="24" y1="60" x2="222" y2="60"/><line class="preview-edge" x1="24" y1="92" x2="222" y2="92"/><line class="preview-tick" x1="68" y1="15" x2="68" y2="105"/><line class="preview-tick" x1="132" y1="15" x2="132" y2="105"/><line class="preview-tick" x1="196" y1="15" x2="196" y2="105"/><circle class="preview-original" cx="49" cy="28" r="5"/><circle class="preview-fork" cx="104" cy="60" r="5"/><circle class="preview-original" cx="146" cy="28" r="5"/><circle class="preview-archived" cx="177" cy="92" r="5"/><circle class="preview-original" cx="215" cy="60" r="5"/>',
    cluster: '<circle class="preview-cluster" cx="65" cy="58" r="42"/><circle class="preview-cluster" cx="155" cy="39" r="30"/><circle class="preview-cluster" cx="174" cy="89" r="24"/><circle class="preview-original" cx="50" cy="47" r="6"/><circle class="preview-original" cx="76" cy="66" r="5"/><circle class="preview-fork" cx="82" cy="39" r="5"/><circle class="preview-archived" cx="45" cy="72" r="4"/><circle class="preview-original" cx="145" cy="32" r="5"/><circle class="preview-fork" cx="168" cy="45" r="5"/><circle class="preview-original" cx="166" cy="84" r="5"/>',
    sunburst: '<circle class="preview-owner" cx="120" cy="60" r="17"/><path class="preview-sun-group" d="M120 34A26 26 0 0 1 146 60L139 60A19 19 0 0 0 120 41Z"/><path class="preview-sun-group" d="M146 60A26 26 0 0 1 96 72L103 69A19 19 0 0 0 139 60Z"/><path class="preview-sun-group" d="M96 72A26 26 0 0 1 120 34L120 41A19 19 0 0 0 103 69Z"/><path class="preview-original" d="M120 29A31 31 0 0 1 145 42L150 35A40 40 0 0 0 120 20Z"/><path class="preview-fork" d="M145 42A31 31 0 0 1 151 60L160 60A40 40 0 0 0 150 35Z"/><path class="preview-original" d="M151 60A31 31 0 0 1 103 87L98 95A40 40 0 0 0 160 60Z"/><path class="preview-archived" d="M103 87A31 31 0 0 1 120 29L120 20A40 40 0 0 0 98 95Z"/><line class="preview-edge" x1="151" y1="38" x2="214" y2="25"/><line class="preview-edge" x1="91" y1="34" x2="28" y2="20"/><line class="preview-edge" x1="88" y1="83" x2="30" y2="99"/>',
    matrix: '<g class="preview-matrix-grid"><rect x="28" y="18" width="52" height="25"/><rect x="84" y="18" width="52" height="25"/><rect x="140" y="18" width="52" height="25"/><rect x="28" y="47" width="52" height="25"/><rect x="84" y="47" width="52" height="25"/><rect x="140" y="47" width="52" height="25"/><rect x="28" y="76" width="52" height="25"/><rect x="84" y="76" width="52" height="25"/><rect x="140" y="76" width="52" height="25"/></g><rect class="preview-original" x="33" y="93" width="22" height="3"/><rect class="preview-fork" x="55" y="93" width="12" height="3"/><rect class="preview-archived" x="67" y="93" width="8" height="3"/>',
    sankey: '<rect class="preview-owner" x="20" y="24" width="10" height="72" rx="3"/><path class="preview-sankey-flow" d="M30 28C70 28 72 20 108 20V48C72 48 70 48 30 48Z"/><path class="preview-sankey-flow" d="M30 51C70 51 72 55 108 55V78C72 78 70 78 30 78Z"/><path class="preview-sankey-flow" d="M30 81C70 81 72 87 108 87V96C72 96 70 96 30 96Z"/><rect class="preview-group" x="108" y="20" width="10" height="28" rx="3"/><rect class="preview-group" x="108" y="55" width="10" height="23" rx="3"/><rect class="preview-group" x="108" y="87" width="10" height="9" rx="3"/><path class="preview-original" d="M118 21C153 21 157 21 196 21V54C157 54 153 46 118 46Z"/><path class="preview-fork" d="M118 57C153 57 157 61 196 61V78C157 78 153 76 118 76Z"/><path class="preview-archived" d="M118 89C153 89 157 88 196 88V99C157 99 153 95 118 95Z"/><rect class="preview-original" x="196" y="21" width="9" height="33" rx="2"/><rect class="preview-fork" x="196" y="61" width="9" height="17" rx="2"/><rect class="preview-archived" x="196" y="88" width="9" height="11" rx="2"/>',
  };
  return `<svg viewBox="0 0 240 120" aria-hidden="true" focusable="false">${common[style] || ""}</svg>`;
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
  const activeStyle = mode === "graph" ? "galaxy" : mode;
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
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
