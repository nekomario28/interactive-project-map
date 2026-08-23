import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const VIEWER_DIRS = ["u", "radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"];
const UI_CSS_MARKER = "/* Project Map UI contract audit fixes */";
const SUNBURST_LOD_MARKER = "/* Sunburst dense-label LOD: preserve base renderer suppression for dense portfolios. */";

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function patchGeneratedHomeHtml(source) {
  let next = replaceRequired(
    source,
    '<label>Theme <select id="theme">',
    '<label>Profile SVG theme <select id="theme">',
    "profile SVG theme label",
  );

  if (!next.includes('class="style-fallback"')) {
    const styleControl = /<label>Map style (<select id="mapStyle">[\s\S]*?<\/select>)<\/label>/;
    if (!styleControl.test(next)) throw new Error("Could not locate duplicate Map style select");
    next = next.replace(
      styleControl,
      '<details class="style-fallback"><summary>Alternative style picker</summary><label>Map style $1</label></details>',
    );
  }

  if (!next.includes('class="contributed-option"')) {
    const contributed = '<label title="Opt in to bounded public work in repositories owned by other people or organizations. Ownership is never inferred."><input id="contributed" type="checkbox" /> Include Contributed</label>';
    if (!next.includes(contributed)) throw new Error("Could not locate Contributed setup option");
    next = next.replace(
      contributed,
      `<div class="contributed-option">${contributed}<small>Last 12 months · up to 12 public external repositories · ownership is never inferred.</small></div>`,
    );
  }

  if (!next.includes("0 · Profile repo")) {
    const steps = /<section class="steps">[\s\S]*?<\/section>\s*<p class="foot">/;
    if (!steps.test(next)) throw new Error("Could not locate setup step summary");
    const replacement = `<section class="steps">
<div class="step"><strong>0 · Profile repo</strong><span>If <code>USERNAME/USERNAME</code> does not exist, create it as a public profile repository and enable Add README.</span></div>
<div class="step"><strong>1 · Add workflow</strong><span>Copy the generated workflow into <code>.github/workflows/project-map.yml</code> and commit it.</span></div>
<div class="step"><strong>2 · Run first update</strong><span>Run <code>Update project map</code> once so <code>galaxy.svg</code> and <code>graph.json</code> match the selected settings.</span></div>
<div class="step"><strong>3 · Add README embed</strong><span>Add the generated HTML or Markdown to the profile README. Clicking the static SVG opens the interactive viewer.</span></div>
</section>
<p class="foot">`;
    next = next.replace(steps, replacement);
  }

  return next;
}

export function patchGeneratedHomeApp(source) {
  let next = source;
  next = replaceRequired(
    next,
    "previewMessage.textContent='Checking for an existing generated SVG…';",
    "previewMessage.textContent='Checking the currently published SVG…';",
    "published SVG check copy",
  );
  next = replaceRequired(
    next,
    "previewMessage.textContent='Existing static SVG found in the profile repository.';",
    "previewMessage.textContent='Current published SVG found. It may reflect previous settings until Step 2 runs.';",
    "published SVG loaded copy",
  );
  return next;
}

export function patchViewerLegend(source) {
  if (!source.includes('<div class="legend">') || source.includes('<i class="contributed"></i>Contributed')) return source;
  const archived = '<span><i class="archived"></i>Archived</span>';
  if (!source.includes(archived)) throw new Error("Could not locate Archived viewer legend item");
  return source.replace(archived, `${archived}<span><i class="contributed"></i>Contributed</span>`);
}

export function patchViewerCss(source) {
  if (source.includes(UI_CSS_MARKER)) return source;
  return `${source}\n\n${UI_CSS_MARKER}
.legend .contributed { background: #55c7d7; }

@media (max-width: 480px) {
  .repository-filters .status-chip:disabled { display: none; }
}
`;
}

export function patchHomePresetCss(source) {
  if (source.includes(UI_CSS_MARKER)) return source;
  return `${source}\n\n${UI_CSS_MARKER}
.style-fallback {
  flex: 1 1 100%;
  color: #8f9db2;
}
.style-fallback summary {
  width: fit-content;
  cursor: pointer;
  font-size: .82rem;
}
.style-fallback[open] label {
  margin-top: 8px;
}
.contributed-option {
  display: grid;
  gap: 3px;
}
.contributed-option small {
  max-width: 430px;
  color: #77869c;
  font-size: .74rem;
  line-height: 1.4;
}
`;
}

