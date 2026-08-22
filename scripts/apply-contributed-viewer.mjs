import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const CONTRIBUTED_BUTTON = '<button type="button" data-status-filter="contributed" aria-pressed="true">Contributed</button>';
const ARCHIVED_BUTTON = '<button type="button" data-status-filter="archived" aria-pressed="true">Archived</button>';
const RUNTIME_MARKER = "/* Project Map Contributed shared-viewer contract */";
const CSS_MARKER = "/* Contributed shared-viewer status */";

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function patchSharedViewState(source) {
  let next = source;
  next = replaceRequired(next,
    'const STATUS_VALUES = ["original", "fork", "archived"];',
    'const STATUS_VALUES = ["original", "fork", "archived", "contributed"];',
    "shared status values");
  next = replaceRequired(next,
    'const aliases = { o: "original", f: "fork", a: "archived" };',
    'const aliases = { o: "original", f: "fork", a: "archived", c: "contributed" };',
    "shared status aliases");
  next = replaceRequired(next,
    'return typeof nodeStatus === "function" ? nodeStatus(node) : node.archived ? "archived" : node.fork ? "fork" : "original";',
    'return typeof nodeStatus === "function" ? nodeStatus(node) : node.relation === "contributed" ? "contributed" : node.archived ? "archived" : node.fork ? "fork" : "original";',
    "shared repository status fallback");
  next = replaceRequired(next,
    'const counts = { original: 0, fork: 0, archived: 0 };',
    'const counts = { original: 0, fork: 0, archived: 0, contributed: 0 };',
    "shared status counts");
  next = replaceRequired(next,
    'const label = value === "original" ? "Original" : value === "fork" ? "Fork" : "Archived";',
    'const label = value === "original" ? "Original" : value === "fork" ? "Fork" : value === "archived" ? "Archived" : "Contributed";',
    "shared status labels");
  return next;
}

export function patchSharedViewerHtml(source) {
  if (source.includes(CONTRIBUTED_BUTTON)) return source;
  if (!source.includes(ARCHIVED_BUTTON)) throw new Error("Could not locate shared Archived control");
  return source.replace(ARCHIVED_BUTTON, `${ARCHIVED_BUTTON}${CONTRIBUTED_BUTTON}`);
}

