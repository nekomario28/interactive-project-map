"use strict";
/* global state, palette, drawEdges, draw, fitView */

window.addEventListener("DOMContentLoaded", () => {
  const CONTRIBUTED = "#E69F00";
  const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  const TAU = Math.PI * 2;
  const runtime = {
    nodesRef: null,
    style: null,
    owner: null,
    targets: [],
    sweepRadius: 0,
    placement: null,
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

  function distance(a, b) {
    return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));
  }

  function ownedSweepEnvelope(owner) {
    const groups = state.nodes.filter((node) => node?.type === "group");
    const groupById = new Map();
    for (const group of groups) {
      groupById.set(String(group.id), group);
      groupById.set(String(group.id).replace(/^group:/, ""), group);
    }

    const membershipGroup = new Map();
    for (const edge of state.edges || []) {
      if (!["membership", "member"].includes(edge?.type)) continue;
      const source = state.byId?.get?.(edge.source);
      const target = state.byId?.get?.(edge.target);
      if (source?.type === "group" && target?.type === "repository" && !isContributed(target)) membershipGroup.set(target.id, source);
      else if (target?.type === "group" && source?.type === "repository" && !isContributed(source)) membershipGroup.set(source.id, target);
    }

    let envelope = 220;
    for (const node of state.nodes) {
      if (node === owner || isContributed(node)) continue;
      let candidate = distance(owner, node);
      if (node?.type === "repository") {
        const group = membershipGroup.get(node.id) || groupById.get(String(node.groupId || ""));
        if (group) {
          const groupRadius = distance(owner, group);
          const localRadius = distance(group, node);
          candidate = Math.max(candidate, groupRadius + localRadius);
        }
      }
      if (Number.isFinite(candidate)) envelope = Math.max(envelope, candidate);
    }
    return envelope;
  }

  if (typeof palette === "function") {
    const basePalette = palette;
    palette = function contributedEmphasisPalette(...args) {
      return { ...basePalette(...args), contributed: CONTRIBUTED };
    };
  }

  if (typeof drawEdges === "function") {
    const baseDrawEdges = drawEdges;
    drawEdges = function contributedVisualEdgePolicy(colors) {
      if (!Array.isArray(state?.edges)) return baseDrawEdges(colors);
      const originalEdges = state.edges;
      const visibleEdges = originalEdges.filter((edge) => edge?.type !== "contribution");
      if (visibleEdges.length === originalEdges.length) return baseDrawEdges(colors);
      state.edges = visibleEdges;
      try {
        return baseDrawEdges(colors);
      } finally {
        state.edges = originalEdges;
      }
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

  function externalHaloTargets(external, sweepRadius) {
    // Keep the older, more cohesive owner-centered external-orbit reading, but fix
    // the old inward-lane bug: every later lane expands away from owned systems.
    const baseRadius = Math.max(345, sweepRadius + 125);
    const perLane = 6;
    return external.map((node, index) => {
      const lane = Math.floor(index / perLane);
      const inLane = index % perLane;
      const laneCount = Math.min(perLane, external.length - lane * perLane);
      const seed = (hashText(`${node.id}:contributed-halo`) % 10000) / 10000;
      const phase = -Math.PI / 2 + TAU * (inLane + seed * 0.28) / Math.max(1, laneCount);
      const radius = baseRadius + lane * 86 + ((hashText(`${node.id}:contributed-radius`) % 31) - 15);
      const stylePeriod = state.style === "galaxy-classic" ? 520 : state.style === "galaxy-systems" ? 1080 : 980;
      const direction = (hashText(`${node.id}:contributed-direction`) & 1) === 0 ? 1 : -1;
      return {
        node,
        placement: "external-halo-orbit",
        lane,
        phase,
        radius,
        period: stylePeriod + lane * 140,
        direction,
      };
    });
  }

  function initialize() {
    runtime.nodesRef = state?.nodes ?? null;
    runtime.style = state?.style ?? null;
    runtime.targets = [];
    runtime.owner = null;
    runtime.sweepRadius = 0;
    runtime.placement = null;
    runtime.lastTime = performance.now();
    if (!isGalaxyStyle() || !Array.isArray(state.nodes)) return false;

    const owner = state.nodes.find((node) => node.type === "owner");
    const external = state.nodes
      .filter(isContributed)
      .sort((a, b) => (b.stars || 0) - (a.stars || 0) || String(a.id).localeCompare(String(b.id)));
    if (!owner || !external.length) return false;

    runtime.owner = owner;
    runtime.sweepRadius = ownedSweepEnvelope(owner);
    runtime.placement = "external-halo-orbit";
    runtime.targets = externalHaloTargets(external, runtime.sweepRadius);
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
      placement: runtime.placement,
      sweepRadius: runtime.sweepRadius,
      repositories: runtime.targets.map((target) => ({
        id: target.node.id,
        x: target.node.x,
        y: target.node.y,
        radius: target.radius,
        lane: target.lane,
        placement: target.placement,
        clearance: target.radius - runtime.sweepRadius,
      })),
    }),
  });

  initialize();
  function frame(now) {
    step(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
});
