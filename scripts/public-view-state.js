"use strict";
/* global state, searchInput, rebuildLayout, updateDetails, draw, nodeStatus */

(() => {
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
  const STATUS_VALUES = ["original", "fork", "archived"];
  const nativeMatchMedia = typeof window.matchMedia === "function" ? window.matchMedia.bind(window) : null;
  const initialParams = new URL(location.href).searchParams;
  let userMotionOff = initialParams.get("motion") === "off";

  function nativeReducedMotion() {
    return Boolean(nativeMatchMedia?.(REDUCED_MOTION_QUERY).matches);
  }

  function motionOff() {
    return userMotionOff || nativeReducedMotion();
  }

  // Existing Galaxy and Obsidian runtimes already honor this media query.
  // Extend that contract instead of adding a second animation controller.
  if (nativeMatchMedia) {
    window.matchMedia = function projectMapMatchMedia(query) {
      const media = nativeMatchMedia(query);
      if (query !== REDUCED_MOTION_QUERY) return media;
      return new Proxy(media, {
        get(target, property) {
          if (property === "matches") return target.matches || userMotionOff;
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    };
  }

  function init() {
    if (typeof state === "undefined" || typeof rebuildLayout !== "function" || typeof draw !== "function") return;

    const statusButtons = [...document.querySelectorAll("[data-status-filter]")];
    const motionButton = document.getElementById("motionToggle");
    const activityButton = document.getElementById("activityToggle");
    const shareButton = document.getElementById("shareView");
    const focusButton = document.getElementById("focusButton");
    const focusControls = document.getElementById("focusControls");
    const focusLabel = document.getElementById("focusLabel");
    const focusDepthButtons = [...document.querySelectorAll("[data-focus-depth]")];
    const exitFocusButton = document.getElementById("exitFocus");
    const resultCount = document.getElementById("resultCount");
    if (!statusButtons.length || !motionButton || !activityButton || !shareButton) return;

    function groupControls(label, elements, className) {
      const first = elements.find(Boolean);
      if (!first?.parentNode) return null;
      const group = document.createElement("span");
      group.className = `control-cluster ${className}`;
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", label);
      const groupLabel = document.createElement("span");
      groupLabel.className = "control-cluster-label";
      groupLabel.textContent = label;
      first.parentNode.insertBefore(group, first);
      group.append(groupLabel);
      for (const element of elements) if (element) group.append(element);
      return group;
    }

    groupControls("Repositories", statusButtons, "repository-filters");
    groupControls("View", [motionButton, activityButton], "view-options");

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
    let activity = initialParams.get("activity") === "1";
    let focusRoot = String(initialParams.get("focus") || "").slice(0, 180);
    let focusDepth = Math.max(1, Math.min(3, Math.round(Number(initialParams.get("depth")) || 1)));
    const initialSearch = String(initialParams.get("q") || "").slice(0, 160);

    function repositoryStatus(node) {
      if (!node || node.type !== "repository") return null;
      return typeof nodeStatus === "function" ? nodeStatus(node) : node.archived ? "archived" : node.fork ? "fork" : "original";
    }

    function statusVisible(node) {
      const value = repositoryStatus(node);
      return !value || statuses.has(value);
    }

    function statusCounts() {
      const counts = { original: 0, fork: 0, archived: 0 };
      for (const node of state.graph?.nodes || []) {
        const value = repositoryStatus(node);
        if (value) counts[value] += 1;
      }
      return counts;
    }

    function normalizeStatuses(counts) {
      if (!state.graph) return;
      const available = STATUS_VALUES.filter((value) => counts[value] > 0);
      if (!available.length) return;
      for (const value of STATUS_VALUES) if (counts[value] === 0) statuses.delete(value);
      if (!available.some((value) => statuses.has(value))) {
        for (const value of available) statuses.add(value);
      }
    }

    function relationEdges(graph) {
      const repositoryIds = new Set((graph?.nodes || []).filter((node) => node?.type === "repository").map((node) => node.id));
      const result = [];
      for (const edge of Array.isArray(graph?.edges) ? graph.edges : []) {
        if (!["relation", "semantic"].includes(edge?.type)) continue;
        if (repositoryIds.has(edge.source) && repositoryIds.has(edge.target)) result.push(edge);
      }
      for (const edge of Array.isArray(graph?.semanticEdges) ? graph.semanticEdges : []) {
        if (repositoryIds.has(edge?.source) && repositoryIds.has(edge?.target)) result.push(edge);
      }
      return result;
    }

    // Local Graph depth counts repository-to-repository relations only.
    // Owner/category membership is restored after traversal as context.
    function focusedGraph(graph) {
      if (!focusRoot || !graph) return graph;
      const repositories = (graph.nodes || []).filter((node) => node?.type === "repository" && statusVisible(node));
      const allowed = new Set(repositories.map((node) => node.id));
      if (!allowed.has(focusRoot)) {
        focusRoot = "";
        return graph;
      }

      const adjacency = new Map([...allowed].map((id) => [id, new Set()]));
      for (const edge of relationEdges(graph)) {
        if (!allowed.has(edge.source) || !allowed.has(edge.target)) continue;
        adjacency.get(edge.source).add(edge.target);
        adjacency.get(edge.target).add(edge.source);
      }

      const repositoryIds = new Set([focusRoot]);
      const queue = [{ id: focusRoot, depth: 0 }];
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const current = queue[cursor];
        if (current.depth >= focusDepth) continue;
        for (const neighbor of adjacency.get(current.id) || []) {
          if (repositoryIds.has(neighbor)) continue;
          repositoryIds.add(neighbor);
          queue.push({ id: neighbor, depth: current.depth + 1 });
        }
      }

      const groupIds = new Set();
      for (const repo of repositories) {
        if (!repositoryIds.has(repo.id) || !repo.groupId) continue;
        const id = String(repo.groupId);
        groupIds.add(id.startsWith("group:") ? id : `group:${id}`);
      }
      for (const edge of Array.isArray(graph.edges) ? graph.edges : []) {
        if (edge?.type === "membership" && repositoryIds.has(edge.target)) groupIds.add(edge.source);
      }

      const nodeIds = new Set();
      const nodes = (graph.nodes || []).filter((node) => {
        const keep = node?.type === "owner"
          || (node?.type === "group" && groupIds.has(node.id))
          || (node?.type === "repository" && repositoryIds.has(node.id));
        if (keep) nodeIds.add(node.id);
        return keep;
      });
      const edges = (graph.edges || []).filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
      const semanticEdges = (graph.semanticEdges || []).filter((edge) => repositoryIds.has(edge.source) && repositoryIds.has(edge.target));
      return {
        ...graph,
        nodes,
        edges,
        semanticEdges,
        repositoryCount: repositoryIds.size,
        groupCount: groupIds.size,
      };
    }

    function syncUrl() {
      const url = new URL(location.href);
      const counts = statusCounts();
      const defaults = state.graph ? STATUS_VALUES.filter((value) => counts[value] > 0) : STATUS_VALUES;
      const defaultStatuses = defaults.length > 0 && defaults.every((value) => statuses.has(value)) && statuses.size === defaults.length;
      if (defaultStatuses) url.searchParams.delete("status");
      else url.searchParams.set("status", STATUS_VALUES.filter((value) => statuses.has(value)).join(","));
      if (userMotionOff) url.searchParams.set("motion", "off");
      else url.searchParams.delete("motion");
      if (activity) url.searchParams.set("activity", "1");
      else url.searchParams.delete("activity");
      if (focusRoot) {
        url.searchParams.set("focus", focusRoot);
        url.searchParams.set("depth", String(focusDepth));
      } else {
        url.searchParams.delete("focus");
        url.searchParams.delete("depth");
      }
      if (state.query) url.searchParams.set("q", state.query);
      else url.searchParams.delete("q");
      history.replaceState(null, "", url);
    }

    function visibleRepositories() {
      return state.nodes.filter((node) => {
        if (node?.type !== "repository" || !statusVisible(node)) return false;
        if (!state.query) return true;
        return window.ProjectMapSearchContext?.matches?.(node) ?? true;
      });
    }

    function updateControls() {
      const counts = statusCounts();
      normalizeStatuses(counts);
      for (const button of statusButtons) {
        const value = button.dataset.statusFilter;
        const count = counts[value] || 0;
        const active = statuses.has(value);
        const label = value === "original" ? "Original" : value === "fork" ? "Fork" : "Archived";
        button.classList.add("status-chip", `status-${value}`);
        button.dataset.statusCount = String(count);
        button.disabled = Boolean(state.graph) && count === 0;
        button.setAttribute("aria-pressed", String(active));
        button.setAttribute("aria-label", `${label} repositories: ${count}. ${count ? "Toggle visibility." : "None are available in this map."}`);
        button.textContent = `${label} ${count}`;
        button.title = count
          ? `${count} ${label.toLowerCase()} repositories in this map.`
          : `No ${label.toLowerCase()} repositories are available in this map. Regenerate with them enabled if they were excluded.`;
      }
      const effectiveMotionOff = motionOff();
      motionButton.setAttribute("aria-pressed", String(!effectiveMotionOff));
      motionButton.textContent = effectiveMotionOff ? "Motion Off" : "Motion On";
      motionButton.disabled = nativeReducedMotion();
      motionButton.title = nativeReducedMotion()
        ? "Motion is disabled by the operating-system reduced-motion preference."
        : "Toggle graph motion.";
      activityButton.setAttribute("aria-pressed", String(activity));

      if (focusControls) focusControls.hidden = !focusRoot;
      if (focusLabel) {
        const root = state.graph?.nodes?.find((node) => node.id === focusRoot);
        focusLabel.textContent = root ? `Focus: ${root.label}` : "Focus";
      }
      for (const button of focusDepthButtons) {
        button.setAttribute("aria-pressed", String(Number(button.dataset.focusDepth) === focusDepth));
      }
      if (resultCount) {
        const visible = visibleRepositories().length;
        const scopeTotal = state.nodes.filter((node) => node?.type === "repository").length;
        const statusVisibleCount = state.nodes.filter((node) => node?.type === "repository" && statusVisible(node)).length;
        resultCount.textContent = state.query ? `${visible} matches · ${statusVisibleCount}/${scopeTotal} repos` : `${statusVisibleCount} / ${scopeTotal} repos`;
        resultCount.title = `${statusVisibleCount} visible of ${scopeTotal} repositories in the current scope`;
      }
    }

    const baseRebuildLayout = rebuildLayout;
    rebuildLayout = function viewStateRebuildLayout(options) {
      const sourceGraph = state.graph;
      if (!sourceGraph) {
        baseRebuildLayout(options);
        return;
      }
      const projected = focusedGraph(sourceGraph);
      try {
        state.graph = projected;
        baseRebuildLayout(options);
      } finally {
        state.graph = sourceGraph;
      }
      updateControls();
    };

    if (typeof updateDetails === "function") {
      const baseUpdateDetails = updateDetails;
      updateDetails = function viewStateUpdateDetails(node) {
        baseUpdateDetails(node);
        if (!focusButton) return;
        const repository = node?.type === "repository" ? node : null;
        focusButton.hidden = !repository;
        if (!repository) return;
        focusButton.textContent = focusRoot === repository.id ? "Exit focus" : focusRoot ? "Focus here" : "Focus";
      };
    }

    function rebuildForFocus() {
      const selectedId = state.selected?.id || focusRoot;
      rebuildLayout({ fit: true });
      if (selectedId && typeof updateDetails === "function") updateDetails(state.byId.get(selectedId) || null);
      syncUrl();
      updateControls();
    }

    for (const button of statusButtons) {
      button.addEventListener("click", () => {
        const value = button.dataset.statusFilter;
        if (!STATUS_VALUES.includes(value) || button.disabled) return;
        if (statuses.has(value)) {
          if (statuses.size === 1) return;
          statuses.delete(value);
        } else {
          statuses.add(value);
        }
        const root = state.graph?.nodes?.find((node) => node.id === focusRoot);
        if (root && !statusVisible(root)) focusRoot = "";
        if (state.selected && !statusVisible(state.selected) && typeof updateDetails === "function") updateDetails(null);
        if (state.hovered && !statusVisible(state.hovered)) state.hovered = null;
        if (focusRoot) rebuildForFocus();
        else {
          syncUrl();
          updateControls();
          draw();
        }
      });
    }

    motionButton.addEventListener("click", () => {
      if (nativeReducedMotion()) return;
      userMotionOff = !userMotionOff;
      syncUrl();
      updateControls();
      draw();
    });

    activityButton.addEventListener("click", () => {
      activity = !activity;
      syncUrl();
      updateControls();
      draw();
    });

    shareButton.addEventListener("click", async () => {
      syncUrl();
      try {
        await navigator.clipboard.writeText(location.href);
        const previous = shareButton.textContent;
        shareButton.textContent = "Copied";
        setTimeout(() => { shareButton.textContent = previous; }, 1200);
      } catch {
        // The address bar already contains the complete shareable state.
      }
    });

    focusButton?.addEventListener("click", (event) => {
      event.preventDefault();
      const selected = state.selected;
      if (selected?.type !== "repository") return;
      focusRoot = focusRoot === selected.id ? "" : selected.id;
      rebuildForFocus();
    });

    for (const button of focusDepthButtons) {
      button.addEventListener("click", () => {
        const next = Math.max(1, Math.min(3, Number(button.dataset.focusDepth) || 1));
        if (!focusRoot || next === focusDepth) return;
        focusDepth = next;
        rebuildForFocus();
      });
    }

    exitFocusButton?.addEventListener("click", () => {
      if (!focusRoot) return;
      focusRoot = "";
      rebuildForFocus();
    });

    if (searchInput) {
      if (initialSearch) {
        searchInput.value = initialSearch;
        state.query = initialSearch.normalize("NFKC").toLocaleLowerCase("en-US").trim();
      }
      searchInput.addEventListener("input", () => {
        syncUrl();
        updateControls();
      });
    }

    syncUrl();
    updateControls();

    window.ProjectMapViewState = Object.freeze({
      motionOff,
      statusVisible,
      snapshot() {
        return {
          statuses: STATUS_VALUES.filter((value) => statuses.has(value)),
          statusCounts: statusCounts(),
          motionOff: motionOff(),
          activity,
          focusRoot: focusRoot || null,
          focusDepth,
          query: state.query,
        };
      },
    });
  }

  window.ProjectMapViewState = Object.freeze({ motionOff, snapshot: () => ({ motionOff: motionOff() }) });
  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();