function contributedRuntime() {
  return `${RUNTIME_MARKER}
(() => {
  const MAX_CONTRIBUTED_REPOSITORIES = 12;
  const MAX_CONTRIBUTION_COUNT = 1_000_000;
  const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
  const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

  function clean(value, max) {
    return typeof value === "string" ? value.slice(0, max) : "";
  }

  function boundedInteger(value, max) {
    return Number.isInteger(value) && value >= 0 && value <= max ? value : null;
  }

  function validIso(value) {
    return typeof value === "string" && Number.isFinite(Date.parse(value));
  }

  function safeGithubRepositoryUrl(value, owner, name) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      if (url.protocol !== "https:" || url.hostname !== "github.com" || parts.length !== 2) return null;
      if (parts[0].toLowerCase() !== owner.toLowerCase() || parts[1].toLowerCase() !== name.toLowerCase()) return null;
      return \`https://github.com/\${encodeURIComponent(owner)}/\${encodeURIComponent(name)}\`;
    } catch {
      return null;
    }
  }

  function safeDiagnostics(value, includedRepositories) {
    if (!value || typeof value !== "object") return null;
    const windowValue = value.window;
    if (!windowValue || !validIso(windowValue.from) || !validIso(windowValue.to) || Date.parse(windowValue.from) > Date.parse(windowValue.to)) return null;
    const cap = boundedInteger(value.cap, MAX_CONTRIBUTED_REPOSITORIES);
    const candidates = boundedInteger(value.candidateRepositories, 100);
    const included = boundedInteger(value.includedRepositories, MAX_CONTRIBUTED_REPOSITORIES);
    const omitted = boundedInteger(value.omittedRepositories, 100);
    const truncated = boundedInteger(value.truncatedRepositories, 100);
    if ([cap, candidates, included, omitted, truncated].some((item) => item === null)) return null;
    if (included !== includedRepositories || included > cap || candidates !== included + omitted || truncated > candidates) return null;
    return {
      window: { from: windowValue.from, to: windowValue.to },
      cap,
      candidateRepositories: candidates,
      includedRepositories: included,
      omittedRepositories: omitted,
      truncatedRepositories: truncated,
    };
  }

  function safeContributedNode(raw, projectOwner) {
    if (!raw || typeof raw !== "object" || raw.type !== "repository" || raw.relation !== "contributed") return null;
    const owner = clean(raw.repositoryOwner, 39);
    const name = clean(raw.repositoryName, 100);
    const fullName = clean(raw.label, 141);
    if (!OWNER_RE.test(owner) || !REPO_RE.test(name) || owner.toLowerCase() === String(projectOwner).toLowerCase()) return null;
    if (fullName.toLowerCase() !== \`\${owner}/\${name}\`.toLowerCase()) return null;
    const id = clean(raw.id, 180);
    if (id !== \`repository:\${fullName.toLowerCase()}\`) return null;
    const url = safeGithubRepositoryUrl(raw.url, owner, name);
    if (!url) return null;
    const contribution = raw.contribution;
    if (!contribution || typeof contribution !== "object") return null;
    const commits = boundedInteger(contribution.commits, MAX_CONTRIBUTION_COUNT);
    const pullRequests = boundedInteger(contribution.pullRequests, MAX_CONTRIBUTION_COUNT);
    const mergedPullRequests = boundedInteger(contribution.mergedPullRequests, MAX_CONTRIBUTION_COUNT);
    if (commits === null || pullRequests === null || mergedPullRequests === null || mergedPullRequests > pullRequests) return null;
    if (commits === 0 && pullRequests === 0) return null;
    if (typeof contribution.commitsTruncated !== "boolean" || typeof contribution.pullRequestsTruncated !== "boolean") return null;
    const node = {
      id,
      label: \`\${owner}/\${name}\`,
      type: "repository",
      relation: "contributed",
      repositoryOwner: owner,
      repositoryName: name,
      url,
      description: clean(raw.description, 2000),
      language: typeof raw.language === "string" ? raw.language.slice(0, 100) : null,
      topics: Array.isArray(raw.topics) ? raw.topics.filter((item) => typeof item === "string").slice(0, 20).map((item) => item.slice(0, 80)) : [],
      stars: Number.isFinite(raw.stars) ? Math.max(0, Math.floor(raw.stars)) : 0,
      forks: Number.isFinite(raw.forks) ? Math.max(0, Math.floor(raw.forks)) : 0,
      fork: raw.fork === true,
      archived: raw.archived === true,
      contribution: {
        commits,
        pullRequests,
        mergedPullRequests,
        commitsTruncated: contribution.commitsTruncated,
        pullRequestsTruncated: contribution.pullRequestsTruncated,
      },
    };
    if (validIso(raw.createdAt)) node.createdAt = raw.createdAt;
    if (validIso(raw.updatedAt)) node.updatedAt = raw.updatedAt;
    return node;
  }

  if (typeof sanitizeGraph === "function") {
    const baseSanitizeGraph = sanitizeGraph;
    sanitizeGraph = function contributedAwareSanitizeGraph(value) {
      const safe = baseSanitizeGraph(value);
      if (!safe || !value || typeof value !== "object" || !Array.isArray(value.nodes)) return safe;
      const rawContributed = value.nodes.filter((node) => node?.type === "repository" && node?.relation === "contributed");
      if (!rawContributed.length) return safe;
      if (rawContributed.length > MAX_CONTRIBUTED_REPOSITORIES) return null;
      const diagnostics = safeDiagnostics(value.externalContributions, rawContributed.length);
      if (!diagnostics) return null;
      const ids = new Set((safe.nodes || []).map((node) => node?.id).filter(Boolean));
      const contributed = [];
      for (const raw of rawContributed) {
        const node = safeContributedNode(raw, safe.owner);
        if (!node || ids.has(node.id)) return null;
        ids.add(node.id);
        contributed.push(node);
      }
      safe.nodes.push(...contributed);
      const ownerId = \`user:\${safe.owner}\`;
      safe.edges = (Array.isArray(safe.edges) ? safe.edges : []).filter((edge) => !contributed.some((node) => edge.target === node.id));
      safe.edges.push(...contributed.map((node) => ({ source: ownerId, target: node.id, type: "contribution" })));
      safe.contributedRepositoryCount = contributed.length;
      safe.externalContributions = diagnostics;
      return safe;
    };
  }

  if (typeof nodeStatus === "function") {
    const baseNodeStatus = nodeStatus;
    nodeStatus = function contributedAwareNodeStatus(node) {
      if (node?.type === "repository" && node.relation === "contributed") return "contributed";
      return baseNodeStatus(node);
    };
  }

  if (typeof palette === "function") {
    const basePalette = palette;
    palette = function contributedAwarePalette() {
      return { ...basePalette(), contributed: document.body.dataset.mapStyle === "obsidian" ? "#62c8ba" : "#55c7d7" };
    };
  }

  if (typeof drawEdges === "function") {
    const baseDrawEdges = drawEdges;
    drawEdges = function contributedAwareDrawEdges(colors) {
      const originalEdges = state.edges;
      const contributionEdges = Array.isArray(originalEdges) ? originalEdges.filter((edge) => edge?.type === "contribution") : [];
      if (!contributionEdges.length) return baseDrawEdges(colors);
      state.edges = originalEdges.filter((edge) => edge?.type !== "contribution");
      try {
        baseDrawEdges(colors);
      } finally {
        state.edges = originalEdges;
      }
      for (const edge of contributionEdges) {
        const sourceNode = state.byId?.get?.(edge.source);
        const targetNode = state.byId?.get?.(edge.target);
        if (!sourceNode || !targetNode) continue;
        let opacity = 0.72;
        if (state.query && typeof matchesQuery === "function" && !(matchesQuery(sourceNode) || matchesQuery(targetNode))) opacity *= 0.15;
        if (state.selected && sourceNode !== state.selected && targetNode !== state.selected) opacity *= 0.16;
        const source = worldToScreen(sourceNode.x, sourceNode.y);
        const target = worldToScreen(targetNode.x, targetNode.y);
        ctx.strokeStyle = colors.contributed || "#55c7d7";
        ctx.globalAlpha = opacity;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    };
  }

  function appendDetailRow(key, value) {
    if (!detailsMeta || value == null || value === "") return;
    const dt = document.createElement("dt");
    dt.textContent = key;
    const dd = document.createElement("dd");
    dd.textContent = String(value);
    detailsMeta.append(dt, dd);
  }

  if (typeof updateDetails === "function") {
    const baseUpdateDetails = updateDetails;
    updateDetails = function contributedAwareUpdateDetails(node) {
      const result = baseUpdateDetails(node);
      if (node?.type !== "repository" || node.relation !== "contributed" || !detailsMeta) return result;
      const kind = [...detailsMeta.querySelectorAll("dt")].find((item) => item.textContent === "Kind");
      if (kind?.nextElementSibling) kind.nextElementSibling.textContent = "Contributed";
      appendDetailRow("External owner", node.repositoryOwner);
      appendDetailRow("Commits", \`\${node.contribution?.commits ?? 0}\${node.contribution?.commitsTruncated ? "+" : ""}\`);
      appendDetailRow("Pull requests", \`\${node.contribution?.pullRequests ?? 0}\${node.contribution?.pullRequestsTruncated ? "+" : ""}\`);
      appendDetailRow("Merged PRs", node.contribution?.mergedPullRequests ?? 0);
      const sourceFlags = [node.fork ? "fork" : "", node.archived ? "archived" : ""].filter(Boolean).join(" · ");
      if (sourceFlags) appendDetailRow("Source flags", sourceFlags);
      const windowValue = state.graph?.externalContributions?.window;
      if (validIso(windowValue?.from) && validIso(windowValue?.to)) appendDetailRow("Contribution window", \`\${windowValue.from.slice(0, 10)} → \${windowValue.to.slice(0, 10)}\`);
      detailsMeta.hidden = false;
      return result;
    };
  }

  window.ProjectMapContributedViewer = Object.freeze({
    snapshot: () => ({
      contributedRepositories: (state.graph?.nodes || []).filter((node) => node?.relation === "contributed").map((node) => node.id).sort(),
      contributionEdges: (state.graph?.edges || []).filter((edge) => edge?.type === "contribution").map((edge) => ({ ...edge })),
    }),
  });
})();`;
}

