"use strict";
/* global state, nodeOpacity, drawEdges */

(() => {
  const baseNodeOpacity = nodeOpacity;
  const baseDrawEdges = drawEdges;

  function activeHoverFocus() {
    if (state.style !== "obsidian" || state.selected || !state.hovered) return null;
    return state.hovered;
  }

  function withHoverAsSelection(callback) {
    const focus = activeHoverFocus();
    if (!focus) return callback(null);
    const selected = state.selected;
    state.selected = focus;
    try {
      return callback(focus);
    } finally {
      state.selected = selected;
    }
  }

  nodeOpacity = function obsidianHoverNodeOpacity(node) {
    if (!activeHoverFocus()) return baseNodeOpacity(node);
    return withHoverAsSelection(() => baseNodeOpacity(node));
  };

  drawEdges = function obsidianHoverDrawEdges(colors) {
    if (!activeHoverFocus()) {
      baseDrawEdges(colors);
      return;
    }
    withHoverAsSelection(() => baseDrawEdges(colors));
  };

  function neighborIds(focus) {
    if (!focus || !Array.isArray(state.edges)) return [];
    const ids = new Set();
    for (const edge of state.edges) {
      if (edge.source === focus.id) ids.add(edge.target);
      else if (edge.target === focus.id) ids.add(edge.source);
    }
    ids.delete(focus.id);
    return [...ids].sort();
  }

  window.ProjectMapObsidianHover = Object.freeze({
    snapshot() {
      const focus = activeHoverFocus();
      return {
        active: Boolean(focus),
        focusId: focus?.id || null,
        neighborIds: neighborIds(focus),
        selectedId: state.selected?.id || null,
      };
    },
  });
})();
