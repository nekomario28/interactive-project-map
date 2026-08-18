import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renderGalaxySvg } from "./svg.mjs";
import { renderRadialTreeSvg } from "./radial-svg.mjs";
import { renderTreeSvg } from "./tree-svg.mjs";
import { renderTreemapSvg } from "./treemap-svg.mjs";
import { renderTimelineSvg } from "./timeline-svg.mjs";
import { renderClusterSvg } from "./cluster-svg.mjs";
import { renderSunburstSvg } from "./sunburst-svg.mjs";
import { renderMatrixSvg } from "./matrix-svg.mjs";
import { renderSankeySvg } from "./sankey-svg.mjs";

const WIDTH = 740;
const HEIGHT = 420;
const THEMES = ["dark", "light"];
const STYLES = [
  ["radial", "Radial Tree (Classic)"],
  ["galaxy", "Galaxy"],
  ["obsidian", "Obsidian-like"],
  ["tree", "Tree"],
  ["treemap", "Treemap"],
  ["timeline", "Timeline"],
  ["cluster", "Cluster / Bubble"],
  ["sunburst", "Sunburst"],
  ["matrix", "Matrix / Heatmap"],
  ["sankey", "Sankey"],
];

function render(style, graph, theme) {
  if (style === "radial") return renderRadialTreeSvg(graph, theme, WIDTH, HEIGHT);
  if (style === "galaxy" || style === "obsidian") return renderGalaxySvg(graph, theme, WIDTH, HEIGHT, style);
  if (style === "tree") return renderTreeSvg(graph, theme, WIDTH, HEIGHT);
  if (style === "treemap") return renderTreemapSvg(graph, theme, WIDTH, HEIGHT);
  if (style === "timeline") return renderTimelineSvg(graph, theme, WIDTH, HEIGHT);
  if (style === "cluster") return renderClusterSvg(graph, theme, WIDTH, HEIGHT);
  if (style === "sunburst") return renderSunburstSvg(graph, theme, WIDTH, HEIGHT);
  if (style === "matrix") return renderMatrixSvg(graph, theme, WIDTH, HEIGHT);
  if (style === "sankey") return renderSankeySvg(graph, theme, WIDTH, HEIGHT);
  throw new Error(`Unsupported comparison style: ${style}`);
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}

function comparisonSheet(rendered, graph, theme) {
  const dark = theme === "dark";
  const sheetBg = dark ? "#050811" : "#eef2f7";
  const panelBg = dark ? "#111827" : "#ffffff";
  const panelBorder = dark ? "#26364d" : "#cbd5e1";
  const text = dark ? "#e8edf7" : "#172033";
  const sheetWidth = 1200;
  const panelWidth = 580;
  const panelHeight = 360;
  const imageWidth = 548;
  const imageHeight = Math.round(imageWidth * HEIGHT / WIDTH);
  const sheetHeight = 30 + Math.ceil(rendered.length / 2) * panelHeight;
  const images = rendered.map((item, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 20 + column * panelWidth;
    const y = 22 + row * panelHeight;
    const data = Buffer.from(item.svg).toString("base64");
    return `<g><text x="${x + 4}" y="${y + 18}" fill="${text}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="16" font-weight="700">${index + 1}. ${esc(item.label)}</text><rect x="${x}" y="${y + 30}" width="${imageWidth + 8}" height="${imageHeight + 8}" rx="14" fill="${panelBg}" stroke="${panelBorder}"/><image x="${x + 4}" y="${y + 34}" width="${imageWidth}" height="${imageHeight}" href="data:image/svg+xml;base64,${data}"/></g>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${sheetWidth}" height="${sheetHeight}" viewBox="0 0 ${sheetWidth} ${sheetHeight}" role="img" aria-label="Ten ${theme} project-map preset visual comparison for ${esc(graph.owner || "user")}"><rect width="100%" height="100%" fill="${sheetBg}"/>${images}</svg>`;
}

export async function renderPresetComparison(graphPath, outputDir) {
  const graph = JSON.parse(await readFile(graphPath, "utf8"));
  if (!graph || typeof graph !== "object" || !Array.isArray(graph.nodes)) throw new Error("comparison graph.json is invalid");
  await mkdir(outputDir, { recursive: true });

  for (const theme of THEMES) {
    const themeDir = resolve(outputDir, theme);
    await mkdir(themeDir, { recursive: true });
    const rendered = [];
    for (const [style, label] of STYLES) {
      const svg = render(style, graph, theme);
      await writeFile(resolve(themeDir, `${style}.svg`), svg);
      if (theme === "dark") await writeFile(resolve(outputDir, `${style}.svg`), svg);
      rendered.push({ style, label, svg });
    }
    const sheet = comparisonSheet(rendered, graph, theme);
    await writeFile(resolve(themeDir, "comparison.svg"), sheet);
    await writeFile(resolve(outputDir, theme === "dark" ? "comparison.svg" : "comparison-light.svg"), sheet);
  }

  await writeFile(resolve(outputDir, "summary.json"), JSON.stringify({
    owner: graph.owner,
    repositoryCount: graph.repositoryCount,
    generatedAt: graph.generatedAt,
    themes: THEMES,
    styles: STYLES.map(([style, label]) => ({ style, label })),
  }, null, 2) + "\n");
  return { styles: STYLES.length, themes: THEMES.length, repositoryCount: graph.repositoryCount };
}

async function main() {
  const graphPath = resolve(process.argv[2] || ".tmp/project-map/graph.json");
  const outputDir = resolve(process.argv[3] || ".tmp/preset-comparison");
  const result = await renderPresetComparison(graphPath, outputDir);
  console.log(`Rendered ${result.styles} preset samples in ${result.themes} themes from ${result.repositoryCount} repositories into ${outputDir}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
