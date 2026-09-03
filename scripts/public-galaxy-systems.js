"use strict";
/* global state, clamp, hash, subtitle, detailsDescription, fitView, draw, nodeRadius, drawBackground, drawEdges, drawNodesAndLabels, matchesQuery, worldToScreen, ctx, displayLabel, labelBox, boxesOverlap, palette, performance, console, requestAnimationFrame */

window.addEventListener("DOMContentLoaded", () => {
  if (state.style !== "galaxy-systems") return;
  const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  const tau = Math.PI * 2;
  const runtime = {
    initialized: false,
    nodesRef: null,
    owner: null,
    categories: new Map(),
    repositories: new Map(),
    lastTime: performance.now(),
  };

  function rgba(hex, alpha) {
    const value = String(hex || "#000000").replace("#", "");
    const full = value.length === 3 ? value.split("").map((part) => part + part).join("") : value.padEnd(6, "0").slice(0, 6);
    return `rgba(${parseInt(full.slice(0, 2), 16)}, ${parseInt(full.slice(2, 4), 16)}, ${parseInt(full.slice(4, 6), 16)}, ${alpha})`;
  }

  function memberMap() {
    const result = new Map();
    const groups = state.nodes.filter((node) => node.type === "group");
    for (const group of groups) result.set(group.id, []);
    const assigned = new Set();
    for (const edge of state.edges) {
      if (!["membership", "member"].includes(edge.type)) continue;
      const source = state.byId.get(edge.source);
      const target = state.byId.get(edge.target);
      if (source?.type === "group" && target?.type === "repository") {
        result.get(source.id)?.push(target);
        assigned.add(target.id);
      } else if (target?.type === "group" && source?.type === "repository") {
        result.get(target.id)?.push(source);
        assigned.add(source.id);
      }
    }
    for (const repo of state.nodes.filter((node) => node.type === "repository" && !assigned.has(node.id))) {
      const group = groups.find((candidate) => candidate.id === `group:${repo.groupId}` || String(candidate.id).replace(/^group:/, "") === repo.groupId);
      if (group) result.get(group.id)?.push(repo);
    }
    for (const members of result.values()) members.sort((a, b) => (b.stars || 0) - (a.stars || 0) || String(a.id).localeCompare(String(b.id)));
    return result;
  }

  function orbitAssignments(group, members) {
    const result = [];
    let cursor = 0;
    let lane = 0;
    const seedPhase = ((hash(`${group.id}:system-phase`) % 10000) / 10000) * tau;
    while (cursor < members.length) {
      const radius = 58 + lane * 58;
      const capacity = Math.max(4, Math.floor((tau * radius) / 84));
      const take = Math.min(capacity, members.length - cursor);
      const direction = (hash(`${group.id}:orbit-direction`) & 1) === 0 ? 1 : -1;
      const period = 360 + lane * 180;
      for (let index = 0; index < take; index += 1) {
        result.push({
          node: members[cursor + index],
          radius,
          lane,
          phase: seedPhase + tau * index / Math.max(1, take) + lane * 0.29,
          direction,
          period,
        });
      }
      cursor += take;
      lane += 1;
    }
    return result;
  }

  function initialize() {
    if (state.style !== "galaxy-systems" || !state.graph || !state.nodes.length) return false;
    const owner = state.nodes.find((node) => node.type === "owner");
    if (!owner) return false;

    runtime.owner = owner;
    runtime.categories.clear();
    runtime.repositories.clear();
    const memberships = memberMap();
    const groups = state.nodes.filter((node) => node.type === "group").sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const categoryCount = Math.max(1, groups.length);
    let maximumSystemRadius = 58;

    for (const group of groups) {
      const members = memberships.get(group.id) || [];
      const assignments = orbitAssignments(group, members);
      const systemRadius = Math.max(58, ...assignments.map((target) => target.radius));
      maximumSystemRadius = Math.max(maximumSystemRadius, systemRadius);
      const rings = [...new Set(assignments.map((target) => target.radius))].sort((a, b) => a - b);
      const category = { node: group, members, assignments, rings, systemRadius };
      runtime.categories.set(group.id, category);
      for (const target of assignments) {
        target.category = category;
        runtime.repositories.set(target.node.id, target);
      }
    }

    const requiredCategoryRadius = ((maximumSystemRadius * 2 + 118) * categoryCount) / tau;
    const categoryRadius = categoryCount === 1 ? 168 : clamp(Math.max(188, requiredCategoryRadius), 188, 760);
    owner.x = 0;
    owner.y = 0;
    owner.vx = 0;
    owner.vy = 0;

    groups.forEach((group, index) => {
      const angle = -Math.PI / 2 + tau * index / categoryCount;
      group.x = Math.cos(angle) * categoryRadius;
      group.y = Math.sin(angle) * categoryRadius;
      group.vx = 0;
      group.vy = 0;
      const category = runtime.categories.get(group.id);
      if (category) {
        category.angle = angle;
        category.categoryRadius = categoryRadius;
      }
    });

    for (const target of runtime.repositories.values()) {
      const group = target.category.node;
      target.node.x = group.x + Math.cos(target.phase) * target.radius;
      target.node.y = group.y + Math.sin(target.phase) * target.radius;
      target.node.vx = 0;
      target.node.vy = 0;
    }

    runtime.nodesRef = state.nodes;
    runtime.lastTime = performance.now();
    runtime.initialized = true;
    if (subtitle) subtitle.textContent = "Galaxy Systems · slow category orbit · repositories orbit locally";
    if (!state.selected && detailsDescription) {
      detailsDescription.textContent = motionMedia.matches
        ? "Galaxy Systems: each category is a hub and its repositories share local orbital lanes. Motion is paused by your reduced-motion preference."
        : "Galaxy Systems: each category is a hub and its repositories orbit locally, so project membership stays readable while the map remains alive.";
    }
    fitView();
    return true;
  }

  function step(now) {
    if (state.nodes !== runtime.nodesRef || !runtime.initialized) {
      if (!initialize()) return false;
    }
    const dt = clamp(now - runtime.lastTime, 0, 50);
    runtime.lastTime = now;
    if (dt <= 0 || motionMedia.matches) return false;
    for (const category of runtime.categories.values()) {
      category.angle += tau * dt / (1800 * 1000);
      category.node.x = Math.cos(category.angle) * category.categoryRadius;
      category.node.y = Math.sin(category.angle) * category.categoryRadius;
      category.node.vx = 0;
      category.node.vy = 0;
    }
    for (const target of runtime.repositories.values()) {
      target.phase += target.direction * tau * dt / (target.period * 1000);
      const group = target.category.node;
      target.node.x = group.x + Math.cos(target.phase) * target.radius;
      target.node.y = group.y + Math.sin(target.phase) * target.radius;
    }
    return runtime.repositories.size > 0;
  }

  function drawNucleus(colors) {
    const owner = runtime.owner;
    if (!owner) return;
    const point = worldToScreen(owner.x, owner.y);
    const radius = clamp(128 * state.zoom, 58, 188);
    const gradient = ctx.createRadialGradient(point.x, point.y, 3, point.x, point.y, radius);
    gradient.addColorStop(0, rgba(colors.owner, 0.16));
    gradient.addColorStop(0.24, rgba(colors.owner, 0.065));
    gradient.addColorStop(0.68, rgba(colors.owner, 0.014));
    gradient.addColorStop(1, rgba(colors.owner, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, tau);
    ctx.fill();
  }

  function drawSystems(colors) {
    for (const category of runtime.categories.values()) {
      const group = category.node;
      const center = worldToScreen(group.x, group.y);
      const outer = clamp((category.systemRadius + 32) * state.zoom, 24, 290);
      const focus = state.selected === group || state.hovered === group || category.members.includes(state.selected) || category.members.includes(state.hovered);
      const gradient = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, outer);
      gradient.addColorStop(0, rgba(colors.group, focus ? 0.10 : 0.055));
      gradient.addColorStop(0.58, rgba(colors.group, focus ? 0.045 : 0.022));
      gradient.addColorStop(1, rgba(colors.group, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(center.x, center.y, outer, 0, tau);
      ctx.fill();

      ctx.save();
      ctx.strokeStyle = rgba(colors.group, focus ? 0.32 : 0.13);
      for (const radius of category.rings) {
        const screenRadius = radius * state.zoom;
        if (screenRadius < 8) continue;
        ctx.lineWidth = focus ? 0.9 : 0.6;
        ctx.beginPath();
        ctx.arc(center.x, center.y, screenRadius, 0, tau);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function connectedToFocus(node, focus) {
    if (!focus || node === focus) return true;
    return state.edges.some((edge) => (edge.source === focus.id && edge.target === node.id) || (edge.target === focus.id && edge.source === node.id));
  }

  const baseNodeRadius = nodeRadius;
  const baseDrawBackground = drawBackground;
  const baseDrawEdges = drawEdges;
  const baseDrawNodesAndLabels = drawNodesAndLabels;

  nodeRadius = function galaxySystemNodeRadius(node) {
    if (state.style !== "galaxy-systems") return baseNodeRadius(node);
    if (node.type === "owner") return 13;
    if (node.type === "group") return 8;
    return baseNodeRadius(node);
  };

  drawBackground = function galaxySystemsBackground(colors, width, height) {
    baseDrawBackground(colors, width, height);
    if (state.style !== "galaxy-systems" || !runtime.initialized) return;
    drawNucleus(colors);
    drawSystems(colors);
  };

  function edgeStroke(source, target, color, opacity, width, dashed = false, halo = false) {
    ctx.save();
    ctx.setLineDash(dashed ? [5, 4] : []);
    if (halo) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.14;
      ctx.lineWidth = width + 4;
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    }
    ctx.strokeStyle = color;
    ctx.globalAlpha = opacity;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.restore();
  }

  drawEdges = function galaxySystemEdges(colors) {
    if (state.style !== "galaxy-systems") {
      baseDrawEdges(colors);
      return;
    }
    const focus = state.selected || state.hovered;
    for (const edge of state.edges) {
      const a = state.byId.get(edge.source);
      const b = state.byId.get(edge.target);
      if (!a || !b) continue;
      const source = worldToScreen(a.x, a.y);
      const target = worldToScreen(b.x, b.y);
      const incident = Boolean(focus && (a === focus || b === focus));
      const relation = edge.type === "relation";
      const ownership = edge.type === "ownership";
      let opacity = relation ? 0.32 : ownership ? 0.28 : 0.055;
      let width = relation ? 1.35 : ownership ? 1.05 : 0.7;
      if (focus) {
        if (incident) {
          opacity = state.selected ? 0.96 : 0.74;
          width = state.selected ? (relation ? 2.5 : 1.7) : (relation ? 2.0 : 1.3);
        } else {
          opacity *= relation ? 0.18 : 0.22;
        }
      }
      if (state.query && !(matchesQuery(a) || matchesQuery(b))) opacity *= 0.2;
      edgeStroke(source, target, relation ? colors.relation : colors.edge, opacity, width, relation, Boolean(incident && state.selected));
    }
    ctx.globalAlpha = 1;
  };

  drawNodesAndLabels = function galaxySystemNodesAndLabels(colors) {
    if (state.style !== "galaxy-systems") {
      baseDrawNodesAndLabels(colors);
      return;
    }
    const repoCount = state.graph?.repositoryCount ?? state.nodes.filter((node) => node.type === "repository").length;
    const forceRepositories = repoCount <= 48;
    const candidates = [];

    for (const node of state.nodes) {
      const point = worldToScreen(node.x, node.y);
      const highlighted = node === state.selected || node === state.hovered;
      const radius = Math.max(3.5, nodeRadius(node) * state.zoom * (highlighted ? 1.14 : 1));
      let opacity = node.archived ? 0.72 : 1;
      if (state.query && !matchesQuery(node)) opacity *= 0.12;
      if (state.selected && !connectedToFocus(node, state.selected)) opacity *= 0.2;
      ctx.globalAlpha = opacity;
      ctx.fillStyle = node.type === "owner" ? colors.owner : node.type === "group" ? colors.group : node.archived ? colors.archived : node.fork ? colors.fork : colors.original;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, tau);
      ctx.fill();

      if (node.type === "owner" || node.type === "group") {
        ctx.strokeStyle = node.type === "owner" ? rgba(colors.owner, 0.42) : rgba(colors.group, 0.46);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius + (node.type === "owner" ? 7 : 5), 0, tau);
        ctx.stroke();
      }
      if (node.type === "repository" && node.archived) {
        ctx.strokeStyle = colors.archived;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius + 4, 0, tau);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (highlighted) {
        ctx.globalAlpha = Math.max(opacity, 0.8);
        ctx.strokeStyle = colors.selection;
        ctx.lineWidth = node === state.selected ? 2 : 1.2;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius + 5, 0, tau);
        ctx.stroke();
      }

      const always = node.type !== "repository" || highlighted || forceRepositories;
      if (always || state.zoom >= 0.43) {
        const fontSize = clamp((node.type === "owner" ? 14 : node.type === "group" ? 12 : 11) * Math.sqrt(state.zoom), 9, 15);
        candidates.push({
          node,
          point,
          radius,
          fontSize,
          opacity,
          priority: highlighted ? 100 : node.type === "owner" ? 92 : node.type === "group" ? 86 : (node.stars || 0) + (node.fork ? -1 : 1),
        });
      }
    }
    ctx.globalAlpha = 1;

    candidates.sort((a, b) => b.priority - a.priority || a.node.label.localeCompare(b.node.label));
    const occupied = [];
    for (const candidate of candidates) {
      const box = labelBox(candidate.node, candidate.point, candidate.radius, candidate.fontSize);
      const forced = candidate.node === state.selected || candidate.node === state.hovered || candidate.node.type === "owner" || candidate.node.type === "group" || (forceRepositories && candidate.node.type === "repository");
      if (!forced && occupied.some((other) => boxesOverlap(box, other, 6))) continue;
      occupied.push(box);
      const category = candidate.node.type === "group" ? runtime.categories.get(candidate.node.id) : null;
      const text = category ? `${displayLabel(candidate.node)} · ${category.members.length}` : displayLabel(candidate.node);
      ctx.globalAlpha = Math.max(candidate.opacity, forced ? 0.86 : 0);
      ctx.font = `${candidate.node.type === "owner" ? 700 : candidate.node.type === "group" ? 650 : 500} ${candidate.fontSize}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.lineWidth = 3.1;
      ctx.strokeStyle = colors.background;
      ctx.strokeText(text, candidate.point.x, box.top + 2);
      ctx.fillStyle = candidate.node.type === "group" ? colors.group : colors.text;
      ctx.fillText(text, candidate.point.x, box.top + 2);
    }
    ctx.globalAlpha = 1;
  };

  function reset() {
    runtime.initialized = false;
    runtime.nodesRef = null;
    runtime.owner = null;
    runtime.categories.clear();
    runtime.repositories.clear();
  }

  function frame(now) {
    try {
      if (state.style === "galaxy-systems" && state.graph && state.nodes.length) {
        if (step(now)) draw();
      } else if (runtime.initialized || runtime.nodesRef) reset();
    } catch (error) {
      console.warn("Galaxy Systems motion paused after an unexpected error.", error);
      reset();
    }
    requestAnimationFrame(frame);
  }

  motionMedia.addEventListener("change", () => {
    runtime.lastTime = performance.now();
    draw();
  });

  requestAnimationFrame(frame);
}, { once: true });
