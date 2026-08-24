import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const DEDICATED_CONTRIBUTED_MODES = Object.freeze([
  "radial",
  "tree",
  "treemap",
  "timeline",
  "cluster",
  "sunburst",
  "matrix",
  "sankey",
]);

const RUNTIME_MARKER = "/* Project Map Contributed dedicated-viewer contract */";

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

function patchAggregateSource(source, mode) {
  let next = source;
  if (mode === "matrix") {
    next = replaceRequired(
      next,
      "counts={original:0,fork:0,archived:0};",
      "counts={original:0,fork:0,archived:0,contributed:0};",
      "Matrix status counts",
    );
    next = replaceRequired(
      next,
      'for(const st of["original","fork","archived"])',
      'for(const st of["original","fork","archived","contributed"])',
      "Matrix status composition bar",
    );
  }
  if (mode === "sankey") {
    next = replaceRequired(
      next,
      "counts={original:0,fork:0,archived:0};",
      "counts={original:0,fork:0,archived:0,contributed:0};",
      "Sankey status counts",
    );
    next = replaceRequired(
      next,
      'const statuses=["original","fork","archived"]',
      'const statuses=["original","fork","archived","contributed"]',
      "Sankey status columns",
    );
    next = replaceRequired(
      next,
      "statusGap=24,statusUnit=(usable-statusGap*2)/total",
      "statusGap=20,statusUnit=(usable-statusGap*(statuses.length-1))/total",
      "Sankey status spacing",
    );
    next = replaceRequired(
      next,
      "drawBand(state.owner.x+state.owner.w,ownerCursor,ownerCursor+flowH,group.x,group.y,group.y+flowH,c.group,state.query?0.11:0.18)",
      'drawBand(state.owner.x+state.owner.w,ownerCursor,ownerCursor+flowH,group.x,group.y,group.y+flowH,group.group?.relation==="contributed"?c.contributed:c.group,state.query?0.11:0.18)',
      "Sankey external contribution source band",
    );
    next = replaceRequired(
      next,
      'for(const group of state.groups)drawNode(group,c.group,group.group.label.length>20?group.group.label.slice(0,19)+"…":group.group.label,"right")',
      'for(const group of state.groups)drawNode(group,group.group?.relation==="contributed"?c.contributed:c.group,group.group.label.length>20?group.group.label.slice(0,19)+"…":group.group.label,"right")',
      "Sankey external contribution group node",
    );
  }
  return next;
}

