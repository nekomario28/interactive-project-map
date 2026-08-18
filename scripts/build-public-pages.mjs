import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { renderPagesHome, renderPagesViewer } from "./pages-app.mjs";

// Immutable Action commit containing all seven static renderers.
export const PUBLIC_ACTION_REF = "b3d8ab278be0fecd1ba9ee66c59cd01624bfd541";

function externalizeBrowserScript(html, src) {
  const pattern = /<script>[\s\S]*?<\/script>/;
  if (!pattern.test(html)) throw new Error(`Expected one inline browser script for ${src}`);
  return html.replace("script-src 'unsafe-inline'", "script-src 'self'").replace(pattern, `<script src="${src}" defer></script>`);
}
function normalizePublicHtml(html) {
  return html.replace('<input id="username"', '<input id="username" type="text"').replace('<a id="openMap" class="button" target="_blank" rel="noopener">', '<a id="openMap" class="button" href="./radial/" target="_blank" rel="noopener">');
}
function stylePresetGallery() {
  return `<div class="preset-title">Choose a visual language</div><div class="preset-gallery">
<button class="preset-card is-selected" type="button" data-style-preset="radial" aria-pressed="true"><span class="badge">Classic</span><svg viewBox="0 0 240 120" aria-hidden="true" focusable="false"><circle class="preview-ring" cx="120" cy="60" r="37"/><circle class="preview-ring" cx="120" cy="60" r="54"/><line class="preview-edge" x1="120" y1="60" x2="120" y2="23"/><line class="preview-edge" x1="120" y1="60" x2="84" y2="69"/><line class="preview-edge" x1="120" y1="60" x2="156" y2="72"/><line class="preview-edge" x1="120" y1="23" x2="95" y2="11"/><line class="preview-edge" x1="120" y1="23" x2="145" y2="12"/><line class="preview-edge" x1="84" y1="69" x2="61" y2="92"/><line class="preview-edge" x1="84" y1="69" x2="49" y2="61"/><line class="preview-edge" x1="156" y1="72" x2="183" y2="94"/><line class="preview-edge" x1="156" y1="72" x2="194" y2="62"/><circle class="preview-owner" cx="120" cy="60" r="9"/><circle class="preview-group" cx="120" cy="23" r="5"/><circle class="preview-group" cx="84" cy="69" r="5"/><circle class="preview-group" cx="156" cy="72" r="5"/><circle class="preview-original" cx="95" cy="11" r="4"/><circle class="preview-fork" cx="145" cy="12" r="4"/><circle class="preview-original" cx="61" cy="92" r="4"/><circle class="preview-archived" cx="49" cy="61" r="4"/><circle class="preview-original" cx="183" cy="94" r="4"/><circle class="preview-fork" cx="194" cy="62" r="4"/></svg><strong>Radial Tree</strong><small>Current classic: compact Owner → Category → Repository hierarchy around one center.</small></button>
<button class="preset-card" type="button" data-style-preset="galaxy" aria-pressed="false"><span class="badge">Spatial</span><svg viewBox="0 0 240 120" aria-hidden="true" focusable="false"><line class="preview-edge" x1="120" y1="58" x2="58" y2="32"/><line class="preview-edge" x1="120" y1="58" x2="181" y2="31"/><line class="preview-edge" x1="120" y1="58" x2="64" y2="91"/><line class="preview-edge" x1="120" y1="58" x2="178" y2="92"/><circle class="preview-owner" cx="120" cy="58" r="10"/><circle class="preview-group" cx="58" cy="32" r="5"/><circle class="preview-group" cx="181" cy="31" r="5"/><circle class="preview-original" cx="31" cy="22" r="4"/><circle class="preview-fork" cx="83" cy="17" r="4"/><circle class="preview-original" cx="208" cy="20" r="4"/><circle class="preview-archived" cx="202" cy="50" r="4"/><circle class="preview-original" cx="38" cy="101" r="4"/><circle class="preview-fork" cx="87" cy="105" r="4"/><circle class="preview-original" cx="207" cy="102" r="4"/></svg><strong>Galaxy</strong><small>Semantic sectors and radial lanes. Best for a portfolio with many domains.</small></button>
<button class="preset-card" type="button" data-style-preset="obsidian" aria-pressed="false"><span class="badge">Organic</span><svg viewBox="0 0 240 120" aria-hidden="true" focusable="false"><line class="preview-obsidian-edge" x1="48" y1="34" x2="111" y2="57"/><line class="preview-obsidian-edge" x1="111" y1="57" x2="177" y2="27"/><line class="preview-obsidian-edge" x1="111" y1="57" x2="191" y2="83"/><line class="preview-obsidian-edge" x1="111" y1="57" x2="70" y2="94"/><line class="preview-obsidian-edge" x1="70" y1="94" x2="24" y2="78"/><line class="preview-obsidian-edge" x1="177" y1="27" x2="216" y2="48"/><circle class="preview-obsidian-node" cx="111" cy="57" r="8"/><circle class="preview-obsidian-node" cx="48" cy="34" r="5"/><circle class="preview-original" cx="177" cy="27" r="5"/><circle class="preview-fork" cx="191" cy="83" r="5"/><circle class="preview-obsidian-node" cx="70" cy="94" r="5"/><circle class="preview-archived" cx="24" cy="78" r="4"/><circle class="preview-original" cx="216" cy="48" r="4"/></svg><strong>Obsidian-like</strong><small>Force-directed graph with a restrained desktop graph-tool feel.</small></button>
<button class="preset-card" type="button" data-style-preset="tree" aria-pressed="false"><span class="badge">Explicit</span><svg viewBox="0 0 240 120" aria-hidden="true" focusable="false"><path class="tree-line" d="M120 20V39M54 39H186M54 39V57M120 39V57M186 39V57M54 65V82M28 82H80M28 82V99M54 82V99M80 82V99M120 65V99M186 65V82M164 82H208M164 82V99M208 82V99"/><circle class="preview-owner" cx="120" cy="18" r="7"/><circle class="preview-group" cx="54" cy="62" r="5"/><circle class="preview-group" cx="120" cy="62" r="5"/><circle class="preview-group" cx="186" cy="62" r="5"/><circle class="preview-original" cx="28" cy="103" r="4"/><circle class="preview-fork" cx="54" cy="103" r="4"/><circle class="preview-original" cx="80" cy="103" r="4"/><circle class="preview-archived" cx="120" cy="103" r="4"/><circle class="preview-original" cx="164" cy="103" r="4"/><circle class="preview-fork" cx="208" cy="103" r="4"/></svg><strong>Tree</strong><small>Top-down hierarchy. Best when structure should be immediately obvious.</small></button>
<button class="preset-card" type="button" data-style-preset="treemap" aria-pressed="false"><span class="badge">Dense</span><svg viewBox="0 0 240 120" aria-hidden="true" focusable="false"><rect class="preview-group-box" x="8" y="8" width="128" height="104" rx="6"/><rect class="preview-group-box" x="142" y="8" width="90" height="55" rx="6"/><rect class="preview-group-box" x="142" y="69" width="90" height="43" rx="6"/><rect class="preview-original" x="13" y="30" width="62" height="76" rx="3"/><rect class="preview-fork" x="80" y="30" width="51" height="36" rx="3"/><rect class="preview-archived" x="80" y="71" width="51" height="35" rx="3"/><rect class="preview-original" x="147" y="29" width="47" height="29" rx="3"/><rect class="preview-fork" x="199" y="29" width="28" height="29" rx="3"/><rect class="preview-original" x="147" y="88" width="36" height="19" rx="3"/><rect class="preview-archived" x="188" y="88" width="39" height="19" rx="3"/></svg><strong>Treemap</strong><small>Category area contains repository tiles. Best for dense portfolios and relative emphasis.</small></button>
<button class="preset-card" type="button" data-style-preset="timeline" aria-pressed="false"><span class="badge">History</span><svg viewBox="0 0 240 120" aria-hidden="true" focusable="false"><line class="preview-edge" x1="24" y1="28" x2="222" y2="28"/><line class="preview-edge" x1="24" y1="60" x2="222" y2="60"/><line class="preview-edge" x1="24" y1="92" x2="222" y2="92"/><line class="preview-tick" x1="68" y1="15" x2="68" y2="105"/><line class="preview-tick" x1="132" y1="15" x2="132" y2="105"/><line class="preview-tick" x1="196" y1="15" x2="196" y2="105"/><circle class="preview-original" cx="49" cy="28" r="5"/><circle class="preview-fork" cx="104" cy="60" r="5"/><circle class="preview-original" cx="146" cy="28" r="5"/><circle class="preview-archived" cx="177" cy="92" r="5"/><circle class="preview-original" cx="215" cy="60" r="5"/></svg><strong>Timeline</strong><small>Repository creation history across category lanes. Best for showing how a portfolio evolved.</small></button>
<button class="preset-card" type="button" data-style-preset="cluster" aria-pressed="false"><span class="badge">Density</span><svg viewBox="0 0 240 120" aria-hidden="true" focusable="false"><circle class="preview-cluster" cx="65" cy="58" r="42"/><circle class="preview-cluster" cx="155" cy="39" r="30"/><circle class="preview-cluster" cx="174" cy="89" r="24"/><circle class="preview-original" cx="50" cy="47" r="6"/><circle class="preview-original" cx="76" cy="66" r="5"/><circle class="preview-fork" cx="82" cy="39" r="5"/><circle class="preview-archived" cx="45" cy="72" r="4"/><circle class="preview-original" cx="145" cy="32" r="5"/><circle class="preview-fork" cx="168" cy="45" r="5"/><circle class="preview-original" cx="166" cy="84" r="5"/><circle class="preview-archived" cx="184" cy="94" r="4"/></svg><strong>Cluster / Bubble</strong><small>Category bubbles expose concentration and density. Best for very large repository sets.</small></button>
</div>`;
}
function addHomeStylePreset(html) {
  const marker = '<div class="options">';
  const control = '<label>Map style <select id="mapStyle"><option value="radial">Radial Tree (Classic)</option><option value="galaxy">Galaxy</option><option value="obsidian">Obsidian-like</option><option value="tree">Tree</option><option value="treemap">Treemap</option><option value="timeline">Timeline</option><option value="cluster">Cluster / Bubble</option></select></label>';
  if (!html.includes(marker)) throw new Error("Could not find generator options container");
  return html.replace("style-src 'unsafe-inline'", "style-src 'self' 'unsafe-inline'").replace("</head>", '<link rel="stylesheet" href="./presets.css">\n</head>').replace(marker, `${stylePresetGallery()}\n${marker}\n${control}`);
}
function viewerBody({ mode = "graph" } = {}) {
  const dedicatedStyles = new Set(["radial", "tree", "treemap", "timeline", "cluster"]);
  const activeStyle = mode === "graph" ? "galaxy" : mode;
  const dedicatedNav = '<script src="../tree-nav.js" defer></script>\n';
  const scripts = dedicatedStyles.has(mode) ? `${dedicatedNav}<script src="../${mode}-viewer.js" defer></script>` : '<script src="../tree-router.js" defer></script>\n<script src="../viewer.js" defer></script>';
  const selected = (style) => activeStyle === style ? " selected" : "";
  return `<body data-map-style="${activeStyle}"><main class="app"><header class="toolbar"><div class="title-block"><h1 id="title">Interactive Project Map</h1><p id="subtitle">Loading project graph…</p></div><div class="controls"><label class="field"><span>Search</span><input id="search" type="search" placeholder="Project, category, language or topic" autocomplete="off"></label><label class="field"><span>Style</span><select id="style"><option value="radial"${selected("radial")}>Radial Tree (Classic)</option><option value="galaxy"${selected("galaxy")}>Galaxy</option><option value="obsidian">Obsidian-like</option><option value="tree"${selected("tree")}>Tree</option><option value="treemap"${selected("treemap")}>Treemap</option><option value="timeline"${selected("timeline")}>Timeline</option><option value="cluster"${selected("cluster")}>Cluster / Bubble</option></select></label><button id="fit" type="button">Fit</button><button id="reset" type="button">Reset</button></div></header><section class="workspace"><canvas id="galaxy" tabindex="0" aria-label="Interactive project graph"></canvas><aside id="details" class="details" aria-live="polite"><button id="detailsClose" class="details-close" type="button" aria-label="Close project details">×</button><h2 id="detailsTitle">Project map</h2><p id="detailsDescription">Select a project to inspect it.</p><dl id="detailsMeta" hidden></dl><a id="detailsLink" href="https://github.com/" target="_blank" rel="noopener" hidden>Open on GitHub ↗</a></aside><div class="legend"><span><i class="owner"></i>Owner</span><span><i class="group"></i>Category</span><span><i class="original"></i>Original</span><span><i class="fork"></i>Fork</span><span><i class="archived"></i>Archived</span><span><i class="relation"></i>Relation</span></div><div id="tip" class="tip" role="status" hidden></div><div id="status" class="status">Loading map…</div><div id="error" class="error" role="alert"><div id="errorText">Could not load project map.</div><a id="setup" href="../">Generate setup</a></div></section><footer><span>Static graph from the profile repository · no shared GitHub REST request while viewing</span><span class="shortcuts"><kbd>0</kbd> Fit · <kbd>+</kbd>/<kbd>−</kbd> Zoom · <kbd>Enter</kbd> Open · <kbd>Esc</kbd> Close</span></footer></main>${scripts}</body>`;
}
function enhanceViewer(html, options = {}) {
  const bodyPattern = /<body>[\s\S]*?<\/body>/;
  if (!bodyPattern.test(html)) throw new Error("Could not find viewer body");
  return html.replace(/<style>[\s\S]*?<\/style>/, "").replace("style-src 'unsafe-inline'", "style-src 'self'").replace("</head>", '<link rel="stylesheet" href="../viewer.css">\n</head>').replace(bodyPattern, viewerBody(options));
}
export async function buildPublicPages(outputDir = join(process.cwd(), "site")) {
  await rm(outputDir, { recursive: true, force: true });
  const dedicated = ["radial", "tree", "treemap", "timeline", "cluster"];
  for (const dir of ["u", ...dedicated]) await mkdir(join(outputDir, dir), { recursive: true });
  const sourceDir = join(process.cwd(), "scripts");
  const homeScript = (await readFile(join(sourceDir, "public-home.js"), "utf8")).replaceAll("__PROJECT_MAP_ACTION_REF__", PUBLIC_ACTION_REF);
  const viewerScript = await readFile(join(sourceDir, "public-viewer.js"), "utf8");
  const routerScript = await readFile(join(sourceDir, "public-tree-router.js"), "utf8");
  const navScript = await readFile(join(sourceDir, "public-tree-nav.js"), "utf8");
  const viewerCss = await readFile(join(sourceDir, "public-viewer.css"), "utf8");
  const presetCss = await readFile(join(sourceDir, "public-home-presets.css"), "utf8");
  const baseHome = normalizePublicHtml(externalizeBrowserScript(renderPagesHome(), "./app.js"));
  const baseViewer = normalizePublicHtml(externalizeBrowserScript(renderPagesViewer(), "../viewer.js"));
  const home = addHomeStylePreset(baseHome);
  const sharedViewer = enhanceViewer(baseViewer, { mode: "graph" });
  await writeFile(join(outputDir, ".nojekyll"), "\n");
  await writeFile(join(outputDir, "index.html"), home);
  await writeFile(join(outputDir, "app.js"), homeScript);
  await writeFile(join(outputDir, "presets.css"), presetCss);
  await writeFile(join(outputDir, "viewer.js"), viewerScript);
  await writeFile(join(outputDir, "tree-router.js"), routerScript);
  await writeFile(join(outputDir, "tree-nav.js"), navScript);
  await writeFile(join(outputDir, "viewer.css"), viewerCss);
  await writeFile(join(outputDir, "u", "index.html"), sharedViewer);
  for (const mode of dedicated) {
    const script = await readFile(join(sourceDir, `public-${mode}-viewer.js`), "utf8");
    await writeFile(join(outputDir, `${mode}-viewer.js`), script);
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
