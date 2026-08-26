import { normalizeWeightedEdges as spatialNormalizeWeightedEdges } from "../../spatial-core/src/relations.js";

export function createProjectMapViewModelApi(dependencies = {}) {
  const STATUS_VALUES = Object.freeze(["original", "fork", "archived", "contributed"]);
  const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
  const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
  const MAX_NODES = 520;
  const MAX_EDGES = 1200;
  const MAX_CONTRIBUTED_REPOSITORIES = 12;
  const MAX_CONTRIBUTION_COUNT = 1_000_000;

  function cleanText(value, max) {
    return typeof value === "string" ? value.slice(0, max) : "";
  }

  function boundedInteger(value, max) {
    return Number.isInteger(value) && value >= 0 && value <= max ? value : null;
  }

  function validIso(value) {
    return typeof value === "string" && Number.isFinite(Date.parse(value));
  }

  function normalizeUsername(value) {
    const username = String(value || "").trim().toLowerCase();
    if (!USERNAME_RE.test(username)) throw new Error("Invalid GitHub username");
    return username;
  }

  function safeGithubRepositoryUrl(value, owner, name) {
    if (typeof value !== "string" || !USERNAME_RE.test(owner) || !REPO_RE.test(name)) return null;
    try {
      const url = new URL(value);
      const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      if (url.protocol !== "https:" || url.hostname !== "github.com" || parts.length < 2) return null;
      if (parts[0].toLowerCase() !== owner.toLowerCase() || parts[1].toLowerCase() !== name.toLowerCase()) return null;
      return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
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

  function safeContribution(value) {
    if (!value || typeof value !== "object") return null;
    const commits = boundedInteger(value.commits, MAX_CONTRIBUTION_COUNT);
    const pullRequests = boundedInteger(value.pullRequests, MAX_CONTRIBUTION_COUNT);
    const mergedPullRequests = boundedInteger(value.mergedPullRequests, MAX_CONTRIBUTION_COUNT);
    if (commits === null || pullRequests === null || mergedPullRequests === null || mergedPullRequests > pullRequests) return null;
    if (commits === 0 && mergedPullRequests === 0) return null;
    if (typeof value.commitsTruncated !== "boolean" || typeof value.pullRequestsTruncated !== "boolean") return null;
    return {
      commits,
      pullRequests,
      mergedPullRequests,
      commitsTruncated: value.commitsTruncated,
      pullRequestsTruncated: value.pullRequestsTruncated,
    };
  }

  function safeSearchFacets(raw) {
    return Array.isArray(raw?.taxonomyAssignment?.secondaryTags)
      ? [...new Set(raw.taxonomyAssignment.secondaryTags
          .filter((item) => typeof item === "string")
          .slice(0, 16)
          .map((item) => cleanText(item, 120))
          .filter(Boolean))]
      : [];
  }

  function safeSearchTaxonomy(value) {
    const categories = Array.isArray(value?.taxonomy?.categories) ? value.taxonomy.categories : [];
    const safe = categories
      .filter((category) => category && typeof category === "object")
      .slice(0, 80)
      .map((category) => ({
        id: cleanText(category.id, 120),
        label: cleanText(category.label, 120),
        aliases: Array.isArray(category.aliases)
          ? category.aliases.filter((item) => typeof item === "string").slice(0, 24).map((item) => cleanText(item, 120)).filter(Boolean)
          : [],
      }))
      .filter((category) => category.id && category.label);
    return safe.length ? { categories: safe } : null;
  }

  function repositoryStatus(node) {
    if (!node || node.type !== "repository") return null;
    if (node.relation === "contributed") return "contributed";
    if (node.archived === true) return "archived";
    return node.fork === true ? "fork" : "original";
  }

  function sanitizeProjectMapGraph(value, usernameValue) {
    let username;
    try {
      username = normalizeUsername(usernameValue);
    } catch {
      return null;
    }
    if (!value || typeof value !== "object" || String(value.owner || "").toLowerCase() !== username || !Array.isArray(value.nodes) || value.nodes.length > MAX_NODES) return null;

    const rawContributed = value.nodes.filter((node) => node?.type === "repository" && node?.relation === "contributed");
    if (rawContributed.length > MAX_CONTRIBUTED_REPOSITORIES) return null;
    const externalContributions = rawContributed.length ? safeDiagnostics(value.externalContributions, rawContributed.length) : null;
    if (rawContributed.length && !externalContributions) return null;

    const nodes = [];
    const ids = new Set();
    for (const raw of value.nodes) {
      if (!raw || typeof raw !== "object" || !["owner", "group", "repository"].includes(raw.type)) continue;
      const id = cleanText(raw.id, 180);
      const label = cleanText(raw.label, 141);
      if (!id || !label || ids.has(id)) continue;

      let node;
      if (raw.type === "owner") {
        node = { id, label: cleanText(label, 120), type: "owner", url: `https://github.com/${encodeURIComponent(username)}` };
      } else if (raw.type === "group") {
        node = {
          id,
          label: cleanText(label, 120),
          type: "group",
          repositoryCount: Number.isFinite(raw.repositoryCount) ? Math.max(0, Math.floor(raw.repositoryCount)) : 0,
        };
      } else if (raw.relation === "contributed") {
        const repositoryOwner = cleanText(raw.repositoryOwner, 39);
        const repositoryName = cleanText(raw.repositoryName, 100);
        const expectedLabel = `${repositoryOwner}/${repositoryName}`;
        if (!USERNAME_RE.test(repositoryOwner) || !REPO_RE.test(repositoryName) || repositoryOwner.toLowerCase() === username) return null;
        if (label.toLowerCase() !== expectedLabel.toLowerCase() || id !== `repository:${expectedLabel.toLowerCase()}`) return null;
        const url = safeGithubRepositoryUrl(raw.url, repositoryOwner, repositoryName);
        const contribution = safeContribution(raw.contribution);
        if (!url || !contribution) return null;
        node = {
          id,
          label: expectedLabel,
          type: "repository",
          relation: "contributed",
          repositoryOwner,
          repositoryName,
          externalOwner: repositoryOwner,
          url,
          description: cleanText(raw.description, 2000),
          language: cleanText(raw.language, 100) || null,
          topics: Array.isArray(raw.topics) ? raw.topics.filter((item) => typeof item === "string").slice(0, 20).map((item) => cleanText(item, 80)) : [],
          searchFacets: safeSearchFacets(raw),
          stars: Number.isFinite(raw.stars) ? Math.max(0, Math.floor(raw.stars)) : 0,
          forks: Number.isFinite(raw.forks) ? Math.max(0, Math.floor(raw.forks)) : 0,
          fork: raw.fork === true,
          archived: raw.archived === true,
          groupId: "",
          groupLabel: "",
          createdAt: validIso(raw.createdAt) ? raw.createdAt : "",
          updatedAt: validIso(raw.updatedAt) ? raw.updatedAt : "",
          contribution,
        };
      } else {
        const repositoryName = cleanText(raw.repositoryName, 100) || label;
        if (!REPO_RE.test(repositoryName) || label !== repositoryName) continue;
        const url = safeGithubRepositoryUrl(raw.url, username, repositoryName);
        if (!url) continue;
        node = {
          id,
          label: repositoryName,
          type: "repository",
          relation: "owned",
          repositoryOwner: username,
          repositoryName,
          externalOwner: null,
          url,
          description: cleanText(raw.description, 2000),
          language: cleanText(raw.language, 100) || null,
          topics: Array.isArray(raw.topics) ? raw.topics.filter((item) => typeof item === "string").slice(0, 40).map((item) => cleanText(item, 80)) : [],
          searchFacets: safeSearchFacets(raw),
          stars: Number.isFinite(raw.stars) ? Math.max(0, Math.floor(raw.stars)) : 0,
          forks: Number.isFinite(raw.forks) ? Math.max(0, Math.floor(raw.forks)) : 0,
          fork: raw.fork === true,
          archived: raw.archived === true,
          groupId: cleanText(raw.groupId, 140),
          groupLabel: cleanText(raw.groupLabel, 120),
          createdAt: validIso(raw.createdAt) ? raw.createdAt : "",
          updatedAt: validIso(raw.updatedAt) ? raw.updatedAt : "",
        };
      }
      ids.add(id);
      nodes.push(node);
    }

    if (!nodes.some((node) => node.type === "owner")) {
      const id = `user:${username}`;
      nodes.unshift({ id, label: username, type: "owner", url: `https://github.com/${encodeURIComponent(username)}` });
      ids.add(id);
    }

    const contributedIds = new Set(nodes.filter((node) => node.relation === "contributed").map((node) => node.id));
    const edges = [];
    for (const raw of Array.isArray(value.edges) ? value.edges.slice(0, MAX_EDGES) : []) {
      if (!raw || typeof raw !== "object" || !ids.has(raw.source) || !ids.has(raw.target)) continue;
      if (contributedIds.has(raw.target)) continue;
      edges.push({ source: cleanText(raw.source, 180), target: cleanText(raw.target, 180), type: cleanText(raw.type, 40) || "structural" });
    }
    const ownerId = nodes.find((node) => node.type === "owner")?.id || `user:${username}`;
    for (const target of contributedIds) edges.push({ source: ownerId, target, type: "contribution" });

    const repositoryIds = new Set(nodes.filter((node) => node.type === "repository").map((node) => node.id));
    const semanticCandidates = [];
    for (const raw of Array.isArray(value.semanticEdges) ? value.semanticEdges.slice(0, 2400) : []) {
      if (!raw || typeof raw !== "object" || raw.type !== "semantic") continue;
      semanticCandidates.push({ source: cleanText(raw.source, 220), target: cleanText(raw.target, 220), score: Number(raw.score) });
    }
    const normalizeWeightedEdges = dependencies.normalizeWeightedEdges;
    const semanticEdges = typeof normalizeWeightedEdges === "function"
      ? normalizeWeightedEdges(semanticCandidates, repositoryIds, { maxInput: 2400, maxOutput: 1200, minScore: 0, type: "semantic" })
      : semanticCandidates
          .filter((edge) => repositoryIds.has(edge.source) && repositoryIds.has(edge.target) && edge.source !== edge.target && Number.isFinite(edge.score) && edge.score >= 0 && edge.score <= 1)
          .slice(0, 1200)
          .map((edge) => ({ ...edge, type: "semantic" }));

    const searchTaxonomy = safeSearchTaxonomy(value);
    const graph = {
      owner: username,
      generatedAt: cleanText(value.generatedAt, 64),
      nodes,
      edges,
      semanticEdges,
      repositoryCount: nodes.filter((node) => node.type === "repository").length,
      groupCount: nodes.filter((node) => node.type === "group").length,
      contributedRepositoryCount: contributedIds.size,
    };
    if (externalContributions) graph.externalContributions = externalContributions;
    if (searchTaxonomy) graph.searchTaxonomy = searchTaxonomy;
    return graph;
  }

  function statusCounts(graph) {
    const counts = { original: 0, fork: 0, archived: 0, contributed: 0 };
    for (const node of Array.isArray(graph?.nodes) ? graph.nodes : []) {
      const status = repositoryStatus(node);
      if (status) counts[status] += 1;
    }
    return counts;
  }

  function projectByStatuses(graph, statusValues = STATUS_VALUES) {
    if (!graph || !Array.isArray(graph.nodes)) return null;
    const statuses = new Set(Array.from(statusValues || []).filter((value) => STATUS_VALUES.includes(value)));
    if (!statuses.size) return null;
    const visibleRepositoryIds = new Set(
      graph.nodes
        .filter((node) => node?.type === "repository" && statuses.has(repositoryStatus(node)))
        .map((node) => node.id),
    );
    const visibleGroupIds = new Set();
    for (const node of graph.nodes) {
      if (node?.type !== "repository" || !visibleRepositoryIds.has(node.id) || node.relation === "contributed") continue;
      if (node.groupId) visibleGroupIds.add(String(node.groupId).startsWith("group:") ? String(node.groupId) : `group:${node.groupId}`);
    }
    for (const edge of Array.isArray(graph.edges) ? graph.edges : []) {
      if (edge?.type === "membership" && visibleRepositoryIds.has(edge.target)) visibleGroupIds.add(edge.source);
    }

    const visibleNodeIds = new Set();
    const nodes = graph.nodes.filter((node) => {
      const keep = node?.type === "owner"
        || (node?.type === "group" && visibleGroupIds.has(node.id))
        || (node?.type === "repository" && visibleRepositoryIds.has(node.id));
      if (keep) visibleNodeIds.add(node.id);
      return keep;
    });
    const edges = (Array.isArray(graph.edges) ? graph.edges : []).filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
    const semanticEdges = (Array.isArray(graph.semanticEdges) ? graph.semanticEdges : []).filter((edge) => visibleRepositoryIds.has(edge.source) && visibleRepositoryIds.has(edge.target));
    return {
      ...graph,
      nodes,
      edges,
      semanticEdges,
      repositoryCount: visibleRepositoryIds.size,
      groupCount: visibleGroupIds.size,
      contributedRepositoryCount: nodes.filter((node) => node?.type === "repository" && node.relation === "contributed").length,
    };
  }

  return Object.freeze({
    version: 1,
    STATUS_VALUES,
    normalizeUsername,
    repositoryStatus,
    sanitizeGraph: sanitizeProjectMapGraph,
    statusCounts,
    projectByStatuses,
  });
}

export const ProjectMapViewModel = createProjectMapViewModelApi({ normalizeWeightedEdges: spatialNormalizeWeightedEdges });