function contributedDedicatedRuntime(mode) {
  return `${RUNTIME_MARKER}
(() => {
  const MODE = ${JSON.stringify(mode)};
  const MAX_CONTRIBUTED_REPOSITORIES = 12;
  const MAX_CONTRIBUTION_COUNT = 1_000_000;
  const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
  const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
  const EXTERNAL_LAYOUT_MODES = new Set(["timeline", "cluster", "sunburst", "matrix", "sankey"]);

  function cleanContributedText(value, max) {
    return typeof value === "string" ? value.slice(0, max) : "";
  }

  function boundedContributedInteger(value, max) {
    return Number.isInteger(value) && value >= 0 && value <= max ? value : null;
  }

  function validContributedIso(value) {
    return typeof value === "string" && Number.isFinite(Date.parse(value));
  }

  function safeContributedGithubUrl(value, owner, name) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      if (url.protocol !== "https:" || url.hostname !== "github.com" || parts.length !== 2) return null;
      if (parts[0].toLowerCase() !== owner.toLowerCase() || parts[1].toLowerCase() !== name.toLowerCase()) return null;
      return "https://github.com/" + encodeURIComponent(owner) + "/" + encodeURIComponent(name);
    } catch {
      return null;
    }
  }

  function safeContributedDiagnostics(value, includedRepositories) {
    if (!value || typeof value !== "object") return null;
    const windowValue = value.window;
    if (!windowValue || !validContributedIso(windowValue.from) || !validContributedIso(windowValue.to) || Date.parse(windowValue.from) > Date.parse(windowValue.to)) return null;
    const cap = boundedContributedInteger(value.cap, MAX_CONTRIBUTED_REPOSITORIES);
    const candidates = boundedContributedInteger(value.candidateRepositories, 100);
    const included = boundedContributedInteger(value.includedRepositories, MAX_CONTRIBUTED_REPOSITORIES);
    const omitted = boundedContributedInteger(value.omittedRepositories, 100);
    const truncated = boundedContributedInteger(value.truncatedRepositories, 100);
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

  function safeContributedRepository(raw, projectOwner) {
    if (!raw || typeof raw !== "object" || raw.type !== "repository" || raw.relation !== "contributed") return null;
    const owner = cleanContributedText(raw.repositoryOwner, 39);
    const name = cleanContributedText(raw.repositoryName, 100);
    const fullName = cleanContributedText(raw.label, 141);
    if (!OWNER_RE.test(owner) || !REPO_RE.test(name) || owner.toLowerCase() === String(projectOwner).toLowerCase()) return null;
    if (fullName.toLowerCase() !== (owner + "/" + name).toLowerCase()) return null;
    const id = cleanContributedText(raw.id, 180);
    if (id !== "repository:" + fullName.toLowerCase()) return null;
    const url = safeContributedGithubUrl(raw.url, owner, name);
    if (!url) return null;
    const contribution = raw.contribution;
    if (!contribution || typeof contribution !== "object") return null;
    const commits = boundedContributedInteger(contribution.commits, MAX_CONTRIBUTION_COUNT);
    const pullRequests = boundedContributedInteger(contribution.pullRequests, MAX_CONTRIBUTION_COUNT);
    const mergedPullRequests = boundedContributedInteger(contribution.mergedPullRequests, MAX_CONTRIBUTION_COUNT);
    if (commits === null || pullRequests === null || mergedPullRequests === null || mergedPullRequests > pullRequests) return null;
    if (commits === 0 && mergedPullRequests === 0) return null;
    if (typeof contribution.commitsTruncated !== "boolean" || typeof contribution.pullRequestsTruncated !== "boolean") return null;
    const node = {
      id,
      label: owner + "/" + name,
      type: "repository",
      relation: "contributed",
      repositoryOwner: owner,
      repositoryName: name,
      url,
      description: cleanContributedText(raw.description, 2000),
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
    if (validContributedIso(raw.createdAt)) node.createdAt = raw.createdAt;
    if (validContributedIso(raw.updatedAt)) node.updatedAt = raw.updatedAt;
    return node;
  }

  if (typeof sanitizeGraph === "function") {
    const baseSanitizeGraph = sanitizeGraph;
    sanitizeGraph = function contributedAwareDedicatedSanitizeGraph(value) {
      const safe = baseSanitizeGraph(value);
      if (!safe || !value || typeof value !== "object" || !Array.isArray(value.nodes)) return safe;
      const rawContributed = value.nodes.filter((node) => node?.type === "repository" && node?.relation === "contributed");
      if (!rawContributed.length) return safe;
      if (rawContributed.length > MAX_CONTRIBUTED_REPOSITORIES) return null;
      const diagnostics = safeContributedDiagnostics(value.externalContributions, rawContributed.length);
      if (!diagnostics) return null;
      const ids = new Set((safe.nodes || []).map((node) => node?.id).filter(Boolean));
      const contributed = [];
      for (const raw of rawContributed) {
        const node = safeContributedRepository(raw, safe.owner);
        if (!node || ids.has(node.id)) return null;
        ids.add(node.id);
        contributed.push(node);
      }
      safe.nodes.push(...contributed);
      safe.contributedRepositoryCount = contributed.length;
      safe.externalContributions = diagnostics;
      return safe;
    };
  }

  if (typeof statusOf === "function") {
    const baseStatusOf = statusOf;
    statusOf = function contributedAwareStatus(repo) {
      return repo?.relation === "contributed" ? "contributed" : baseStatusOf(repo);
    };
  }

  if (typeof nodeStatus === "function") {
    const baseNodeStatus = nodeStatus;
    nodeStatus = function contributedAwareNodeStatus(node) {
      return node?.type === "repository" && node?.relation === "contributed" ? "contributed" : baseNodeStatus(node);
    };
  }

  if (typeof palette === "function") {
    const basePalette = palette;
    palette = function contributedAwarePalette() {
      return { ...basePalette(), contributed: "#E69F00" };
    };
  }

  if (EXTERNAL_LAYOUT_MODES.has(MODE) && typeof buildLayout === "function") {
    const baseBuildLayout = buildLayout;
    buildLayout = function contributedAwareBuildLayout(graph) {
      const graphNodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
      const contributed = graphNodes.filter((node) => node?.type === "repository" && node?.relation === "contributed");
      if (!contributed.length) return baseBuildLayout(graph);
      const ids = new Set(graphNodes.map((node) => node?.id).filter(Boolean));
      let key = "__project_map_external_contributions__";
      while (ids.has("group:" + key)) key += "_";
      const groupId = "group:" + key;
      const projectedNodes = graphNodes.map((node) => node?.type === "repository" && node?.relation === "contributed"
        ? { ...node, groupId: key, groupLabel: "External contributions" }
        : node);
      projectedNodes.push({
        id: groupId,
        label: "External contributions",
        type: "group",
        relation: "contributed",
        repositoryCount: contributed.length,
      });
      return baseBuildLayout({ ...graph, nodes: projectedNodes });
    };
  }

  function appendContributedDetailRow(key, value) {
    if (!detailsMeta || value == null || value === "") return;
    const existing = [...detailsMeta.querySelectorAll("dt")].find((item) => item.textContent === key);
    if (existing) {
      if (existing.nextElementSibling) existing.nextElementSibling.textContent = String(value);
      return;
    }
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = key;
    dd.textContent = String(value);
    detailsMeta.append(dt, dd);
  }

  if (typeof updateDetails === "function") {
    const baseUpdateDetails = updateDetails;
    updateDetails = function contributedAwareDedicatedDetails(value) {
      const result = baseUpdateDetails(value);
      if (value?.type === "repository" && value?.relation === "contributed") {
        const kind = [...detailsMeta.querySelectorAll("dt")].find((item) => item.textContent === "Kind");
        if (kind?.nextElementSibling) kind.nextElementSibling.textContent = "Contributed";
        appendContributedDetailRow("External owner", value.repositoryOwner);
        appendContributedDetailRow("Commits", String(value.contribution?.commits ?? 0) + (value.contribution?.commitsTruncated ? "+" : ""));
        appendContributedDetailRow("Pull requests", String(value.contribution?.pullRequests ?? 0) + (value.contribution?.pullRequestsTruncated ? "+" : ""));
        appendContributedDetailRow("Merged PRs", value.contribution?.mergedPullRequests ?? 0);
        const sourceFlags = [value.fork ? "fork" : "", value.archived ? "archived" : ""].filter(Boolean).join(" · ");
        if (sourceFlags) appendContributedDetailRow("Source flags", sourceFlags);
        const windowValue = state.graph?.externalContributions?.window;
        if (validContributedIso(windowValue?.from) && validContributedIso(windowValue?.to)) {
          appendContributedDetailRow("Contribution window", windowValue.from.slice(0, 10) + " → " + windowValue.to.slice(0, 10));
        }
        detailsMeta.hidden = false;
      } else if (value?.counts && Number.isFinite(value.counts.contributed)) {
        appendContributedDetailRow("Contributed", value.counts.contributed);
        detailsMeta.hidden = false;
      }
      return result;
    };
  }

  window.ProjectMapContributedDedicatedViewer = Object.freeze({
    snapshot: () => ({
      mode: MODE,
      contributedRepositories: (state.graph?.nodes || [])
        .filter((node) => node?.type === "repository" && node?.relation === "contributed")
        .map((node) => node.id)
        .sort(),
      contributedRepositoryCount: Number(state.graph?.contributedRepositoryCount || 0),
    }),
  });
})();`;
}

