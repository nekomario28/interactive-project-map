import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, posix, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { fetchPublicRepos } from "./github.mjs";
import { buildGraph } from "./graph.mjs";
import { generateSemanticEdges } from "./semantic-edges.mjs";
import { renderGalaxySvg } from "./svg.mjs";
import { renderGalaxyClassicSvg } from "./galaxy-svg-classic.mjs";
import { renderGalaxySystemsSvg } from "./galaxy-svg-systems.mjs";
import { renderGalaxyHybridSvg } from "./galaxy-svg-hybrid.mjs";
import { renderTreeSvg } from "./tree-svg.mjs";
import { renderRadialTreeSvg } from "./radial-svg.mjs";
import { renderTreemapSvg } from "./treemap-svg.mjs";
import { renderTimelineSvg } from "./timeline-svg.mjs";
import { renderClusterSvg } from "./cluster-svg.mjs";
import { renderSunburstSvg } from "./sunburst-svg.mjs";
import { renderMatrixSvg } from "./matrix-svg.mjs";
import { renderSankeySvg } from "./sankey-svg.mjs";
import { finalizeSvgForTheme } from "./finalize-svg.mjs";

const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const STYLE_VALUES = new Set([
  "radial",
  "galaxy",
  "galaxy-classic",
  "galaxy-systems",
  "galaxy-hybrid",
  "obsidian",
  "tree",
  "treemap",
  "timeline",
  "cluster",
  "sunburst",
  "matrix",
  "sankey",
]);
const EXPLORATORY_STYLES = new Set(["galaxy-classic", "galaxy-systems", "galaxy-hybrid", "obsidian"]);

function input(env, name, legacyName) {
  return env[`INPUT_${name}`] ?? (legacyName ? env[legacyName] : undefined);
}

function boundedInt(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : fallback;
}

