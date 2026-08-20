"use strict";
/* global canvas, state, drawRepoLabels, matches, ctx, clamp, hitTest, updateDetails, sanitizeGraph, rebuildLayout, buildObsidianLayout, drawEdges, worldToScreen, matchesQuery, draw */

(() => {
  const style = document.body.dataset.mapStyle;

  if (style === "sunburst" && typeof drawRepoLabels === "function") {
    drawRepoLabels = function readableRadialRepoLabels(colors, origin, outer, repoInner) {
      const labelRadius = repoInner + (outer - repoInner) * 0.53;
      for (const repo of state.segments) {
        const highlighted = repo === state.selected || repo === state.hovered;
        const span = Math.max(0.001, repo.end - repo.start);
        const mid = (repo.start + repo.end) / 2;
        const x = origin.x + Math.cos(mid) * labelRadius;
        const y = origin.y + Math.sin(mid) * labelRadius;
        const arcRoom = Math.max(5.8, labelRadius * span * 0.82);
        const radialRoom = Math.max(30, outer - repoInner - 10);
        const lengthFit = radialRoom / Math.max(1, repo.label.length * 0.56);
        const fontSize = clamp(Math.min(highlighted ? 11.8 : 10.4, arcRoom, Math.max(7.1, lengthFit)), 7.1, 12.2);
        const flipped = Math.cos(mid) < 0;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(flipped ? mid + Math.PI : mid);
        ctx.globalAlpha = matches(repo) ? (highlighted ? 1 : 0.96) : 0.12;
        ctx.font = `${highlighted ? 750 : 650} ${fontSize}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.lineWidth = highlighted ? 3.4 : 2.7;
        ctx.strokeStyle = colors.background;
        ctx.strokeText(repo.label, 0, 0);
        ctx.fillStyle = colors.text;
        ctx.fillText(repo.label, 0, 0);
        ctx.restore();
      }
    };
  }

  if (typeof canvas === "undefined" || typeof state === "undefined") return;

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function isGalaxyPresentationStyle(value) {
    return value === "galaxy" || String(value || "").startsWith("galaxy-");
  }

  function isExploratoryStyle(value) {
    return value === "obsidian" || isGalaxyPresentationStyle(value);
  }

  if (isExploratoryStyle(state.style)
    && typeof sanitizeGraph === "function"
    && typeof rebuildLayout === "function"
    && typeof drawEdges === "function"
    && typeof worldToScreen === "function") {
    const baseSanitizeGraph = sanitizeGraph;
    sanitizeGraph = function semanticAwareSanitizeGraph(value) {
      const safe = baseSanitizeGraph(value);
      if (!safe || !Array.isArray(value?.semanticEdges)) return safe;
      const repositoryIds = new Set(safe.nodes.filter((node) => node.type === "repository").map((node) => node.id));
      const deduped = new Map();
      for (const raw of value.semanticEdges.slice(0, 2400)) {
        if (!raw || typeof raw !== "object" || raw.type !== "semantic") continue;
        const source = typeof raw.source === "string" ? raw.source.slice(0, 220) : "";
        const target = typeof raw.target === "string" ? raw.target.slice(0, 220) : "";
        const score = Number(raw.score);
        if (!source || !target || source === target || !repositoryIds.has(source) || !repositoryIds.has(target)) continue;
        if (!Number.isFinite(score) || score < 0 || score > 1) continue;
        const left = source < target ? source : target;
        const right = source < target ? target : source;
        const key = `${left}\u0000${right}`;
        const edge = { source: left, target: right, type: "semantic", score: Math.round(score * 1_000_000) / 1_000_000 };
        const existing = deduped.get(key);
        if (!existing || edge.score > existing.score) deduped.set(key, edge);
      }
      const semanticEdges = [...deduped.values()]
        .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source) || a.target.localeCompare(b.target))
        .slice(0, 1200);
      if (semanticEdges.length) safe.semanticEdges = semanticEdges;
      return safe;
    };

    if (typeof buildObsidianLayout === "function") {
      const baseBuildObsidianLayout = buildObsidianLayout;
      buildObsidianLayout = function semanticAwareObsidianLayout(graph) {
        if (!Array.isArray(graph?.semanticEdges) || !graph.semanticEdges.length) return baseBuildObsidianLayout(graph);
        const semanticRelations = graph.semanticEdges.map((edge) => ({ source: edge.source, target: edge.target, type: "relation" }));
        return baseBuildObsidianLayout({ ...graph, edges: [...graph.edges, ...semanticRelations] });
      };
    }

    const baseRebuildLayout = rebuildLayout;
    rebuildLayout = function semanticAwareRebuildLayout(options) {
      baseRebuildLayout(options);
      if (Array.isArray(state.graph?.semanticEdges) && state.graph.semanticEdges.length) {
        state.edges = [...state.graph.edges, ...state.graph.semanticEdges];
        if (typeof draw === "function") draw();
      }
    };

    function installSemanticDrawLayer() {
      if (drawEdges?.semanticLayer === true) return;
      const baseDrawEdges = drawEdges;
      const semanticAwareDrawEdges = function semanticAwareDrawEdges(colors) {
        const allEdges = state.edges;
        const semanticEdges = Array.isArray(allEdges) ? allEdges.filter((edge) => edge.type === "semantic") : [];
        if (!semanticEdges.length) {
          baseDrawEdges(colors);
          return;
        }

        try {
          state.edges = allEdges.filter((edge) => edge.type !== "semantic");
          baseDrawEdges(colors);
        } finally {
          state.edges = allEdges;
        }

        const focus = state.selected || state.hovered;
        for (const edge of semanticEdges) {
          const a = state.byId.get(edge.source);
          const b = state.byId.get(edge.target);
          if (!a || !b) continue;
          const incident = Boolean(focus && (a === focus || b === focus));
          const score = Number.isFinite(edge.score) ? Math.max(0, Math.min(1, edge.score)) : 0;
          let opacity = state.style === "obsidian" ? 0.22 + score * 0.22 : 0.035 + score * 0.085;
          if (focus) opacity = incident ? (state.selected ? 0.94 : 0.62) : (state.selected ? 0.018 : 0.035);
          if (state.query && typeof matchesQuery === "function" && !(matchesQuery(a) || matchesQuery(b))) opacity *= 0.16;
          if (opacity <= 0.001) continue;
          const source = worldToScreen(a.x, a.y);
          const target = worldToScreen(b.x, b.y);
          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.strokeStyle = colors.relation || colors.edge;
          ctx.lineWidth = incident && state.selected ? 2.4 : state.style === "obsidian" ? 1.35 : 1.15;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
          ctx.restore();
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      };
      semanticAwareDrawEdges.semanticLayer = true;
      drawEdges = semanticAwareDrawEdges;
    }

    if (document.readyState === "loading") {
      // Galaxy Systems/Hybrid install their structural edge policy on
      // DOMContentLoaded. Register later so semantic drawing wraps that final policy.
      window.addEventListener("DOMContentLoaded", installSemanticDrawLayer, { once: true });
    } else {
      installSemanticDrawLayer();
    }

    window.ProjectMapSemanticEdges = {
      count: () => Array.isArray(state.graph?.semanticEdges) ? state.graph.semanticEdges.length : 0,
      edges: () => Array.isArray(state.graph?.semanticEdges) ? state.graph.semanticEdges.map((edge) => ({ ...edge })) : [],
    };
  }

  const blankPointers = new Map();
  if (typeof hitTest === "function" && typeof updateDetails === "function") {
    canvas.addEventListener("pointerdown", (event) => {
      const point = canvasPoint(event);
      blankPointers.set(event.pointerId, {
        start: point,
        moved: false,
        blank: !hitTest(point.x, point.y),
      });
    }, true);

    canvas.addEventListener("pointermove", (event) => {
      const gesture = blankPointers.get(event.pointerId);
      if (!gesture || gesture.moved) return;
      const point = canvasPoint(event);
      if (Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) >= 6) gesture.moved = true;
    }, true);

    canvas.addEventListener("pointerup", (event) => {
      const gesture = blankPointers.get(event.pointerId);
      blankPointers.delete(event.pointerId);
      if (!gesture || gesture.moved || !gesture.blank) return;
      const point = canvasPoint(event);
      if (!hitTest(point.x, point.y)) updateDetails(null);
    }, true);

    canvas.addEventListener("pointercancel", (event) => blankPointers.delete(event.pointerId), true);
    canvas.addEventListener("lostpointercapture", (event) => blankPointers.delete(event.pointerId), true);
  }

  canvas.addEventListener("pointermove", (event) => {
    if (!isGalaxyPresentationStyle(state.style) || state.pointers.size !== 1 || !state.drag || !state.pointers.has(event.pointerId)) return;
    const point = canvasPoint(event);
    state.pointers.set(event.pointerId, point);
    const distance = Math.hypot(point.x - state.down.x, point.y - state.down.y);
    if (distance < 6) {
      event.stopImmediatePropagation();
      return;
    }
    state.moved = true;
    state.drag = null;
    state.panning = true;
    state.last = state.down;
  }, true);
})();