export function patchSharedViewerRuntime(source) {
  if (source.includes(RUNTIME_MARKER)) return source;
  const anchor = '\ntry {\n  username = normalizeUsername(query.get("username"));';
  if (!source.includes(anchor)) throw new Error("Could not locate shared viewer startup boundary");
  const runtime = `/* eslint-disable no-func-assign */\n${contributedRuntime()}\n/* eslint-enable no-func-assign */`;
  return source.replace(anchor, `\n\n${runtime}\n${anchor.slice(1)}`);
}

export function patchViewerCss(source) {
  if (source.includes(CSS_MARKER)) return source;
  return `${source}\n\n${CSS_MARKER}\n.control-cluster .status-contributed { --status-color: #55c7d7; }\n`;
}

export async function applyContributedViewer(outputDir = resolve(process.cwd(), "site")) {
  const viewStatePath = join(outputDir, "view-state.js");
  const viewerPath = join(outputDir, "viewer.js");
  const cssPath = join(outputDir, "viewer.css");
  const htmlPath = join(outputDir, "u", "index.html");

  const viewState = await readFile(viewStatePath, "utf8");
  const nextViewState = patchSharedViewState(viewState);
  if (nextViewState !== viewState) await writeFile(viewStatePath, nextViewState);

  const viewer = await readFile(viewerPath, "utf8");
  const nextViewer = patchSharedViewerRuntime(viewer);
  if (nextViewer !== viewer) await writeFile(viewerPath, nextViewer);

  const css = await readFile(cssPath, "utf8");
  const nextCss = patchViewerCss(css);
  if (nextCss !== css) await writeFile(cssPath, nextCss);

  const html = await readFile(htmlPath, "utf8");
  const nextHtml = patchSharedViewerHtml(html);
  if (nextHtml !== html) await writeFile(htmlPath, nextHtml);
}

async function main() {
  const outputDir = resolve(process.argv[2] || join(process.cwd(), "site"));
  await applyContributedViewer(outputDir);
  console.log("Attached Contributed contract to shared Galaxy/Obsidian viewer");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
