import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { renderPagesHome, renderPagesViewer } from "./pages-app.mjs";

// Immutable Action commit containing galaxy, obsidian and tree SVG generation.
export const PUBLIC_ACTION_REF = "c442b8830fa0b9a7212326de764b55b2b99ac18b";

function externalizeBrowserScript(html, src) {
  const scriptPattern = /<script>[\s\S]*?<\/script>/;
  if (!scriptPattern.test(html)) {
    throw new Error(`Expected one inline browser script for ${src}`);
  }
  return html
    .replace("script-src 'unsafe-inline'", "script-src 'self'")
    .replace(scriptPattern, `<script src="${src}" defer></script>`);
}

function normalizePublicHtml(html) {
  return html
    .replace('<input id="username"', '<input id="username" type="text"')
    .replace(
      '<a id="openMap" class="button" target="_blank" rel="noopener">',
      '<a id="openMap" class="button" href="./u/" target="_blank" rel="noopener">',
    );
}

function stylePresetGallery() {
  return `<div class="preset-title">Choose a visual language</div>
<div class="preset-gallery">
  <button class="preset-card is-selected" type="button" data-style-preset="galaxy" aria-pressed="true">
    <span class="badge">Spatial</span>
    <svg viewBox="0 0 240 120" aria-hidden="true" focusable="false">
      <line class="preview-edge" x1="120" y1="58" x2="58" y2="32"/><line class="preview-edge" x1="120" y1="58" x2="181" y2="31"/><line class="preview-edge" x1="120" y1="58" x2="64" y2="91"/><line class="preview-edge" x1="120" y1="58" x2="178" y2="92"/>
      <circle class="preview-owner" cx="120" cy="58" r="10"/><circle class="preview-group" cx="58" cy="32" r="5"/><circle class="preview-group" cx="181" cy="31" r="5"/><circle class="preview-original" cx="31" cy="22" r="4"/><circle class="preview-fork" cx="83" cy="17" r="4"/><circle class="preview-original" cx="208" cy="20" r="4"/><circle class="preview-archived" cx="202" cy="50" r="4"/><circle class="preview-original" cx="38" cy="101" r="4"/><circle class="preview-fork" cx="87" cy="105" r="4"/><circle class="preview-original" cx="207" cy="102" r="4"/>
    </svg>
    <strong>Galaxy</strong><small>Semantic sectors and radial lanes. Best for a portfolio with many domains.</small>
  </button>
  <button class="preset-card" type="button" data-style-preset="obsidian" aria-pressed="false">
    <span class="badge">Organic</span>
    <svg viewBox="0 0 240 120" aria-hidden="true" focusable="false">
      <line class="preview-obsidian-edge" x1="48" y1="34" x2="111" y2="57"/><line class="preview-obsidian-edge" x1="111" y1="57" x2="177" y2="27"/><line class="preview-obsidian-edge" x1="111" y1="57" x2="191" y2="83"/><line class="preview-obsidian-edge" x1="111" y1="57" x2="70" y2="94"/><line class="preview-obsidian-edge" x1="70" y1="94" x2="24" y2="78"/><line class="preview-obsidian-edge" x1="177" y1="27" x2="216" y2="48"/>
      <circle class="preview-obsidian-node" cx="111" cy="57" r="8"/><circle class="preview-obsidian-node" cx="48" cy="34" r="5"/><circle class="preview-original" cx="177" cy="27" r="5"/><circle class="preview-fork" cx="191" cy="83" r="5"/><circle class="preview-obsidian-node" cx="70" cy="94" r="5"/><circle class="preview-archived" cx="24" cy="78" r="4"/><circle class="preview-original" cx="216" cy="48" r="4"/>
    </svg>
    <strong>Obsidian-like</strong><small>Force-directed graph with a restrained desktop graph-tool feel.</small>
  </button>
  <button class="preset-card" type="button" data-style-preset="tree" aria-pressed="false">
    <span class="badge">Explicit</span>
    <svg viewBox="0 0 240 120" aria-hidden="true" focusable="false">
      <path class="tree-line" d="M120 20V39M54 39H186M54 39V57M120 39V57M186 39V57M54 65V82M28 82H80M28 82V99M54 82V99M80 82V99M120 65V99M186 65V82M164 82H208M164 82V99M208 82V99"/>
      <circle class="preview-owner" cx="120" cy="18" r="7"/><circle class="preview-group" cx="54" cy="62" r="5"/><circle class="preview-group" cx="120" cy="62" r="5"/><circle class="preview-group" cx="186" cy="62" r="5"/><circle class="preview-original" cx="28" cy="103" r="4"/><circle class="preview-fork" cx="54" cy="103" r="4"/><circle class="preview-original" cx="80" cy="103" r="4"/><circle class="preview-archived" cx="120" cy="103" r="4"/><circle class="preview-original" cx="164" cy="103" r="4"/><circle class="preview-fork" cx="208" cy="103" r="4"/>
    </svg>
    <strong>Tree</strong><small>Owner → Category → Repository. Best when hierarchy should be immediately obvious.</small>
  </button>
</div>`;
}

function addHomeStylePreset(html) {
  const marker = '<div class="options">';
  const control = '<label>Map style <select id="mapStyle"><option value="galaxy">Galaxy</option><option value="obsidian">Obsidian-like</option><option value="tree">Tree</option></select></label>';
  if (!html.includes(marker)) throw new Error("Could not find generator options container");
  return html
    .replace("style-src 'unsafe-inline'", "style-src 'self' 'unsafe-inline'")
    .replace("</head>", '<link rel="stylesheet" href="./presets.css">\n</head>')
    .replace(marker, `${stylePresetGallery()}\n${marker}\n${control}`);
}

