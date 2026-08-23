"use strict";
/* global state, palette, drawEdges, drawNodesAndLabels, nodeRadius, worldToScreen, ctx, draw, fitView, matchesQuery */

window.addEventListener("DOMContentLoaded", () => {
  const CONTRIBUTED = "#E69F00";
  const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  const TAU = Math.PI * 2;
  const runtime = {
    nodesRef: null,
    style: null,
    owner: null,
    targets: [],
    lastTime: performance.now(),
  };

  function hashText(text) {
    let value = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      value ^= text.charCodeAt(index);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }

  function isGalaxyStyle() {
    return typeof state !== "undefined" && ["galaxy-classic", "galaxy-systems", "galaxy-hybrid"].includes(state.style);
  }

  function isContributed(node) {
    return node?.type === "repository" && node?.relation === "contributed";
  }

  if (typeof palette === "function") {
    const basePalette = palette;
    palette = function contributedEmphasisPalette(...args) {
      return { ...basePalette(...args), contributed: CONTRIBUTED };
    };
  }

  if (typeof drawEdges === "function") {
    const baseDrawEdges = drawEdges;
    drawEdges = function contributedEmphasisEdges(colors) {
      if (!isGalaxyStyle() || !Array.isArray(state.edges)) return baseDrawEdges(colors);
      const originalEdges = state.edges;
      const contributionEdges = originalEdges.filter((edge) => edge?.type === "contribution");
      if (!contributionEdges.length) return baseDrawEdges(colors);
      state.edges = originalEdges.filter((edge) => edge?.type !== "contribution");
      try {
        baseDrawEdges(colors);
      } finally {
        state.edges = originalEdges;
      }
      ctx.save();
      ctx.strokeStyle = colors.contributed || CONTRIBUTED;
      ctx.setLineDash([3, 4]);
      for (const edge of contributionEdges) {
        const sourceNode = state.byId?.get?.(edge.source);
        const targetNode = state.byId?.get?.(edge.target);
        if (!sourceNode || !targetNode) continue;
        let opacity = 0.78;
        if (state.query && typeof matchesQuery === "function" && !(matchesQuery(sourceNode) || matchesQuery(targetNode))) opacity *= 0.18;
        if (state.selected && sourceNode !== state.selected && targetNode !== state.selected) opacity *= 0.18;
        const source = worldToScreen(sourceNode.x, sourceNode.y);
        const target = worldToScreen(targetNode.x, targetNode.y);
        ctx.globalAlpha = opacity;
        ctx.lineWidth = 1.65;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
      }
      ctx.restore();
    };
  }

  if (typeof drawNodesAndLabels === "function") {
    const baseDrawNodesAndLabels = drawNodesAndLabels;
    drawNodesAndLabels = function contributedEmphasisNodes(colors) {
      const result = baseDrawNodesAndLabels(colors);
      if (!isGalaxyStyle()) return result;
      ctx.save();
      ctx.strokeStyle = colors.contributed || CONTRIBUTED;
      ctx.setLineDash([3, 3]);
      for (const node of state.nodes) {
        if (!isContributed(node)) continue;
        let opacity = 0.94;
        if (state.query && typeof matchesQuery === "function" && !matchesQuery(node)) opacity *= 0.18;
        if (state.selected && state.selected !== node) opacity *= 0.24;
        const point = worldToScreen(node.x, node.y);
        const radius = Math.max(4, nodeRadius(node) * state.zoom) + 9;
        ctx.globalAlpha = opacity;
        ctx.lineWidth = node === state.selected ? 2.1 : 1.45;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
      return result;
    };
  }

  function place(target) {
    const owner = runtime.owner;
    if (!owner) return;
    target.node.x = owner.x + Math.cos(target.phase) * target.radius;
    target.node.y = owner.y + Math.sin(target.phase) * target.radius;
    target.node.vx = 0;
    target.node.vy = 0;
  }

  function initialize() {
    runtime.nodesRef = state?.nodes ?? null;
    runtime.style = state?.style ?? null;
    runtime.targets = [];
    runtime.owner = null;
    runtime.lastTime = performance.now();
    if (!isGalaxyStyle() || !Array.isArray(state.nodes)) return false;

    const owner = state.nodes.find((node) => node.type === "owner");
    const external = state.nodes
      .filter(isContributed)
      .sort((a, b) => (b.stars || 0) - (a.stars || 0) || String(a.id).localeCompare(String(b.id)));
    if (!owner || !external.length) return false;
    runtime.owner = owner;

    const structural = state.nodes.filter((node) => node !== owner && !isContributed(node));
    const extent = Math.max(220, ...structural.map((node) => Math.hypot(node.x - owner.x, node.y - owner.y)).filter(Number.isFinite));
    const baseRadius = Math.max(345, extent + 105);
    const perLane = 6;

    runtime.targets = external.map((node, index) => {
      const lane = Math.floor(index / perLane);
      const inLane = index % perLane;
      const laneCount = Math.min(perLane, external.length - lane * perLane);
      const seed = (hashText(`${node.id}:contributed-orbit`) % 10000) / 10000;
      const phase = -Math.PI / 2 + TAU * (inLane + seed * 0.28) / Math.max(1, laneCount);
      const radius = baseRadius + lane * 86 + ((hashText(`${node.id}:contributed-radius`) % 31) - 15);
      const stylePeriod = state.style === "galaxy-classic" ? 520 : state.style === "galaxy-systems" ? 760 : 980;
      const direction = (hashText(`${node.id}:contributed-direction`) & 1) === 0 ? 1 : -1;
      return { node, phase, radius, period: stylePeriod + lane * 120, direction };
    });

    for (const target of runtime.targets) place(target);
    if (typeof fitView === "function") fitView();
    else if (typeof draw === "function") draw();
    return true;
  }

  function step(now) {
    if (state?.nodes !== runtime.nodesRef || state?.style !== runtime.style) initialize();
    if (!runtime.targets.length || motionMedia.matches) return false;
    const dt = Math.max(0, Math.min(50, now - runtime.lastTime));
    runtime.lastTime = now;
    if (!dt) return false;
    for (const target of runtime.targets) {
      target.phase += target.direction * TAU * dt / (target.period * 1000);
      place(target);
    }
    return true;
  }

  window.ProjectMapContributedEmphasis = Object.freeze({
    snapshot: () => ({
      color: CONTRIBUTED,
      style: typeof state !== "undefined" ? state.style : null,
      reducedMotion: motionMedia.matches,
      repositories: runtime.targets.map((target) => ({ id: target.node.id, x: target.node.x, y: target.node.y, radius: target.radius })),
    }),
  });

  initialize();
  function frame(now) {
    step(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
});
