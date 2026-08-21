"use strict";
/* global state, rebuildLayout, draw, worldToScreen, nodeRadius, palette, ctx */

(() => {
  const visibleStyles = new Set(["radial", "galaxy-classic", "galaxy-systems", "galaxy-hybrid", "obsidian", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"]);
  const dedicatedStyles = new Set(["radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"]);
  const statusValues = ["original", "fork", "archived"];
  const styleSelect = document.getElementById("style");
  const currentUrl = new URL(location.href);
  const params = currentUrl.searchParams;

  function normalize(style) {
    if (style === "galaxy") return "galaxy-systems";
    return visibleStyles.has(style) ? style : "galaxy-systems";
  }

  function styleUrl(style, username) {
    const normalized = normalize(style);
    const route = dedicatedStyles.has(normalized) ? `../${normalized}/` : "../u/";
    const url = new URL(route, location.href);
    for (const [key, value] of currentUrl.searchParams) {
      if (key === "style" || key === "username") continue;
      url.searchParams.append(key, value);
    }
    if (username) url.searchParams.set("username", username);
    url.searchParams.set("style", normalized);
    return url;
  }

  const rawRequested = params.get("style");
  const requested = normalize(rawRequested);
  if (rawRequested === "galaxy" || dedicatedStyles.has(requested)) {
    location.replace(styleUrl(requested, params.get("username")).toString());
    return;
  }

  if (styleSelect) {
    styleSelect.addEventListener("change", (event) => {
      const style = normalize(styleSelect.value);
      if (!visibleStyles.has(style) || style === requested) return;
      event.stopImmediatePropagation();
      location.assign(styleUrl(style, params.get("username")).toString());
    }, true);
  }

  // Install before the later Galaxy/Obsidian and view-state DOMContentLoaded
  // handlers. This leaves Focus as the outer projection, then applies repository
  // status before the existing layout, while Activity is painted after every
  // runtime-specific draw. No renderer needs its own filter/overlay branch.
  window.addEventListener("DOMContentLoaded", () => {
    if (typeof state === "undefined" || typeof rebuildLayout !== "function" || typeof draw !== "function") return;
    if (typeof worldToScreen !== "function" || typeof nodeRadius !== "function" || typeof ctx === "undefined") return;

    const baseRebuildLayout = rebuildLayout;
    const baseDraw = draw;
    let rebuilding = false;
    let lastStatusKey = "";
    let lastActivityOverlayCount = 0;

    function viewSnapshot() {
      const value = window.ProjectMapViewState?.snapshot?.();
      return value && typeof value === "object"
        ? value
        : { statuses: statusValues, activity: false };
    }

    function repositoryStatus(node) {
      if (!node || node.type !== "repository") return null;
      if (node.archived === true) return "archived";
      return node.fork === true ? "fork" : "original";
    }

    function statusKey() {
      const statuses = Array.isArray(viewSnapshot().statuses) ? viewSnapshot().statuses : statusValues;
      return statusValues.filter((value) => statuses.includes(value)).join(",");
    }

    function projectStatuses(graph) {
      const active = new Set(Array.isArray(viewSnapshot().statuses) ? viewSnapshot().statuses : statusValues);
      const repositoryIds = new Set();
      for (const node of graph?.nodes || []) {
        const status = repositoryStatus(node);
        if (status && active.has(status)) repositoryIds.add(node.id);
      }

      const groupIds = new Set();
      for (const node of graph?.nodes || []) {
        if (node?.type !== "repository" || !repositoryIds.has(node.id) || !node.groupId) continue;
        const groupId = String(node.groupId);
        groupIds.add(groupId.startsWith("group:") ? groupId : `group:${groupId}`);
      }
      for (const edge of Array.isArray(graph?.edges) ? graph.edges : []) {
        if (edge?.type !== "membership") continue;
        if (repositoryIds.has(edge.target)) groupIds.add(edge.source);
        if (repositoryIds.has(edge.source)) groupIds.add(edge.target);
      }

      const nodeIds = new Set();
      const nodes = (graph?.nodes || []).filter((node) => {
        const keep = node?.type === "owner"
          || (node?.type === "group" && groupIds.has(node.id))
          || (node?.type === "repository" && repositoryIds.has(node.id));
        if (keep) nodeIds.add(node.id);
        return keep;
      });
      const edges = (graph?.edges || []).filter((edge) => nodeIds.has(edge?.source) && nodeIds.has(edge?.target));
      const semanticEdges = Array.isArray(graph?.semanticEdges)
        ? graph.semanticEdges.filter((edge) => repositoryIds.has(edge?.source) && repositoryIds.has(edge?.target))
        : graph?.semanticEdges;

      return {
        ...graph,
        nodes,
        edges,
        ...(Array.isArray(semanticEdges) ? { semanticEdges } : {}),
        repositoryCount: repositoryIds.size,
        groupCount: groupIds.size,
      };
    }

    rebuildLayout = function statusProjectedRebuildLayout(options) {
      if (!state.graph) {
        baseRebuildLayout(options);
        return;
      }
      const sourceGraph = state.graph;
      const projected = projectStatuses(sourceGraph);
      rebuilding = true;
      lastStatusKey = statusKey();
      try {
        state.graph = projected;
        baseRebuildLayout(options);
      } finally {
        state.graph = sourceGraph;
        rebuilding = false;
      }
    };

    function drawActivityOverlay() {
      lastActivityOverlayCount = 0;
      if (!viewSnapshot().activity || !state.nodes?.length) return;
      const generatedAt = Date.parse(state.graph?.generatedAt);
      const reference = Number.isFinite(generatedAt) ? generatedAt : Date.now();
      const colors = typeof palette === "function" ? palette() : { text: "#ffffff" };

      ctx.save();
      for (const node of state.nodes) {
        if (node?.type !== "repository") continue;
        const updatedAt = Date.parse(node.updatedAt);
        if (!Number.isFinite(updatedAt)) continue;
        const ageDays = Math.max(0, (reference - updatedAt) / 86_400_000);
        const point = worldToScreen(node.x, node.y);
        const radius = Math.max(4, nodeRadius(node) * state.zoom) + 8;
        ctx.strokeStyle = colors.text;
        ctx.globalAlpha = ageDays <= 30 ? 0.9 : ageDays <= 180 ? 0.52 : 0.28;
        ctx.lineWidth = ageDays <= 30 ? 2.6 : ageDays <= 180 ? 1.8 : 1.2;
        ctx.setLineDash(ageDays > 180 ? [2, 3] : []);
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        lastActivityOverlayCount += 1;
      }
      ctx.restore();
    }

    draw = function projectedDraw(...args) {
      const nextStatusKey = statusKey();
      if (!rebuilding && state.graph && nextStatusKey !== lastStatusKey) {
        lastStatusKey = nextStatusKey;
        rebuildLayout({ fit: false });
        return;
      }
      baseDraw(...args);
      drawActivityOverlay();
    };

    lastStatusKey = statusKey();
    window.ProjectMapRenderProjection = Object.freeze({
      snapshot() {
        return {
          statuses: lastStatusKey ? lastStatusKey.split(",") : [],
          repositories: state.nodes?.filter((node) => node?.type === "repository").map((node) => node.id) || [],
          activityOverlayCount: lastActivityOverlayCount,
        };
      },
    });
  }, { once: true });
})();