export function patchDedicatedViewerRuntime(source, mode) {
  if (!DEDICATED_CONTRIBUTED_MODES.includes(mode)) throw new Error(`Unsupported dedicated mode: ${mode}`);
  if (source.includes(RUNTIME_MARKER)) return source;
  let next = patchAggregateSource(source, mode);
  const anchor = "function showError";
  if (!next.includes(anchor)) throw new Error(`Could not locate ${mode} startup boundary`);
  const runtime = `/* eslint-disable no-func-assign, no-undef */\n${contributedDedicatedRuntime(mode)}\n/* eslint-enable no-func-assign, no-undef */\n`;
  next = next.replace(anchor, `${runtime}${anchor}`);
  if (!next.includes(RUNTIME_MARKER)) throw new Error(`Could not attach Contributed runtime to ${mode}`);
  return next;
}

export async function applyContributedDedicatedViewers(outputDir = resolve(process.cwd(), "site")) {
  for (const mode of DEDICATED_CONTRIBUTED_MODES) {
    const path = join(outputDir, `${mode}-viewer.js`);
    const source = await readFile(path, "utf8");
    const next = patchDedicatedViewerRuntime(source, mode);
    if (next !== source) await writeFile(path, next);
  }
}

async function main() {
  const outputDir = resolve(process.argv[2] || join(process.cwd(), "site"));
  await applyContributedDedicatedViewers(outputDir);
  console.log(`Attached Contributed contract to ${DEDICATED_CONTRIBUTED_MODES.length} dedicated viewers`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