function viewerBody({ mode = "graph" } = {}) {
  const tree = mode === "tree";
  const scripts = tree
    ? '<script src="../tree-viewer.js" defer></script>'
    : '<script src="../tree-router.js" defer></script>\n<script src="../viewer.js" defer></script>';
  return `<body data-map-style="${tree ? "tree" : "galaxy"}">
<main class="app">
  <header class="toolbar">
    <div class="title-block">
      <h1 id="title">Interactive Project Map</h1>
      <p id="subtitle">Loading project graph…</p>
    </div>
    <div class="controls">
      <label class="field">
        <span>Search</span>
        <input id="search" type="search" placeholder="Project, category, language or topic" autocomplete="off">
      </label>
      <label class="field">
        <span>Style</span>
        <select id="style">
          <option value="galaxy">Galaxy</option>
          <option value="obsidian">Obsidian-like</option>
          <option value="tree"${tree ? " selected" : ""}>Tree</option>
        </select>
      </label>
      <button id="fit" type="button">Fit</button>
      <button id="reset" type="button">Reset</button>
    </div>
  </header>

  <section class="workspace">
    <canvas id="galaxy" tabindex="0" aria-label="Interactive project graph"></canvas>

    <aside id="details" class="details" aria-live="polite">
      <button id="detailsClose" class="details-close" type="button" aria-label="Close project details">×</button>
      <h2 id="detailsTitle">Project map</h2>
      <p id="detailsDescription">Select a project to inspect it.</p>
      <dl id="detailsMeta" hidden></dl>
      <a id="detailsLink" href="https://github.com/" target="_blank" rel="noopener" hidden>Open on GitHub ↗</a>
    </aside>

    <div class="legend">
      <span><i class="owner"></i>Owner</span>
      <span><i class="group"></i>Category</span>
      <span><i class="original"></i>Original</span>
      <span><i class="fork"></i>Fork</span>
      <span><i class="archived"></i>Archived</span>
      <span><i class="relation"></i>Relation</span>
    </div>

    <div id="tip" class="tip" role="status" hidden></div>
    <div id="status" class="status">Loading map…</div>
    <div id="error" class="error" role="alert">
      <div id="errorText">Could not load project map.</div>
      <a id="setup" href="../">Generate setup</a>
    </div>
  </section>

  <footer>
    <span>Static graph from the profile repository · no shared GitHub REST request while viewing</span>
    <span class="shortcuts"><kbd>0</kbd> Fit · <kbd>+</kbd>/<kbd>−</kbd> Zoom · <kbd>Enter</kbd> Open · <kbd>Esc</kbd> Close</span>
  </footer>
</main>
${scripts}
</body>`;
}

function enhanceViewer(html, options = {}) {
  const bodyPattern = /<body>[\s\S]*?<\/body>/;
  if (!bodyPattern.test(html)) throw new Error("Could not find viewer body");
  return html
    .replace(/<style>[\s\S]*?<\/style>/, "")
    .replace("style-src 'unsafe-inline'", "style-src 'self'")
    .replace("</head>", '<link rel="stylesheet" href="../viewer.css">\n</head>')
    .replace(bodyPattern, viewerBody(options));
}

export async function buildPublicPages(outputDir = join(process.cwd(), "site")) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(join(outputDir, "u"), { recursive: true });
  await mkdir(join(outputDir, "tree"), { recursive: true });

  const sourceDir = join(process.cwd(), "scripts");
  const homeScript = (await readFile(join(sourceDir, "public-home.js"), "utf8")).replaceAll(
    "__PROJECT_MAP_ACTION_REF__",
    PUBLIC_ACTION_REF,
  );
  const viewerScript = await readFile(join(sourceDir, "public-viewer.js"), "utf8");
  const treeViewerScript = await readFile(join(sourceDir, "public-tree-viewer.js"), "utf8");
  const treeRouterScript = await readFile(join(sourceDir, "public-tree-router.js"), "utf8");
  const viewerCss = await readFile(join(sourceDir, "public-viewer.css"), "utf8");
  const presetCss = await readFile(join(sourceDir, "public-home-presets.css"), "utf8");
  const baseHome = normalizePublicHtml(externalizeBrowserScript(renderPagesHome(), "./app.js"));
  const baseViewer = normalizePublicHtml(externalizeBrowserScript(renderPagesViewer(), "../viewer.js"));
  const home = addHomeStylePreset(baseHome);
  const viewer = enhanceViewer(baseViewer, { mode: "graph" });
  const treeViewer = enhanceViewer(baseViewer, { mode: "tree" });

  await writeFile(join(outputDir, ".nojekyll"), "\n");
  await writeFile(join(outputDir, "index.html"), home);
  await writeFile(join(outputDir, "app.js"), homeScript);
  await writeFile(join(outputDir, "presets.css"), presetCss);
  await writeFile(join(outputDir, "viewer.js"), viewerScript);
  await writeFile(join(outputDir, "tree-viewer.js"), treeViewerScript);
  await writeFile(join(outputDir, "tree-router.js"), treeRouterScript);
  await writeFile(join(outputDir, "viewer.css"), viewerCss);
  await writeFile(join(outputDir, "u", "index.html"), viewer);
  await writeFile(join(outputDir, "tree", "index.html"), treeViewer);
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
