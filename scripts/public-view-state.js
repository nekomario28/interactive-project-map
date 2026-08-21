"use strict";
/* global state, searchInput, rebuildLayout, updateDetails, draw, drawEdges, drawNodesAndLabels, hitTest, worldToScreen, nodeRadius, nodeStatus, ctx */

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
      const defaultStatuses = STATUS_VALUES.every((value) => statuses.has(value));
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
      for (const button of statusButtons) {
        const active = statuses.has(button.dataset.statusFilter);
        button.setAttribute("aria-pressed", String(active));
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
        const total = state.nodes.filter((node) => node?.type === "repository" && statusVisible(node)).length;
        resultCount.textContent = state.query ? `${visible} matches` : `${visible} repos`;
        resultCount.title = `${visible} visible of ${total} status-visible repositories`;
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

    if (typeof drawEdges === "function") {
      const baseDrawEdges = drawEdges;
      drawEdges = function statusFilteredDrawEdges(colors) {
        const allEdges = state.edges;
        const visibleIds = new Set(state.nodes.filter(statusVisible).map((node) => node.id));
        try {
          state.edges = allEdges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));
          baseDrawEdges(colors);
        } finally {
          state.edges = allEdges;
        }
      };
    }

    if (typeof drawNodesAndLabels === "function") {
      const baseDrawNodesAndLabels = drawNodesAndLabels;
      drawNodesAndLabels = function viewStateDrawNodesAndLabels(colors) {
        const allNodes = state.nodes;
        const visibleNodes = allNodes.filter(statusVisible);
        try {
          state.nodes = visibleNodes;
          if (activity) {
            const reference = Number.isFinite(Date.parse(state.graph?.generatedAt)) ? Date.parse(state.graph.generatedAt) : Date.now();
            for (const node of visibleNodes) {
              if (node.type !== "repository") continue;
              const updated = Date.parse(node.updatedAt);
              if (!Number.isFinite(updated)) continue;
              const ageDays = Math.max(0, (reference - updated) / 86_400_000);
              const alpha = ageDays <= 30 ? 0.30 : ageDays <= 180 ? 0.14 : 0.055;
              const point = worldToScreen(node.x, node.y);
              const radius = Math.max(4, nodeRadius(node) * state.zoom) + 7;
              ctx.save();
              ctx.globalAlpha = alpha;
              ctx.strokeStyle = colors.text;
              ctx.lineWidth = ageDays <= 30 ? 2 : 1.2;
              ctx.beginPath();
              ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }
          }
          baseDrawNodesAndLabels(colors);
        } finally {
          state.nodes = allNodes;
        }
      };
    }

    if (typeof hitTest === "function") {
      const baseHitTest = hitTest;
      hitTest = function statusFilteredHitTest(x, y) {
        const allNodes = state.nodes;
        try {
          state.nodes = allNodes.filter(statusVisible);
          return baseHitTest(x, y);
        } finally {
          state.nodes = allNodes;
        }
      };
    }

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
        if (!STATUS_VALUES.includes(value)) return;
        if (statuses.has(value)) {
          if (statuses.size === 1) return;
          statuses.delete(value);
        } else {
          statuses.add(value);
        }
        const root = state.graph?.nodes?.find((node) => node.id === focusRoot);
        if (root && !statusVisible(root)) focusRoot = "";
        if (state.selected && !statusVisible(state.selected) && typeof updateDetails === "function") updateDetails(null);
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
      searchInput.addEventListener("keydown", (event) => {
        if (!state.query || !["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) return;
        const ids = window.ProjectMapSearchContext?.directRepositories?.() || [];
        const hits = ids.map((id) => state.byId.get(id)).filter((node) => node && statusVisible(node));
        if (!hits.length) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const current = hits.findIndex((node) => node.id === state.selected?.id);
        const step = event.key === "ArrowUp" ? -1 : 1;
        const index = event.key === "Enter"
          ? (current >= 0 ? current : 0)
          : current < 0 ? (step > 0 ? 0 : hits.length - 1) : (current + step + hits.length) % hits.length;
        const target = hits[index];
        if (typeof updateDetails === "function") updateDetails(target);
        if (event.key === "Enter" && target.url) window.open(target.url, "_blank", "noopener");
      }, true);
    }

    syncUrl();
    updateControls();

    window.ProjectMapViewState = Object.freeze({
      motionOff,
      statusVisible,
      snapshot() {
        return {
          statuses: STATUS_VALUES.filter((value) => statuses.has(value)),
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
