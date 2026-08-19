"use strict";
/* global state, drawEdges, drawNodesAndLabels, worldToScreen, ctx, matchesQuery, displayLabel, subtitle */

window.addEventListener("DOMContentLoaded", () => {
  if (!window.GalaxyCommon || !["galaxy-systems", "galaxy-hybrid"].includes(state.style)) return;
  const { categoryForRepository, ownerNode } = window.GalaxyCommon;
  const baseDrawEdges = drawEdges;
  const baseDrawNodesAndLabels = drawNodesAndLabels;

  function isIncident(edge, node) {
    return Boolean(node && (edge.source === node.id || edge.target === node.id));
  }

  function belongsToCategory(node, category) {
    if (!node || !category || node.type !== "repository") return false;
    return categoryForRepository(state, node) === category;
  }

  function edgeOpacity(edge, a, b, focus) {
    const selected = Boolean(state.selected);
    const relation = edge.type === "relation";
    const ownership = edge.type === "ownership";
    const membership = edge.type === "membership" || edge.type === "member";

    if (!focus) return relation ? (state.style === "galaxy-hybrid" ? 0.12 : 0.16) : 0;

    if (focus.type === "repository") {
      const category = categoryForRepository(state, focus);
      const owner = ownerNode(state);
      const focusMembership = membership && ((a === focus && b === category) || (b === focus && a === category));
      const categoryOwnership = ownership && category && owner && ((a === category && b === owner) || (b === category && a === owner));
      if (focusMembership) return selected ? 0.95 : 0.55;
      if (categoryOwnership) return selected ? 0.65 : 0.30;
      if (relation && isIncident(edge, focus)) return selected ? 0.95 : 0.60;
      return relation ? (selected ? 0.025 : 0.05) : 0;
    }

    if (focus.type === "group") {
      if (ownership && isIncident(edge, focus)) return selected ? 0.75 : 0.48;
      if (membership && isIncident(edge, focus)) return selected ? 0.72 : 0.46;
      if (relation && (belongsToCategory(a, focus) || belongsToCategory(b, focus))) return selected ? 0.56 : 0.34;
      return relation ? (selected ? 0.025 : 0.05) : 0;
    }

    if (focus.type === "owner") {
      if (ownership && isIncident(edge, focus)) return selected ? 0.72 : 0.46;
      return relation ? (selected ? 0.04 : 0.08) : 0;
    }

    return 0;
  }

  drawEdges = function structuredGalaxyEdges(colors) {
    if (!["galaxy-systems", "galaxy-hybrid"].includes(state.style)) {
      baseDrawEdges(colors);
      return;
    }
    const focus = state.selected || state.hovered;
    for (const edge of state.edges) {
      const a = state.byId.get(edge.source);
      const b = state.byId.get(edge.target);
      if (!a || !b) continue;
      const relation = edge.type === "relation";
      let opacity = edgeOpacity(edge, a, b, focus);
      if (state.query && !(matchesQuery(a) || matchesQuery(b))) opacity *= 0.18;
      if (opacity <= 0.001) continue;
      const source = worldToScreen(a.x, a.y);
      const target = worldToScreen(b.x, b.y);
      const incident = Boolean(focus && isIncident(edge, focus));
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = relation ? colors.relation : colors.edge;
      ctx.lineWidth = relation ? (incident && state.selected ? 2.5 : 1.35) : (incident && state.selected ? 1.8 : 1.0);
      ctx.setLineDash(relation ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  };

  function systemsLabelMode() {
    if (state.style !== "galaxy-systems") return "all";
    const firstOrbitRadiusPx = 54 * state.zoom;
    if (firstOrbitRadiusPx < 42) return "categories";
    if (firstOrbitRadiusPx < 68) return "featured";
    return "all";
  }

  function featuredRepositories() {
    const byCategory = new Map();
    for (const node of state.nodes) {
      if (node.type !== "repository") continue;
      const key = node.groupId || "";
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key).push(node);
    }
    const featured = new Set();
    for (const repositories of byCategory.values()) {
      repositories.sort((a, b) =>
        (b.stars || 0) - (a.stars || 0) ||
        Number(a.fork === true) - Number(b.fork === true) ||
        String(a.label).localeCompare(String(b.label)));
      for (const repository of repositories.slice(0, 2)) featured.add(repository.id);
    }
    return featured;
  }

  function visibleRepositoryIds() {
    const mode = systemsLabelMode();
    const visible = new Set();
    const featured = mode === "featured" ? featuredRepositories() : null;
    for (const node of state.nodes) {
      if (node.type !== "repository") continue;
      if (node === state.selected || node === state.hovered) {
        visible.add(node.id);
        continue;
      }
      if (state.query && matchesQuery(node)) {
        visible.add(node.id);
        continue;
      }
      if (mode === "all" || (mode === "featured" && featured.has(node.id))) visible.add(node.id);
    }
    return visible;
  }

  drawNodesAndLabels = function galaxySystemsLabelLod(colors) {
    if (state.style !== "galaxy-systems") {
      baseDrawNodesAndLabels(colors);
      return;
    }

    const visible = visibleRepositoryIds();
    const visibleRepoLabels = new Set();
    const hiddenRepoLabels = new Set();
    const protectedLabels = new Set();
    for (const node of state.nodes) {
      const label = displayLabel(node);
      if (node.type !== "repository") protectedLabels.add(label);
      else if (visible.has(node.id)) visibleRepoLabels.add(label);
      else hiddenRepoLabels.add(label);
    }

    const shouldSuppress = (text) => {
      const label = String(text || "");
      return hiddenRepoLabels.has(label) && !visibleRepoLabels.has(label) && !protectedLabels.has(label);
    };
    const originalFillText = ctx.fillText;
    const originalStrokeText = ctx.strokeText;
    ctx.fillText = function lodFillText(text, ...args) {
      if (!shouldSuppress(text)) return originalFillText.call(this, text, ...args);
      return undefined;
    };
    ctx.strokeText = function lodStrokeText(text, ...args) {
      if (!shouldSuppress(text)) return originalStrokeText.call(this, text, ...args);
      return undefined;
    };
    try {
      baseDrawNodesAndLabels(colors);
    } finally {
      ctx.fillText = originalFillText;
      ctx.strokeText = originalStrokeText;
    }
  };

  window.GalaxySystemsLabelLOD = {
    mode: systemsLabelMode,
    visibleRepositoryIds: () => [...visibleRepositoryIds()],
  };

  if (state.style === "galaxy-systems" && subtitle) {
    subtitle.textContent = "Galaxy Systems · categories first · zoom in to reveal repositories";
  }
});
