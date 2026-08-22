import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEDICATED_STYLES = ["radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"];
const CONTRIBUTED_BUTTON = '<button type="button" data-status-filter="contributed" aria-pressed="true">Contributed</button>';
const CONTRIBUTED_LEGEND = '<span><i class="contributed"></i>Contributed</span>';
const COMPAT_SCRIPT = '<script src="../contributed-compat.js" defer></script>';
const RUNTIME_SCRIPT = '<script src="../contributed-runtime.js" defer></script>';

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Could not locate ${label}`);
  return source.replace(before, after);
}

function patchStatusProjection(source, name) {
  let next = source;
  next = next.replaceAll('["original", "fork", "archived"]', '["original", "fork", "archived", "contributed"]');
  next = next.replaceAll('{ original: 0, fork: 0, archived: 0 }', '{ original: 0, fork: 0, archived: 0, contributed: 0 }');
  next = next.replaceAll('const aliases = { o: "original", f: "fork", a: "archived" };', 'const aliases = { o: "original", f: "fork", a: "archived", c: "contributed" };');
  next = next.replaceAll('const statusLabels = { original: "Original", fork: "Fork", archived: "Archived" };', 'const statusLabels = { original: "Original", fork: "Fork", archived: "Archived", contributed: "Contributed" };');
  next = next.replaceAll('if (node.archived === true) return "archived";', 'if (node.relation === "contributed") return "contributed";\n      if (node.archived === true) return "archived";');
  next = next.replaceAll('const label = value === "original" ? "Original" : value === "fork" ? "Fork" : "Archived";', 'const label = value === "original" ? "Original" : value === "fork" ? "Fork" : value === "contributed" ? "Contributed" : "Archived";');
  next = next.replaceAll('counts.archived = 0;', 'counts.archived = 0;\n    counts.contributed = 0;');
  if (!next.includes('"contributed"')) throw new Error(`${name} did not gain Contributed status support`);
  return next;
}

function patchMatrix(source) {
  let next = source;
  next = next.replaceAll('counts={original:0,fork:0,archived:0}', 'counts={original:0,fork:0,archived:0,contributed:0}');
  next = next.replaceAll('for(const st of["original","fork","archived"])', 'for(const st of["original","fork","archived","contributed"])');
  next = next.replace('[["Repositories",String(matches.length)],["Original",String(cell.counts.original)],["Fork",String(cell.counts.fork)],["Archived",String(cell.counts.archived)]]', '[["Repositories",String(matches.length)],["Original",String(cell.counts.original)],["Fork",String(cell.counts.fork)],["Archived",String(cell.counts.archived)],["Contributed",String(cell.counts.contributed||0)]]');
  if (!next.includes('contributed:0')) throw new Error("Matrix did not gain Contributed aggregate counts");
  return next;
}

function patchSankey(source) {
  let next = source;
  next = next.replaceAll('counts={original:0,fork:0,archived:0}', 'counts={original:0,fork:0,archived:0,contributed:0}');
  next = next.replace('const statuses=["original","fork","archived"]', 'const statuses=["original","fork","archived","contributed"]');
  next = next.replace('statusUnit=(usable-statusGap*2)/total', 'statusUnit=(usable-statusGap*(statuses.length-1))/total');
  next = next.replace('[["Repositories",String(matches.length)],["Original",String(node.counts.original)],["Fork",String(node.counts.fork)],["Archived",String(node.counts.archived)]]', '[["Repositories",String(matches.length)],["Original",String(node.counts.original)],["Fork",String(node.counts.fork)],["Archived",String(node.counts.archived)],["Contributed",String(node.counts.contributed||0)]]');
  if (!next.includes('["original","fork","archived","contributed"]')) throw new Error("Sankey did not gain Contributed status flow");
  return next;
}

function patchHtml(html, viewerScript) {
  let next = html;
  if (!next.includes('data-status-filter="contributed"')) {
    next = replaceRequired(next, '<button type="button" data-status-filter="archived" aria-pressed="true">Archived</button>', `<button type="button" data-status-filter="archived" aria-pressed="true">Archived</button>${CONTRIBUTED_BUTTON}`, "Archived status control");
  }
  if (!next.includes('<i class="contributed"></i>')) {
    next = replaceRequired(next, '<span><i class="archived"></i>Archived</span>', `<span><i class="archived"></i>Archived</span>${CONTRIBUTED_LEGEND}`, "Archived legend");
  }
  if (!next.includes(COMPAT_SCRIPT)) next = replaceRequired(next, viewerScript, `${COMPAT_SCRIPT}\n${viewerScript}`, "viewer script for Contributed compatibility");
  if (!next.includes(RUNTIME_SCRIPT)) next = replaceRequired(next, viewerScript, `${viewerScript}\n${RUNTIME_SCRIPT}`, "viewer script for Contributed runtime");
  return next;
}

const COMPAT_SOURCE = String.raw`"use strict";
(() => {
  const MAX_CONTRIBUTED = 12;
  const MAX_COUNT = 1_000_000;
  const DEDICATED = new Set(["radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"]);
  const metadata = new Map();
  let readyResolve;
  const runtimeReady = new Promise((resolveReady) => { readyResolve = resolveReady; });

  function integer(value, max) {
    return Number.isInteger(value) && value >= 0 && value <= max ? value : null;
  }

  function validIso(value) {
    return typeof value === "string" && Number.isFinite(Date.parse(value));
  }

  function validRepoName(value) {
    return typeof value === "string" && /^[A-Za-z0-9._-]{1,100}$/.test(value);
  }

  function validOwner(value) {
    return typeof value === "string" && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(value);
  }

  function canonicalExternal(node, profileOwner) {
    if (!node || node.type !== "repository" || node.relation !== "contributed") return null;
    const owner = node.repositoryOwner;
    const name = node.repositoryName;
    if (!validOwner(owner) || !validRepoName(name) || owner.toLowerCase() === profileOwner.toLowerCase()) return null;
    if (typeof node.label !== "string" || node.label.toLowerCase() !== (owner + "/" + name).toLowerCase()) return null;
    let url;
    try {
      url = new URL(node.url);
    } catch {
      return null;
    }
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (url.protocol !== "https:" || url.hostname !== "github.com" || parts.length !== 2 || parts[0].toLowerCase() !== owner.toLowerCase() || parts[1].toLowerCase() !== name.toLowerCase()) return null;
    const contribution = node.contribution;
    if (!contribution || typeof contribution !== "object") return null;
    const commits = integer(contribution.commits, MAX_COUNT);
    const pullRequests = integer(contribution.pullRequests, MAX_COUNT);
    const mergedPullRequests = integer(contribution.mergedPullRequests, MAX_COUNT);
    if (commits === null || pullRequests === null || mergedPullRequests === null || mergedPullRequests > pullRequests || (commits === 0 && pullRequests === 0)) return null;
    if (typeof contribution.commitsTruncated !== "boolean" || typeof contribution.pullRequestsTruncated !== "boolean") return null;
    return {
      id: node.id,
      label: owner + "/" + name,
      relation: "contributed",
      repositoryOwner: owner,
      repositoryName: name,
      url: "https://github.com/" + encodeURIComponent(owner) + "/" + encodeURIComponent(name),
      description: typeof node.description === "string" ? node.description.slice(0, 2000) : "",
      language: typeof node.language === "string" ? node.language.slice(0, 100) : null,
      topics: Array.isArray(node.topics) ? node.topics.filter((item) => typeof item === "string").slice(0, 40).map((item) => item.slice(0, 80)) : [],
      stars: Number.isFinite(node.stars) ? Math.max(0, Math.floor(node.stars)) : 0,
      forks: Number.isFinite(node.forks) ? Math.max(0, Math.floor(node.forks)) : 0,
      sourceFork: node.fork === true,
      sourceArchived: node.archived === true,
      createdAt: validIso(node.createdAt) ? node.createdAt.slice(0, 64) : "",
      updatedAt: validIso(node.updatedAt) ? node.updatedAt.slice(0, 64) : "",
      contribution: {
        commits,
        pullRequests,
        mergedPullRequests,
        commitsTruncated: contribution.commitsTruncated,
        pullRequestsTruncated: contribution.pullRequestsTruncated,
      },
    };
  }

  function diagnosticsValid(value, count) {
    if (count === 0) return true;
    const d = value?.externalContributions;
    const windowValue = d?.window;
    if (!d || !windowValue || !validIso(windowValue.from) || !validIso(windowValue.to) || Date.parse(windowValue.from) > Date.parse(windowValue.to)) return false;
    const cap = integer(d.cap, MAX_CONTRIBUTED);
    const candidates = integer(d.candidateRepositories, 100);
    const included = integer(d.includedRepositories, MAX_CONTRIBUTED);
    const omitted = integer(d.omittedRepositories, 100);
    const truncated = integer(d.truncatedRepositories, 100);
    return cap !== null && candidates !== null && included === count && omitted !== null && truncated !== null && included <= cap && included <= candidates;
  }

  function transformGraph(value) {
    if (!value || typeof value !== "object" || typeof value.owner !== "string" || !Array.isArray(value.nodes)) return value;
    metadata.clear();
    const rawContributed = value.nodes.filter((node) => node?.type === "repository" && node?.relation === "contributed");
    if (rawContributed.length > MAX_CONTRIBUTED || !diagnosticsValid(value, rawContributed.length)) {
      const rejectedIds = new Set(rawContributed.map((node) => node?.id).filter(Boolean));
      return {
        ...value,
        nodes: value.nodes.filter((node) => !rejectedIds.has(node?.id)),
        edges: Array.isArray(value.edges) ? value.edges.filter((edge) => !rejectedIds.has(edge?.source) && !rejectedIds.has(edge?.target)) : value.edges,
        semanticEdges: Array.isArray(value.semanticEdges) ? value.semanticEdges.filter((edge) => !rejectedIds.has(edge?.source) && !rejectedIds.has(edge?.target)) : value.semanticEdges,
      };
    }

    const accepted = [];
    const rejectedIds = new Set();
    for (const raw of rawContributed) {
      const safe = canonicalExternal(raw, value.owner);
      if (!safe || metadata.has(raw.id)) {
        rejectedIds.add(raw?.id);
        continue;
      }
      metadata.set(raw.id, safe);
      accepted.push(safe);
    }

    const style = document.body?.dataset?.mapStyle || "";
    const dedicated = DEDICATED.has(style);
    const syntheticGroupId = "group:__contributed_view__";
    const nodes = value.nodes.flatMap((node) => {
      if (rejectedIds.has(node?.id)) return [];
      const safe = metadata.get(node?.id);
      if (!safe) return [node];
      return [{
        ...node,
        label: safe.repositoryName,
        url: "https://github.com/" + encodeURIComponent(value.owner) + "/" + encodeURIComponent(safe.repositoryName),
        fork: false,
        archived: false,
        ...(dedicated ? { groupId: "__contributed_view__", groupLabel: "Contributed" } : { groupId: "", groupLabel: "" }),
      }];
    });
    if (dedicated && accepted.length) nodes.push({ id: syntheticGroupId, label: "Contributed", type: "group", repositoryCount: accepted.length, viewRelation: "contributed" });
    const ids = new Set(nodes.map((node) => node?.id).filter(Boolean));
    return {
      ...value,
      nodes,
      edges: Array.isArray(value.edges) ? value.edges.filter((edge) => ids.has(edge?.source) && ids.has(edge?.target)) : value.edges,
      semanticEdges: Array.isArray(value.semanticEdges) ? value.semanticEdges.filter((edge) => ids.has(edge?.source) && ids.has(edge?.target)) : value.semanticEdges,
    };
  }

  function restoreGraph(graph) {
    if (!graph || typeof graph !== "object" || !Array.isArray(graph.nodes)) return graph;
    const style = document.body?.dataset?.mapStyle || "";
    const dedicated = DEDICATED.has(style);
    const nodes = graph.nodes.map((node) => {
      const safe = metadata.get(node?.id);
      if (!safe) return node;
      return {
        ...node,
        ...safe,
        fork: false,
        archived: false,
        ...(dedicated ? { groupId: "__contributed_view__", groupLabel: "Contributed" } : { groupId: "", groupLabel: "" }),
      };
    });
    return { ...graph, nodes };
  }

  const baseFetch = window.fetch.bind(window);
  window.fetch = async function contributedGraphFetch(input, init) {
    const response = await baseFetch(input, init);
    let rawUrl;
    try {
      rawUrl = typeof input === "string" || input instanceof URL ? input : input?.url;
      const url = new URL(rawUrl, location.href);
      if (!response.ok || !url.pathname.endsWith("/project-map/graph.json")) return response;
      const value = await response.clone().json();
      const transformed = transformGraph(value);
      await runtimeReady;
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      headers.set("content-type", "application/json; charset=utf-8");
      return new Response(JSON.stringify(transformed), { status: response.status, statusText: response.statusText, headers });
    } catch {
      return response;
    }
  };

  window.ProjectMapContributedCompat = Object.freeze({
    restoreGraph,
    markRuntimeReady() { readyResolve(); },
    isContributed(node) { return node?.relation === "contributed" && metadata.has(node?.id); },
    metadataFor(node) { return metadata.get(node?.id) || null; },
    snapshot() { return { acceptedIds: [...metadata.keys()] }; },
  });
})();
`;

const RUNTIME_SOURCE = String.raw`"use strict";
/* global sanitizeGraph, nodeStatus, statusOf, palette, updateDetails, detailsMeta, detailsTitle, detailsLink */
(() => {
  const compat = window.ProjectMapContributedCompat;
  if (!compat) return;

  if (typeof sanitizeGraph === "function") {
    const baseSanitizeGraph = sanitizeGraph;
    sanitizeGraph = function contributedSanitizeGraph(value) {
      return compat.restoreGraph(baseSanitizeGraph(value));
    };
  }

  if (typeof nodeStatus === "function") {
    const baseNodeStatus = nodeStatus;
    nodeStatus = function contributedNodeStatus(node) {
      return compat.isContributed(node) ? "contributed" : baseNodeStatus(node);
    };
  }

  if (typeof statusOf === "function") {
    const baseStatusOf = statusOf;
    statusOf = function contributedStatusOf(node) {
      return compat.isContributed(node) ? "contributed" : baseStatusOf(node);
    };
  }

  if (typeof palette === "function") {
    const basePalette = palette;
    palette = function contributedPalette(...args) {
      const colors = basePalette(...args);
      return { ...colors, contributed: colors.relation || "#f4b65f" };
    };
  }

  function appendRow(key, value) {
    if (typeof detailsMeta === "undefined" || !detailsMeta) return;
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = key;
    dd.textContent = value;
    detailsMeta.append(dt, dd);
    detailsMeta.hidden = false;
  }

  function replaceKind(value) {
    if (typeof detailsMeta === "undefined" || !detailsMeta) return;
    const terms = [...detailsMeta.querySelectorAll("dt")];
    const index = terms.findIndex((term) => term.textContent === "Kind");
    if (index >= 0) terms[index].nextElementSibling.textContent = value;
    else appendRow("Kind", value);
  }

  function directRepository(subject) {
    if (compat.isContributed(subject)) return subject;
    const repositories = Array.isArray(subject?.repos) ? subject.repos : Array.isArray(subject?.members) ? subject.members : [];
    return repositories.length === 1 && compat.isContributed(repositories[0]) ? repositories[0] : null;
  }

  if (typeof updateDetails === "function") {
    const baseUpdateDetails = updateDetails;
    updateDetails = function contributedUpdateDetails(subject) {
      baseUpdateDetails(subject);
      if (!subject) return;
      const repository = directRepository(subject);
      const repositories = Array.isArray(subject?.repos) ? subject.repos : Array.isArray(subject?.members) ? subject.members : [];
      const contributedCount = repositories.filter((repo) => compat.isContributed(repo)).length;
      if (repository) {
        const meta = compat.metadataFor(repository);
        if (!meta) return;
        if (typeof detailsTitle !== "undefined" && detailsTitle) detailsTitle.textContent = meta.label;
        if (typeof detailsLink !== "undefined" && detailsLink) {
          detailsLink.href = meta.url;
          detailsLink.hidden = false;
          detailsLink.textContent = "Open repository ↗";
        }
        replaceKind("Contributed");
        appendRow("Commits", String(meta.contribution.commits) + (meta.contribution.commitsTruncated ? "+" : ""));
        appendRow("Pull requests", String(meta.contribution.pullRequests) + (meta.contribution.pullRequestsTruncated ? "+" : ""));
        appendRow("Merged PRs", String(meta.contribution.mergedPullRequests));
        if (meta.sourceFork) appendRow("Source", "Fork repository");
        if (meta.sourceArchived) appendRow("Source status", "Archived");
      } else if (contributedCount > 0) {
        appendRow("Contributed", String(contributedCount));
      }
    };
  }

  compat.markRuntimeReady();
  window.ProjectMapContributedRuntime = Object.freeze({ ready: true });
})();
`;

export async function applyContributedViewState(outputDir = resolve(process.cwd(), "site")) {
  await writeFile(join(outputDir, "contributed-compat.js"), COMPAT_SOURCE);
  await writeFile(join(outputDir, "contributed-runtime.js"), RUNTIME_SOURCE);

  for (const file of ["view-state.js", "tree-router.js", "dedicated-view-state.js"]) {
    const path = join(outputDir, file);
    const source = await readFile(path, "utf8");
    const patched = patchStatusProjection(source, file);
    if (patched !== source) await writeFile(path, patched);
  }

  const matrixPath = join(outputDir, "matrix-viewer.js");
  const matrixSource = await readFile(matrixPath, "utf8");
  await writeFile(matrixPath, patchMatrix(matrixSource));

  const sankeyPath = join(outputDir, "sankey-viewer.js");
  const sankeySource = await readFile(sankeyPath, "utf8");
  await writeFile(sankeyPath, patchSankey(sankeySource));

  const cssPath = join(outputDir, "viewer.css");
  const css = await readFile(cssPath, "utf8");
  const cssAppend = '\n.control-cluster .status-contributed { --status-color: var(--relation); }\n.legend .contributed { background: var(--relation); }\n';
  if (!css.includes(".status-contributed")) await writeFile(cssPath, css + cssAppend);

  const sharedPath = join(outputDir, "u", "index.html");
  const sharedHtml = await readFile(sharedPath, "utf8");
  await writeFile(sharedPath, patchHtml(sharedHtml, '<script src="../viewer.js" defer></script>'));

  for (const style of DEDICATED_STYLES) {
    const htmlPath = join(outputDir, style, "index.html");
    const html = await readFile(htmlPath, "utf8");
    await writeFile(htmlPath, patchHtml(html, `<script src="../${style}-viewer.js" defer></script>`));
  }
}

async function main() {
  const outputDir = resolve(process.argv[2] || join(process.cwd(), "site"));
  await applyContributedViewState(outputDir);
  console.log("Attached strict Contributed projection and fourth-status semantics to all 12 presets");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}