export function patchInteractionPolishSunburst(source) {
  if (source.includes(SUNBURST_LOD_MARKER)) return source;
  const start = '  if (style === "sunburst" && typeof drawRepoLabels === "function") {';
  const end = '\n\n  if (typeof canvas === "undefined" || typeof state === "undefined") return;';
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  if (startIndex < 0 || endIndex < 0) throw new Error("Could not locate Sunburst interaction-polish label override");
  const replacement = `  ${SUNBURST_LOD_MARKER}
  if (style === "sunburst" && typeof drawRepoLabels === "function") {
    drawRepoLabels = function readableRadialRepoLabels(colors, origin, outer, repoInner) {
      const labelRadius = repoInner + (outer - repoInner) * 0.53;
      const total = state.segments.length;
      for (const repo of state.segments) {
        const highlighted = repo === state.selected || repo === state.hovered;
        const searched = Boolean(state.query && matches(repo));
        const span = Math.max(0.001, repo.end - repo.start);
        if (!highlighted && !searched && total > 36 && span < 0.17) continue;
        const mid = (repo.start + repo.end) / 2;
        const x = origin.x + Math.cos(mid) * labelRadius;
        const y = origin.y + Math.sin(mid) * labelRadius;
        const arcRoom = Math.max(5.8, labelRadius * span * 0.82);
        const radialRoom = Math.max(30, outer - repoInner - 10);
        const lengthFit = radialRoom / Math.max(1, repo.label.length * 0.56);
        const fontSize = clamp(Math.min(highlighted ? 11.8 : 10.4, arcRoom, Math.max(7.1, lengthFit)), 7.1, 12.2);
        const flipped = Math.cos(mid) < 0;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(flipped ? mid + Math.PI : mid);
        ctx.globalAlpha = matches(repo) ? (highlighted ? 1 : 0.96) : 0.12;
        ctx.font = \`\${highlighted ? 750 : 650} \${fontSize}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif\`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.lineWidth = highlighted ? 3.4 : 2.7;
        ctx.strokeStyle = colors.background;
        ctx.strokeText(repo.label, 0, 0);
        ctx.fillStyle = colors.text;
        ctx.fillText(repo.label, 0, 0);
        ctx.restore();
      }
    };
  }`;
  return `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex)}`;
}

export async function applyUiContractFixes(outputDir = resolve(process.cwd(), "site")) {
  const homePath = join(outputDir, "index.html");
  const home = await readFile(homePath, "utf8");
  const patchedHome = patchGeneratedHomeHtml(home);
  if (patchedHome !== home) await writeFile(homePath, patchedHome);

  const appPath = join(outputDir, "app.js");
  const app = await readFile(appPath, "utf8");
  const patchedApp = patchGeneratedHomeApp(app);
  if (patchedApp !== app) await writeFile(appPath, patchedApp);

  const presetCssPath = join(outputDir, "presets.css");
  const presetCss = await readFile(presetCssPath, "utf8");
  const patchedPresetCss = patchHomePresetCss(presetCss);
  if (patchedPresetCss !== presetCss) await writeFile(presetCssPath, patchedPresetCss);

  const viewerCssPath = join(outputDir, "viewer.css");
  const viewerCss = await readFile(viewerCssPath, "utf8");
  const patchedViewerCss = patchViewerCss(viewerCss);
  if (patchedViewerCss !== viewerCss) await writeFile(viewerCssPath, patchedViewerCss);

  const interactionPath = join(outputDir, "interaction-polish.js");
  const interaction = await readFile(interactionPath, "utf8");
  const patchedInteraction = patchInteractionPolishSunburst(interaction);
  if (patchedInteraction !== interaction) await writeFile(interactionPath, patchedInteraction);

  for (const mode of VIEWER_DIRS) {
    const htmlPath = join(outputDir, mode, "index.html");
    const html = await readFile(htmlPath, "utf8");
    const patched = patchViewerLegend(html);
    if (patched !== html) await writeFile(htmlPath, patched);
  }
}

async function main() {
  const outputDir = resolve(process.argv[2] || join(process.cwd(), "site"));
  await applyUiContractFixes(outputDir);
  console.log(`Applied generated UI contract fixes in ${outputDir}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
