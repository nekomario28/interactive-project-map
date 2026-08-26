import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const THREE_CDN_ORIGIN = "https://cdn.jsdelivr.net";

export function renderThreejsLabPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="description" content="Experimental Three.js depth view for Interactive Project Map." />
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' ${THREE_CDN_ORIGIN}; style-src 'self'; connect-src https://raw.githubusercontent.com ${THREE_CDN_ORIGIN}; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'" />
<title>Three.js Cosmic Lab · Interactive Project Map</title>
<link rel="stylesheet" href="../viewer.css" />
<link rel="stylesheet" href="../threejs-viewer.css" />
</head>
<body data-map-style="threejs-cosmic">
<main class="app three-app">
  <header class="toolbar three-toolbar">
    <div class="title-block">
      <div class="three-title-row"><span class="lab-badge">3D LAB</span><span class="engine-badge">Three.js · WebGL</span></div>
      <h1 id="title">Interactive Project Map</h1>
      <p id="subtitle">Loading a depth-aware project galaxy…</p>
    </div>
    <div class="controls three-controls">
      <label class="field three-search"><span>Search</span><input id="search" type="search" placeholder="Project, category, language or topic" autocomplete="off" /></label>
      <div class="control-cluster status-cluster" aria-label="Repository status filters">
        <button type="button" data-status-filter="original" aria-pressed="true">Original</button>
        <button type="button" data-status-filter="fork" aria-pressed="true">Fork</button>
        <button type="button" data-status-filter="archived" aria-pressed="true">Archived</button>
        <button type="button" data-status-filter="contributed" aria-pressed="true">Contributed</button>
      </div>
      <button id="motionToggle" type="button" aria-pressed="true">Motion On</button>
      <button id="qualityToggle" type="button" data-quality="auto">Quality Auto</button>
      <button id="fit" type="button">Fit</button>
      <button id="reset" type="button">Reset</button>
      <a id="twoDLink" class="three-link-button" href="../u/">2D Map</a>
      <span id="resultCount" class="result-count" aria-live="polite"></span>
    </div>
  </header>
  <section class="workspace three-workspace">
    <canvas id="galaxy3d" tabindex="0" aria-label="Experimental Three.js project galaxy"></canvas>
    <div class="three-nebula-wash" aria-hidden="true"></div>
    <div id="threeLabels" class="three-label-layer" aria-hidden="true"></div>
    <aside id="details" class="details three-details" aria-live="polite">
      <button id="detailsClose" class="details-close" type="button" aria-label="Close project details">×</button>
      <div class="details-kicker">THREE-DIMENSIONAL VIEW</div>
      <h2 id="detailsTitle">Project map</h2>
      <p id="detailsDescription">Select a project sphere to inspect it.</p>
      <dl id="detailsMeta" hidden></dl>
      <a id="detailsLink" href="https://github.com/" target="_blank" rel="noopener" hidden>Open on GitHub ↗</a>
    </aside>
    <div class="legend three-legend">
      <span><i class="owner"></i>Owner</span><span><i class="group"></i>Category</span><span><i class="original"></i>Original</span><span><i class="fork"></i>Fork</span><span><i class="archived"></i>Archived</span><span><i class="relation"></i>Contributed</span>
    </div>
    <div id="tip" class="tip three-tip" role="status" hidden></div>
    <div id="status" class="status three-status">Loading Three.js engine…</div>
    <div id="error" class="error three-error" role="alert">
      <div id="errorText">Could not load the Three.js view.</div>
      <a id="fallbackLink" href="../u/">Open the current 2D viewer instead</a>
    </div>
    <div class="three-depth-markers" aria-hidden="true"><span>NEAR</span><span>MID</span><span>DEEP SPACE</span></div>
  </section>
  <footer><span>Experimental renderer · canonical graph remains unchanged</span><span class="shortcuts"><kbd>drag</kbd> Orbit · <kbd>wheel</kbd> Dolly · <kbd>0</kbd> Fit · <kbd>Enter</kbd> Open · <kbd>Esc</kbd> Close</span></footer>
</main>
<script type="module" src="../threejs-viewer.js"></script>
</body>
</html>`;
}

export async function buildThreejsLab({ siteDir = join(process.cwd(), "site"), sourceDir = join(process.cwd(), "scripts") } = {}) {
  const threeDir = join(siteDir, "three");
  await mkdir(threeDir, { recursive: true });
  const [runtime, css] = await Promise.all([
    readFile(join(sourceDir, "public-threejs-viewer.js"), "utf8"),
    readFile(join(sourceDir, "public-threejs-viewer.css"), "utf8"),
  ]);
  await Promise.all([
    writeFile(join(siteDir, "threejs-viewer.js"), runtime),
    writeFile(join(siteDir, "threejs-viewer.css"), css),
    writeFile(join(threeDir, "index.html"), renderThreejsLabPage()),
  ]);
  return { threeDir, runtimePath: join(siteDir, "threejs-viewer.js"), cssPath: join(siteDir, "threejs-viewer.css") };
}

async function main() {
  const result = await buildThreejsLab();
  console.log(`Built experimental Three.js cosmic lab into ${result.threeDir}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
