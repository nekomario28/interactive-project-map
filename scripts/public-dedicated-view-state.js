"use strict";

(() => {
  const STATUS_VALUES = ["original", "fork", "archived"];
  const params = new URL(location.href).searchParams;
  const aliases = { o: "original", f: "fork", a: "archived" };
  const parsed = String(params.get("status") || "")
    .split(",")
    .map((value) => aliases[value] || value)
    .filter((value) => STATUS_VALUES.includes(value));
  const statuses = new Set(parsed.length ? parsed : STATUS_VALUES);
  const buttons = [...document.querySelectorAll("[data-status-filter]")];
  const resultCount = document.getElementById("resultCount");
  const counts = { original: 0, fork: 0, archived: 0 };
  let graphLoaded = false;

  function repositoryStatus(node) {
    if (!node || node.type !== "repository") return null;
    if (node.archived === true) return "archived";
    return node.fork === true ? "fork" : "original";
  }

  function normalizeStatuses() {
    const available = STATUS_VALUES.filter((value) => counts[value] > 0);
    if (!available.length) return;
    for (const value of STATUS_VALUES) if (counts[value] === 0) statuses.delete(value);
    if (!available.some((value) => statuses.has(value))) statuses.add(available[0]);
  }

  function updateControls() {
    normalizeStatuses();
    let total = 0;
    let visible = 0;
    for (const value of STATUS_VALUES) {
      total += counts[value];
      if (statuses.has(value)) visible += counts[value];
    }
    for (const button of buttons) {
      const value = button.dataset.statusFilter;
      const count = counts[value] || 0;
      const label = value === "original" ? "Original" : value === "fork" ? "Fork" : "Archived";
      button.classList.add("status-chip", `status-${value}`);
      button.dataset.statusCount = String(count);
      button.disabled = !graphLoaded || count === 0;
      button.setAttribute("aria-pressed", String(statuses.has(value)));
      button.setAttribute("aria-label", `${label} repositories: ${count}. ${count ? "Toggle visibility." : "None are available in this map."}`);
      button.textContent = graphLoaded ? `${label} ${count}` : label;
      button.title = count
        ? `${count} ${label.toLowerCase()} repositories in this map.`
        : graphLoaded
          ? `No ${label.toLowerCase()} repositories are available in this map. Regenerate with them enabled if they were excluded.`
          : "Repository counts are loading.";
    }
    if (resultCount) {
      resultCount.textContent = graphLoaded ? `${visible} / ${total} repos` : "";
      resultCount.title = graphLoaded ? `${visible} visible of ${total} repositories` : "";
    }
  }

  function syncAndReload() {
    const url = new URL(location.href);
    const available = STATUS_VALUES.filter((value) => counts[value] > 0);
    const defaults = available.length > 0
      && available.every((value) => statuses.has(value))
      && statuses.size === available.length;
    if (defaults) url.searchParams.delete("status");
    else url.searchParams.set("status", STATUS_VALUES.filter((value) => statuses.has(value)).join(","));
    location.replace(url.toString());
  }

  function filterGraph(value) {
    if (!value || typeof value !== "object" || !Array.isArray(value.nodes)) return value;
    counts.original = 0;
    counts.fork = 0;
    counts.archived = 0;
    for (const node of value.nodes) {
      const status = repositoryStatus(node);
      if (status) counts[status] += 1;
    }
    graphLoaded = true;
    normalizeStatuses();

    const statusNodes = value.nodes.filter((node) => {
      const status = repositoryStatus(node);
      return !status || statuses.has(status);
    });
    const groupCounts = new Map();
    for (const node of statusNodes) {
      if (node?.type !== "repository") continue;
      const groupId = String(node.groupId || "");
      if (!groupId) continue;
      const normalized = groupId.startsWith("group:") ? groupId : `group:${groupId}`;
      groupCounts.set(normalized, (groupCounts.get(normalized) || 0) + 1);
    }

    // A category is contextual structure, not an independently visible item.
    // Once status filtering removes its last repository, remove the category and
    // its ownership edge as well so every dedicated layout sees the same graph.
    const normalizedNodes = statusNodes
      .filter((node) => node?.type !== "group" || (groupCounts.get(node.id) || 0) > 0)
      .map((node) => node?.type === "group"
        ? { ...node, repositoryCount: groupCounts.get(node.id) || 0 }
        : node);
    const ids = new Set(normalizedNodes.map((node) => node?.id).filter(Boolean));
    const filtered = {
      ...value,
      nodes: normalizedNodes,
      repositoryCount: normalizedNodes.filter((node) => node?.type === "repository").length,
      groupCount: normalizedNodes.filter((node) => node?.type === "group").length,
    };
    if (Array.isArray(value.edges)) filtered.edges = value.edges.filter((edge) => ids.has(edge?.source) && ids.has(edge?.target));
    if (Array.isArray(value.semanticEdges)) filtered.semanticEdges = value.semanticEdges.filter((edge) => ids.has(edge?.source) && ids.has(edge?.target));
    updateControls();
    return filtered;
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function projectMapDedicatedFetch(input, init) {
    const response = await nativeFetch(input, init);
    try {
      const rawUrl = typeof input === "string" || input instanceof URL ? input : input?.url;
      const url = new URL(rawUrl, location.href);
      if (!response.ok || !url.pathname.endsWith("/project-map/graph.json")) return response;
      const value = await response.clone().json();
      const filtered = filterGraph(value);
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      headers.set("content-type", "application/json; charset=utf-8");
      return new Response(JSON.stringify(filtered), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      return response;
    }
  };

  for (const button of buttons) {
    button.addEventListener("click", () => {
      const value = button.dataset.statusFilter;
      if (!graphLoaded || !STATUS_VALUES.includes(value) || counts[value] === 0) return;
      if (statuses.has(value)) {
        const activeAvailable = STATUS_VALUES.filter((status) => counts[status] > 0 && statuses.has(status));
        if (activeAvailable.length === 1) return;
        statuses.delete(value);
      } else {
        statuses.add(value);
      }
      syncAndReload();
    });
  }

  const first = buttons[0];
  if (first?.parentNode && !first.closest(".repository-filters")) {
    const group = document.createElement("span");
    group.className = "control-cluster repository-filters";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Repositories");
    const label = document.createElement("span");
    label.className = "control-cluster-label";
    label.textContent = "Repositories";
    first.parentNode.insertBefore(group, first);
    group.append(label);
    for (const button of buttons) group.append(button);
  }

  updateControls();
  window.ProjectMapDedicatedViewState = Object.freeze({
    snapshot: () => ({
      statuses: STATUS_VALUES.filter((value) => statuses.has(value)),
      counts: { ...counts },
      graphLoaded,
    }),
  });
})();