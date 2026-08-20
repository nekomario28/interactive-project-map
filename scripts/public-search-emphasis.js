"use strict";
/* global state, ctx, draw, repoMatches, updateDetails, detailsMeta, worldToScreen, nodeRadius, screenBox, center, gridGeometry, statusOf, palette */

(() => {
  const style = document.body.dataset.mapStyle;
  const dedicatedStyles = new Set(["radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"]);
  if (!dedicatedStyles.has(style) || typeof state === "undefined" || typeof ctx === "undefined") return;

  function searchApi() {
    return window.ProjectMapSearchContext || null;
  }

  function directIds() {
    const snapshot = searchApi()?.snapshot?.();
    return new Set(Array.isArray(snapshot?.directRepositoryIds) ? snapshot.directRepositoryIds : []);
  }

  function isDirect(repo, ids) {
    return Boolean(repo?.id && ids.has(repo.id));
  }

  // Matrix and Sankey aggregate repositories instead of drawing repository nodes.
  // Reuse the shared search context instead of teaching each aggregate preset its
  // own alias/facet matcher.
  if (typeof repoMatches === "function") {
    const baseRepoMatches = repoMatches;
    repoMatches = function searchAwareAggregateRepoMatches(repo) {
      if (!state.query) return true;
      const api = searchApi();
      if (api?.matches?.(repo)) return true;
      return baseRepoMatches(repo);
    };
  }

  function aggregateTargetForRepo(repo) {
    if (!repo || repo.type !== "repository") return null;
    if (style === "matrix") {
      return Array.isArray(state.cells)
        ? state.cells.find((cell) => Array.isArray(cell?.repos) && cell.repos.some((item) => item.id === repo.id)) || null
        : null;
    }
    if (style === "sankey") {
      return Array.isArray(state.groups)
        ? state.groups.find((group) => Array.isArray(group?.members) && group.members.some((item) => item.id === repo.id)) || null
        : null;
    }
    return null;
  }

  function appendAggregateMatchReason(repo) {
    const reasons = searchApi()?.reasons?.(repo) || [];
    if (!reasons.length || typeof detailsMeta === "undefined" || !detailsMeta) return;
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = "Match";
    dd.textContent = reasons.join(" · ");
    detailsMeta.append(dt, dd);
    detailsMeta.hidden = false;
  }

  // #63 keyboard navigation selects repositories. Aggregate presets select cells
  // or group bars, so bridge repository selection to the containing aggregate
  // while retaining the repository id in state.selected for ArrowUp/ArrowDown.
  if ((style === "matrix" || style === "sankey") && typeof updateDetails === "function") {
    const baseAggregateUpdateDetails = updateDetails;
    updateDetails = function aggregateAwareUpdateDetails(node) {
      if (node?.type === "repository") {
        const target = aggregateTargetForRepo(node);
        if (!target) return baseAggregateUpdateDetails(null);
        baseAggregateUpdateDetails(target);
        appendAggregateMatchReason(node);
        state.selected = node;
        if (typeof draw === "function") draw();
        return;
      }
      return baseAggregateUpdateDetails(node);
    };
  }

  function accentColor() {
    try {
      if (typeof palette === "function") {
        const colors = palette();
        return colors.owner || colors.heat || colors.group || colors.selection || "#64d2ff";
      }
    } catch {
      // Fall through to the shared accent.
    }
    return "#64d2ff";
  }

  function strokeCircle(point, radius, color) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.globalAlpha = 0.96;
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }

  function strokeRect(x, y, width, height, color) {
    if (!(width > 2 && height > 2)) return false;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.24;
    ctx.lineWidth = 6;
    ctx.strokeRect(x, y, width, height);
    ctx.globalAlpha = 0.96;
    ctx.lineWidth = 2.2;
    ctx.strokeRect(x, y, width, height);
    return true;
  }

  function focused(id) {
    return state.selected?.id === id || state.hovered?.id === id;
  }

  function pointTargetCount(ids) {
    return Array.isArray(state.nodes) ? state.nodes.filter((node) => isDirect(node, ids)).length : 0;
  }

  function treemapTargetCount(ids) {
    return Array.isArray(state.repos) ? state.repos.filter((repo) => isDirect(repo, ids)).length : 0;
  }

  function sunburstTargetCount(ids) {
    return Array.isArray(state.segments) ? state.segments.filter((repo) => isDirect(repo, ids)).length : 0;
  }

  function matrixTargetCount(ids) {
    return Array.isArray(state.cells)
      ? state.cells.filter((cell) => Array.isArray(cell?.repos) && cell.repos.some((repo) => isDirect(repo, ids))).length
      : 0;
  }

  function sankeyTargetCount(ids) {
    if (!Array.isArray(state.groups)) return 0;
    const groups = state.groups.filter((group) => Array.isArray(group?.members) && group.members.some((repo) => isDirect(repo, ids)));
    const statuses = new Set();
    if (typeof statusOf === "function") {
      for (const group of groups) {
        for (const repo of group.members) if (isDirect(repo, ids)) statuses.add(statusOf(repo));
      }
    }
    const statusTargets = Array.isArray(state.statuses) ? state.statuses.filter((node) => statuses.has(node.status)).length : 0;
    return groups.length + statusTargets;
  }

  function targetCount(ids) {
    if (!ids.size) return 0;
    if (["tree", "radial", "cluster", "timeline"].includes(style)) return pointTargetCount(ids);
    if (style === "treemap") return treemapTargetCount(ids);
    if (style === "sunburst") return sunburstTargetCount(ids);
    if (style === "matrix") return matrixTargetCount(ids);
    if (style === "sankey") return sankeyTargetCount(ids);
    return 0;
  }

  function drawPointTargets(ids, color) {
    if (!Array.isArray(state.nodes) || typeof worldToScreen !== "function") return 0;
    let drawn = 0;
    for (const node of state.nodes) {
      if (!isDirect(node, ids) || focused(node.id)) continue;
      const point = worldToScreen(node.x, node.y);
      let radius = 7;
      if (style === "timeline") radius = 7;
      else if (Number.isFinite(node.radius)) radius = Math.max(3.5, node.radius * state.zoom);
      else if (typeof nodeRadius === "function") radius = Math.max(3.5, nodeRadius(node) * state.zoom);
      strokeCircle(point, radius + 5, color);
      drawn += 1;
    }
    return drawn;
  }

  function drawTreemapTargets(ids, color) {
    if (!Array.isArray(state.repos) || typeof screenBox !== "function") return 0;
    let drawn = 0;
    for (const repo of state.repos) {
      if (!isDirect(repo, ids) || focused(repo.id)) continue;
      const box = screenBox(repo.box);
      if (strokeRect(box.x + 4, box.y + 4, box.width - 8, box.height - 8, color)) drawn += 1;
    }
    return drawn;
  }

  function drawSunburstTargets(ids, color) {
    if (!Array.isArray(state.segments) || typeof center !== "function") return 0;
    const origin = center();
    const outer = 170 * state.zoom;
    const inner = 102 * state.zoom;
    let drawn = 0;
    for (const repo of state.segments) {
      if (!isDirect(repo, ids) || focused(repo.id)) continue;
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, outer - 2, repo.start + 0.007, repo.end - 0.007);
      ctx.arc(origin.x, origin.y, inner + 2, repo.end - 0.007, repo.start + 0.007, true);
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.24;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.globalAlpha = 0.96;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      drawn += 1;
    }
    return drawn;
  }

  function drawMatrixTargets(ids, color) {
    if (!Array.isArray(state.cells) || typeof gridGeometry !== "function" || typeof worldToScreen !== "function") return 0;
    const geometry = gridGeometry();
    let drawn = 0;
    for (const cell of state.cells) {
      const directCount = Array.isArray(cell?.repos) ? cell.repos.filter((repo) => isDirect(repo, ids)).length : 0;
      if (!directCount) continue;
      const point = worldToScreen(
        geometry.left + cell.columnIndex * geometry.colW,
        geometry.top + cell.rowIndex * geometry.rowH,
      );
      const width = geometry.colW * state.zoom;
      const height = geometry.rowH * state.zoom;
      if (!strokeRect(point.x + 5, point.y + 5, width - 10, height - 10, color)) continue;
      if (width >= 52 && height >= 34) {
        ctx.globalAlpha = 0.96;
        ctx.fillStyle = color;
        ctx.font = `700 ${Math.max(8, Math.min(11, 9.5 * Math.sqrt(state.zoom)))}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.fillText(`● ${directCount}`, point.x + width - 8, point.y + 7);
      }
      drawn += 1;
    }
    return drawn;
  }

  function drawSankeyTargets(ids, color) {
    if (!Array.isArray(state.groups) || typeof worldToScreen !== "function") return 0;
    let drawn = 0;
    const directStatuses = new Set();
    for (const group of state.groups) {
      const directMembers = Array.isArray(group?.members) ? group.members.filter((repo) => isDirect(repo, ids)) : [];
      if (!directMembers.length) continue;
      const point = worldToScreen(group.x, group.y);
      if (strokeRect(point.x - 4, point.y - 4, group.w * state.zoom + 8, group.h * state.zoom + 8, color)) drawn += 1;
      if (typeof statusOf === "function") for (const repo of directMembers) directStatuses.add(statusOf(repo));
    }
    for (const node of Array.isArray(state.statuses) ? state.statuses : []) {
      if (!directStatuses.has(node.status)) continue;
      const point = worldToScreen(node.x, node.y);
      if (strokeRect(point.x - 4, point.y - 4, node.w * state.zoom + 8, node.h * state.zoom + 8, color)) drawn += 1;
    }
    return drawn;
  }

  let renderedTargetCount = 0;

  function drawDirectSearchEmphasis() {
    renderedTargetCount = 0;
    if (!state.query || !state.graph) return;
    const ids = directIds();
    if (!ids.size) return;
    const color = accentColor();
    ctx.save();
    try {
      ctx.setLineDash([]);
      ctx.lineJoin = "round";
      if (["tree", "radial", "cluster", "timeline"].includes(style)) renderedTargetCount = drawPointTargets(ids, color);
      else if (style === "treemap") renderedTargetCount = drawTreemapTargets(ids, color);
      else if (style === "sunburst") renderedTargetCount = drawSunburstTargets(ids, color);
      else if (style === "matrix") renderedTargetCount = drawMatrixTargets(ids, color);
      else if (style === "sankey") renderedTargetCount = drawSankeyTargets(ids, color);
    } finally {
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  if (typeof draw === "function" && draw.searchEmphasisLayer !== true) {
    const baseDraw = draw;
    const searchEmphasisDraw = function searchEmphasisDraw(...args) {
      const result = baseDraw(...args);
      drawDirectSearchEmphasis();
      return result;
    };
    searchEmphasisDraw.searchEmphasisLayer = true;
    draw = searchEmphasisDraw;
  }

  window.ProjectMapSearchVisualEmphasis = {
    snapshot() {
      const ids = directIds();
      return {
        style,
        directRepositoryIds: [...ids].sort(),
        targetCount: targetCount(ids),
        renderedTargetCount,
      };
    },
  };
})();
