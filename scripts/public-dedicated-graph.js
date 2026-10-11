"use strict";

(() => {
  const MAX_CONTRIBUTED_REPOSITORIES = 12;
  const MAX_CONTRIBUTION_COUNT = 1_000_000;
  const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
  const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

  function cleanText(value, max) {
    return typeof value === "string" ? value.slice(0, max) : "";
  }

  function boundedContributedInteger(value, max) {
    return Number.isInteger(value) && value >= 0 && value <= max ? value : null;
  }

  function validContributedIso(value) {
    return typeof value === "string" && Number.isFinite(Date.parse(value));
  }

  function safeGithubRepositoryUrl(value, owner, name, allowAdditionalPath) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      if (url.protocol !== "https:" || url.hostname !== "github.com" || parts.length < 2 || (!allowAdditionalPath && parts.length !== 2)) return null;
      if (parts[0].toLowerCase() !== owner.toLowerCase() || parts[1].toLowerCase() !== name.toLowerCase()) return null;
      return "https://github.com/" + encodeURIComponent(owner) + "/" + encodeURIComponent(name);
    } catch {
      return null;
    }
  }

  function repositoryMetadata(raw, url, topicLimit) {
    return {
      url,
      description: cleanText(raw.description, 2000),
      language: typeof raw.language === "string" ? raw.language.slice(0, 100) : null,
      topics: Array.isArray(raw.topics) ? raw.topics.filter((item) => typeof item === "string").slice(0, topicLimit).map((item) => item.slice(0, 80)) : [],
      stars: Number.isFinite(raw.stars) ? Math.max(0, Math.floor(raw.stars)) : 0,
      forks: Number.isFinite(raw.forks) ? Math.max(0, Math.floor(raw.forks)) : 0,
      fork: raw.fork === true,
      archived: raw.archived === true,
    };
  }

  function ownedRepositoryMetadata(raw, owner, name) {
    if (!REPO_RE.test(name)) return null;
    const url = safeGithubRepositoryUrl(raw.url, owner, name, true);
    return url ? repositoryMetadata(raw, url, 40) : null;
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
    const owner = cleanText(raw.repositoryOwner, 39);
    const name = cleanText(raw.repositoryName, 100);
    const fullName = cleanText(raw.label, 141);
    if (!OWNER_RE.test(owner) || !REPO_RE.test(name) || owner.toLowerCase() === String(projectOwner).toLowerCase()) return null;
    if (fullName.toLowerCase() !== (owner + "/" + name).toLowerCase()) return null;
    const id = cleanText(raw.id, 180);
    if (id !== "repository:" + fullName.toLowerCase()) return null;
    const url = safeGithubRepositoryUrl(raw.url, owner, name, false);
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
      ...repositoryMetadata(raw, url, 20),
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

  function completeGraph(value, safe) {
    const rawContributed = value.nodes.filter((node) => node?.type === "repository" && node?.relation === "contributed");
    if (!rawContributed.length) return safe;
    if (rawContributed.length > MAX_CONTRIBUTED_REPOSITORIES) return null;
    const diagnostics = safeContributedDiagnostics(value.externalContributions, rawContributed.length);
    if (!diagnostics) return null;
    const ids = new Set(safe.nodes.map((node) => node?.id).filter(Boolean));
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
  }

  function projectLayout(graph) {
    const graphNodes = graph.nodes;
    const contributed = graphNodes.filter((node) => node?.type === "repository" && node?.relation === "contributed");
    if (!contributed.length) return graph;
    const ids = new Set(graphNodes.map((node) => node?.id).filter(Boolean));
    let key = "__project_map_external_contributions__";
    while (ids.has("group:" + key)) key += "_";
    const projectedNodes = graphNodes.map((node) => node?.type === "repository" && node?.relation === "contributed"
      ? { ...node, groupId: key, groupLabel: "External contributions" }
      : node);
    projectedNodes.push({
      id: "group:" + key,
      label: "External contributions",
      type: "group",
      relation: "contributed",
      repositoryCount: contributed.length,
    });
    return { ...graph, nodes: projectedNodes };
  }

  function appendDetails(value, detailsMeta, graph) {
    function appendRow(key, text) {
      if (text == null || text === "") return;
      const existing = [...detailsMeta.querySelectorAll("dt")].find((item) => item.textContent === key);
      if (existing) {
        if (existing.nextElementSibling) existing.nextElementSibling.textContent = String(text);
        return;
      }
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = key;
      dd.textContent = String(text);
      detailsMeta.append(dt, dd);
    }
    if (value?.type === "repository" && value?.relation === "contributed") {
      const kind = [...detailsMeta.querySelectorAll("dt")].find((item) => item.textContent === "Kind");
      if (kind?.nextElementSibling) kind.nextElementSibling.textContent = "Contributed";
      appendRow("External owner", value.repositoryOwner);
      appendRow("Commits", String(value.contribution?.commits ?? 0) + (value.contribution?.commitsTruncated ? "+" : ""));
      appendRow("Pull requests", String(value.contribution?.pullRequests ?? 0) + (value.contribution?.pullRequestsTruncated ? "+" : ""));
      appendRow("Merged PRs", value.contribution?.mergedPullRequests ?? 0);
      const sourceFlags = [value.fork ? "fork" : "", value.archived ? "archived" : ""].filter(Boolean).join(" · ");
      if (sourceFlags) appendRow("Source flags", sourceFlags);
      const windowValue = graph?.externalContributions?.window;
      if (validContributedIso(windowValue?.from) && validContributedIso(windowValue?.to)) {
        appendRow("Contribution window", windowValue.from.slice(0, 10) + " → " + windowValue.to.slice(0, 10));
      }
      detailsMeta.hidden = false;
    } else if (value?.counts && Number.isFinite(value.counts.contributed)) {
      appendRow("Contributed", value.counts.contributed);
      detailsMeta.hidden = false;
    }
  }

  function installSnapshot(mode, readGraph) {
    window.ProjectMapContributedDedicatedViewer = Object.freeze({
      snapshot: () => ({
        mode,
        contributedRepositories: (readGraph()?.nodes || [])
          .filter((node) => node?.type === "repository" && node?.relation === "contributed")
          .map((node) => node.id)
          .sort(),
        contributedRepositoryCount: Number(readGraph()?.contributedRepositoryCount || 0),
      }),
    });
  }

  window.ProjectMapDedicatedGraph = Object.freeze({ ownedRepositoryMetadata, completeGraph, projectLayout, appendDetails, installSnapshot });
})();