function boolValue(value, fallback) {
  if (value == null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function styleValue(value) {
  const normalized = String(value || "radial").trim().toLowerCase();
  if (normalized === "galaxy") return "galaxy-systems";
  return STYLE_VALUES.has(normalized) ? normalized : "radial";
}

export function safeOutputDir(value = "project-map") {
  const normalized = String(value || "project-map").trim().replaceAll("\\", "/").replace(/^\.\//, "");
  const segments = normalized.split("/").filter(Boolean);
  if (!segments.length || isAbsolute(normalized) || /^[A-Za-z]:\//.test(normalized) || segments.some((segment) => segment === ".." || segment === ".")) {
    throw new Error("output_dir must be a relative directory without '.' or '..' segments");
  }
  return segments.join("/");
}

export function actionConfigFromEnv(env = process.env) {
  const username = String(input(env, "USERNAME", "PROJECT_MAP_USERNAME") || env.GITHUB_REPOSITORY_OWNER || "").trim().toLowerCase();
  if (!USERNAME_RE.test(username)) throw new Error("Invalid GitHub username");
  const theme = input(env, "THEME", "PROJECT_MAP_THEME") === "light" ? "light" : "dark";
  return {
    username,
    theme,
    style: styleValue(input(env, "STYLE", "PROJECT_MAP_STYLE")),
    maxRepos: boundedInt(input(env, "MAX_REPOS", "PROJECT_MAP_MAX_REPOS"), 100, 1, 300),
    includeForks: boolValue(input(env, "FORKS", "PROJECT_MAP_FORKS"), true),
    includeArchived: boolValue(input(env, "ARCHIVED", "PROJECT_MAP_ARCHIVED"), false),
    width: boundedInt(input(env, "WIDTH", "PROJECT_MAP_WIDTH"), 740, 420, 1600),
    height: boundedInt(input(env, "HEIGHT", "PROJECT_MAP_HEIGHT"), 420, 260, 1000),
    outputDir: safeOutputDir(input(env, "OUTPUT_DIR", "PROJECT_MAP_OUTPUT_DIR")),
  };
}

function comparableGraph(graph) {
  return JSON.stringify({ ...graph, generatedAt: "" });
}

async function preserveGeneratedAtWhenUnchanged(graphPath, graph) {
  try {
    const previous = JSON.parse(await readFile(graphPath, "utf8"));
    if (previous && typeof previous === "object" && typeof previous.generatedAt === "string" && Number.isFinite(Date.parse(previous.generatedAt)) && comparableGraph(previous) === comparableGraph(graph)) {
      graph.generatedAt = previous.generatedAt;
    }
  } catch {
    // First run or invalid previous file.
  }
}

function graphForExploratoryStyle(graph, style) {
  if (!EXPLORATORY_STYLES.has(style) || !Array.isArray(graph.semanticEdges) || !graph.semanticEdges.length) return graph;
  const semanticRelations = graph.semanticEdges.map((edge) => ({ source: edge.source, target: edge.target, type: "relation" }));
  return { ...graph, edges: [...graph.edges, ...semanticRelations] };
}

function renderForStyle(graph, config) {
  const renderGraph = graphForExploratoryStyle(graph, config.style);
  let svg;
  if (config.style === "tree") svg = renderTreeSvg(renderGraph, config.theme, config.width, config.height);
  else if (config.style === "radial") svg = renderRadialTreeSvg(renderGraph, config.theme, config.width, config.height);
  else if (config.style === "treemap") svg = renderTreemapSvg(renderGraph, config.theme, config.width, config.height);
  else if (config.style === "timeline") svg = renderTimelineSvg(renderGraph, config.theme, config.width, config.height);
  else if (config.style === "cluster") svg = renderClusterSvg(renderGraph, config.theme, config.width, config.height);
  else if (config.style === "sunburst") svg = renderSunburstSvg(renderGraph, config.theme, config.width, config.height);
  else if (config.style === "matrix") svg = renderMatrixSvg(renderGraph, config.theme, config.width, config.height);
  else if (config.style === "sankey") svg = renderSankeySvg(renderGraph, config.theme, config.width, config.height);
  else if (config.style === "galaxy-classic") svg = renderGalaxyClassicSvg(renderGraph, config.theme, config.width, config.height);
  else if (config.style === "galaxy-hybrid") svg = renderGalaxyHybridSvg(renderGraph, config.theme, config.width, config.height);
  else if (config.style === "galaxy-systems") svg = renderGalaxySystemsSvg(renderGraph, config.theme, config.width, config.height);
  else svg = renderGalaxySvg(renderGraph, config.theme, config.width, config.height, "obsidian");
  return finalizeSvgForTheme(svg, config.theme);
}

export async function generateStaticMap(config, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const fetchRepos = options.fetchRepos ?? fetchPublicRepos;
  const token = options.token ?? process.env.INPUT_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
  const repos = await fetchRepos(config.username, token, config.maxRepos, {
    includeForks: config.includeForks,
    includeArchived: config.includeArchived,
  });
  const graph = buildGraph(config.username, repos, true, true);
  const semantic = await generateSemanticEdges(
    repos,
    options.embeddingProvider,
    options.embeddingCache,
    options.semanticOptions,
  );
  if (semantic.edges.length) graph.semanticEdges = semantic.edges;
  if (semantic.error) console.warn(`Semantic edges disabled for this run: ${semantic.error}`);

  const outputRoot = resolve(cwd, config.outputDir);
  const cwdRoot = resolve(cwd) + sep;
  if (!(outputRoot + sep).startsWith(cwdRoot)) throw new Error("output_dir escaped the workspace");
  await mkdir(outputRoot, { recursive: true });
  const graphPath = posix.join(config.outputDir, "graph.json");
  const svgPath = posix.join(config.outputDir, "galaxy.svg");
  const absoluteGraphPath = resolve(cwd, graphPath);
  await preserveGeneratedAtWhenUnchanged(absoluteGraphPath, graph);
  await writeFile(absoluteGraphPath, JSON.stringify(graph, null, 2) + "\n");
  await writeFile(resolve(cwd, svgPath), renderForStyle(graph, config));
  return { graphPath, svgPath, graph, semantic };
}

async function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function main() {
  if (!process.env.INPUT_GITHUB_TOKEN && !process.env.GITHUB_TOKEN) throw new Error("github_token input is required");
  const config = actionConfigFromEnv();
  const result = await generateStaticMap(config);
  await setOutput("svg-path", result.svgPath);
  await setOutput("graph-path", result.graphPath);
  console.log(`Generated ${result.graph.repositoryCount} repositories for ${config.username} (${config.style})`);
  console.log(`SVG: ${result.svgPath}`);
  console.log(`Graph: ${result.graphPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
