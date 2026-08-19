"use strict";
/* global state, drawEdges, worldToScreen, ctx, matchesQuery */

window.addEventListener("DOMContentLoaded", () => {
  if (!window.GalaxyCommon || !["galaxy-systems", "galaxy-hybrid"].includes(state.style)) return;
  const { categoryForRepository, ownerNode } = window.GalaxyCommon;
  const baseDrawEdges = drawEdges;

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
});
