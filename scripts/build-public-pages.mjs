import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { renderPagesHome, renderPagesViewer } from "./pages-app.mjs";

// This SHA is the first commit in this feature branch that contains the complete
// Action-side style input and both static SVG renderers. The public installer pins
// it so generated workflows never depend on a movable branch or tag.
export const PUBLIC_ACTION_REF = "36517c3ceccaf62ac87d9a70f6f37e3092e3c941";

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

function addHomeStylePreset(html) {
  const marker = '<div class="options">';
  const control = '<label>Map style <select id="mapStyle"><option value="galaxy">Galaxy</option><option value="obsidian">Obsidian-like</option></select></label>';
  if (!html.includes(marker)) throw new Error("Could not find generator options container");
  return html.replace(marker, `${marker}\n${control}`);
}

function viewerBody() {
  return `<body data-map-style="galaxy">
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
<script src="../viewer.js" defer></script>
</body>`;
}

function enhanceViewer(html) {
  const bodyPattern = /<body>[\s\S]*?<\/body>/;
  if (!bodyPattern.test(html)) throw new Error("Could not find viewer body");
  return html
    .replace(/<style>[\s\S]*?<\/style>/, "")
    .replace("style-src 'unsafe-inline'", "style-src 'self'")
    .replace("</head>", '<link rel="stylesheet" href="../viewer.css">\n</head>')
    .replace(bodyPattern, viewerBody());
}

export async function buildPublicPages(outputDir = join(process.cwd(), "site")) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(join(outputDir, "u"), { recursive: true });

  const sourceDir = join(process.cwd(), "scripts");
  const homeScript = (await readFile(join(sourceDir, "public-home.js"), "utf8")).replaceAll(
    "__PROJECT_MAP_ACTION_REF__",
    PUBLIC_ACTION_REF,
  );
  const viewerScript = await readFile(join(sourceDir, "public-viewer.js"), "utf8");
  const viewerCss = await readFile(join(sourceDir, "public-viewer.css"), "utf8");
  const home = addHomeStylePreset(normalizePublicHtml(externalizeBrowserScript(renderPagesHome(), "./app.js")));
  const viewer = enhanceViewer(normalizePublicHtml(externalizeBrowserScript(renderPagesViewer(), "../viewer.js")));

  await writeFile(join(outputDir, ".nojekyll"), "\n");
  await writeFile(join(outputDir, "index.html"), home);
  await writeFile(join(outputDir, "app.js"), homeScript);
  await writeFile(join(outputDir, "viewer.js"), viewerScript);
  await writeFile(join(outputDir, "viewer.css"), viewerCss);
  await writeFile(join(outputDir, "u", "index.html"), viewer);
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
