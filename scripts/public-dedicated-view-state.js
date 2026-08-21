"use strict";

(() => {
  const STATUS_VALUES = ["original", "fork", "archived"];
  const initialParams = new URL(location.href).searchParams;
  const nativeFetch = window.fetch.bind(window);
  let sourceGraph = null;
  let counts = { original: 0, fork: 0, archived: 0 };

  function parseStatuses(value) {
    if (!value) return new Set(STATUS_VALUES);
    const aliases = { o: "original", f: "fork", a: "archived" };
    const parsed = String(value)
      .split(",")
      .map((item) => aliases[item] || item)
      .filter((item) => STATUS_VALUES.includes(item));
    return parsed.length ? new Set(parsed) : new Set(STATUS_VALUES);
  }

  const statuses = parseStatuses(initialParams.get("status"));

  function repositoryStatus(node) {
    if (!node || node.type !== "repository") return null;
    if (node.archived === true) return "archived";
    return node.fork === true ? "fork" : "original";
  }

  function countStatuses(graph) {
    const next = { original: 0, fork: 0, archived: 0 };
    for (const node of Array.isArray(graph?.nodes) ? graph.nodes : []) {
      const value = repositoryStatus(node);
      if (value) next[value] += 1;
    }
    return next;
  }

  function normalizeStatuses() {
    if (!sourceGraph) return;
    const available = STATUS_VALUES.filter((value) => counts[value] > 0);
    if (!available.length) return;
    for (const value of STATUS_VALUES) if (counts[value] === 0) statuses.delete(value);
    if (!available.some((value) => statuses.has(value))) {
      for (const value of available) statuses.add(value);
    }
  }

  function syncUrl() {
    const url = new URL(location.href);
    const available = sourceGraph ? STATUS_VALUES.filter((value) => counts[value] > 0) : STATUS_VALUES;
    const isDefault = available.length > 0 && available.every((value) => statuses.has(value)) && statuses.size === available.length;
    if (isDefault) url.searchParams.delete("status");
    else url.searchParams.set("status", STATUS_VALUES.filter((value) => statuses.has(value)).join(","));
    history.replaceState(null, "", url);
    return url;
  }

  function projectGraph(graph) {
    if (!graph || typeof graph !== "object" || !Array.isArray(graph.nodes)) return graph;
    const repositories = graph.nodes.filter((node) => node?.type === "repository");
    const visibleRepositories = repositories.filter((node) => statuses.has(repositoryStatus(node)));
    const visibleRepositoryIds = new Set(visibleRepositories.map((node) => node.id));
    const groupIds = new Set();

    for (const repo of visibleRepositories) {
      if (!repo.groupId) continue;
      const groupId = String(repo.groupId);
      groupIds.add(groupId.startsWith("group:") ? groupId : `group:${groupId}`);
    }
    for (const edge of Array.isArray(graph.edges) ? graph.edges : []) {
      if (edge?.type === "membership" && visibleRepositoryIds.has(edge.target)) groupIds.add(edge.source);
    }

    const nodeIds = new Set();
    const nodes = graph.nodes.filter((node) => {
      const keep = node?.type === "owner"
        || (node?.type === "group" && groupIds.has(node.id))
        || (node?.type === "repository" && visibleRepositoryIds.has(node.id));
      if (keep) nodeIds.add(node.id);
      return keep;
    });
    const edges = Array.isArray(graph.edges)
      ? graph.edges.filter((edge) => nodeIds.has(edge?.source) && nodeIds.has(edge?.target))
      : [];
    const semanticEdges = Array.isArray(graph.semanticEdges)
      ? graph.semanticEdges.filter((edge) => visibleRepositoryIds.has(edge?.source) && visibleRepositoryIds.has(edge?.target))
      : graph.semanticEdges;

    return {
      ...graph,
      nodes,
      edges,
      ...(Array.isArray(graph.semanticEdges) ? { semanticEdges } : {}),
      repositoryCount: visibleRepositoryIds.size,
      groupCount: groupIds.size,
    };
  }

  function profileGraphRequest(input) {
    try {
      const href = input instanceof Request ? input.url : String(input);
      const url = new URL(href, location.href);
      return url.protocol === "https:"
        && url.hostname === "raw.githubusercontent.com"
        && /\/HEAD\/project-map\/graph\.json$/.test(url.pathname);
    } catch {
      return false;
    }
  }

  function projectedResponse(response, graph) {
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(graph), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  function statusLabel(value) {
    return value === "original" ? "Original" : value === "fork" ? "Fork" : "Archived";
  }

  function updateControls() {
    normalizeStatuses();
    const group = document.getElementById("dedicatedRepositoryFilters");
    if (!group) return;
    for (const button of group.querySelectorAll("[data-status-filter]")) {
      const value = button.dataset.statusFilter;
      const count = counts[value] || 0;
      const label = statusLabel(value);
      button.disabled = Boolean(sourceGraph) && count === 0;
      button.setAttribute("aria-pressed", String(statuses.has(value)));
      button.setAttribute("aria-label", `${label} repositories: ${count}. ${count ? "Toggle visibility." : "None are available in this map."}`);
      button.textContent = `${label} ${count}`;
      button.title = count
        ? `${count} ${label.toLowerCase()} repositories in this map.`
        : `No ${label.toLowerCase()} repositories are available in this map. Regenerate with them enabled if they were excluded.`;
    }
    const result = document.getElementById("resultCount");
    if (result) {
      const total = STATUS_VALUES.reduce((sum, value) => sum + counts[value], 0);
      const visible = STATUS_VALUES.reduce((sum, value) => sum + (statuses.has(value) ? counts[value] : 0), 0);
      result.textContent = `${visible} / ${total} repos`;
      result.title = `${visible} visible of ${total} repositories in this map`;
    }
  }

  function installControls() {
    const controls = document.querySelector(".controls");
    const resetButton = document.getElementById("reset");
    if (!controls || !resetButton || document.getElementById("dedicatedRepositoryFilters")) {
      updateControls();
      return;
    }

    const group = document.createElement("span");
    group.id = "dedicatedRepositoryFilters";
    group.className = "control-cluster repository-filters";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Repositories");

    const label = document.createElement("span");
    label.className = "control-cluster-label";
    label.textContent = "Repositories";
    group.append(label);

    for (const value of STATUS_VALUES) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `status-chip status-${value}`;
      button.dataset.statusFilter = value;
      button.setAttribute("aria-pressed", String(statuses.has(value)));
      button.textContent = statusLabel(value);
      button.addEventListener("click", () => {
        if (button.disabled) return;
        if (statuses.has(value)) {
          if (statuses.size === 1) return;
          statuses.delete(value);
        } else {
          statuses.add(value);
        }
        const url = syncUrl();
        // Dedicated presets have different layout state shapes. Re-entering the
        // same static route is the single safe projection boundary and avoids
        // eight renderer-specific mutation paths.
        location.replace(url.toString());
      });
      group.append(button);
    }

    const result = document.createElement("span");
    result.id = "resultCount";
    group.append(result);
    resetButton.insertAdjacentElement("afterend", group);
    updateControls();
  }

  window.fetch = async function projectMapDedicatedStatusFetch(input, init) {
    const response = await nativeFetch(input, init);
    if (!response.ok || !profileGraphRequest(input)) return response;
    try {
      const graph = await response.clone().json();
      if (!graph || typeof graph !== "object" || !Array.isArray(graph.nodes)) return response;
      sourceGraph = graph;
      counts = countStatuses(graph);
      normalizeStatuses();
      syncUrl();
      updateControls();
      return projectedResponse(response, projectGraph(graph));
    } catch {
      return response;
    }
  };

  window.ProjectMapDedicatedViewState = Object.freeze({
    projectGraph,
    snapshot() {
      return {
        statuses: STATUS_VALUES.filter((value) => statuses.has(value)),
        statusCounts: { ...counts },
      };
    },
  });

  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", installControls, { once: true });
  else installControls();
})();