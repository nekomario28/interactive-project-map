"use strict";
/* global state, clamp, hash, collisionRadius, subtitle, detailsDescription, fitView, draw, nodeRadius, drawBackground, drawEdges, drawNodesAndLabels, matchesQuery, worldToScreen, ctx, displayLabel, labelBox, boxesOverlap, palette, performance, console, requestAnimationFrame */

window.addEventListener("DOMContentLoaded", () => {
  const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  const tau = Math.PI * 2;
  const runtime = {
    initialized: false,
    nodesRef: null,
    owner: null,
    ownerHome: null,
    categories: new Map(),
    repositories: new Map(),
    lastTime: performance.now(),
  };
  const cosmic = { particles: [], seed: 0x6e656b6f };

  function random() {
    cosmic.seed = (Math.imul(cosmic.seed, 1664525) + 1013904223) >>> 0;
    return cosmic.seed / 0x100000000;
  }

  for (let index = 0; index < 190; index += 1) {
    cosmic.particles.push({
      radius: 70 + Math.sqrt(random()) * 500,
      armSeed: Math.floor(random() * 16),
      armOffset: (random() - 0.5) * 0.62,
      size: 0.38 + random() * 0.92,
      alpha: 0.045 + random() * 0.14,
      phase: random() * tau,
    });
  }

  function rgba(hex, alpha) {
    const value = String(hex || "#000000").replace("#", "");
    const full = value.length === 3 ? value.split("").map((part) => part + part).join("") : value.padEnd(6, "0").slice(0, 6);
    return `rgba(${parseInt(full.slice(0, 2), 16)}, ${parseInt(full.slice(2, 4), 16)}, ${parseInt(full.slice(4, 6), 16)}, ${alpha})`;
  }

  function wrapAngle(angle) {
    let value = angle % tau;
    if (value > Math.PI) value -= tau;
    if (value < -Math.PI) value += tau;
    return value;
  }

  function angleDelta(from, to) {
    return wrapAngle(to - from);
  }

  function angularSpeedForRadius(radius) {
    const normalized = clamp((radius - 190) / 330, 0, 1);
    return tau / (250 + normalized * 210);
  }

  function plannedRadius(repository, slotIndex) {
    const lane = slotIndex % 3;
    const tier = Math.floor(slotIndex / 3);
    const jitter = (hash(`${repository.id}:galaxy-radius`) % 25) - 12;
    return Math.max(205, 220 + lane * 92 + tier * 34 + jitter);
  }

  function memberMap() {
    const result = new Map();
    for (const node of state.nodes) if (node.type === "group") result.set(node.id, []);
    for (const edge of state.edges) {
      if (!["membership", "member"].includes(edge.type)) continue;
      const source = state.byId.get(edge.source);
      const target = state.byId.get(edge.target);
      if (source?.type === "group" && target?.type === "repository") result.get(source.id)?.push(target);
    }
    for (const members of result.values()) members.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return result;
  }

  function positionCategory(category, immediate = false) {
    const group = category?.node;
    if (!group || state.drag === group) return;
    const members = category.members.filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y));
    if (!members.length) return;
    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;
    for (const member of members) {
      x += member.x;
      y += member.y;
      vx += member.vx || 0;
      vy += member.vy || 0;
    }
    x /= members.length;
    y /= members.length;
    vx /= members.length;
    vy /= members.length;
    const owner = runtime.owner;
    const targetX = owner ? owner.x + (x - owner.x) * 0.78 : x;
    const targetY = owner ? owner.y + (y - owner.y) * 0.78 : y;
    if (immediate) {
      group.x = targetX;
      group.y = targetY;
      group.vx = vx * 0.78;
      group.vy = vy * 0.78;
      return;
    }
    group.vx = Number.isFinite(group.vx) ? group.vx : 0;
    group.vy = Number.isFinite(group.vy) ? group.vy : 0;
    group.vx += (targetX - group.x) * 0.0011;
    group.vy += (targetY - group.y) * 0.0011;
    group.vx += (vx * 0.78 - group.vx) * 0.012;
    group.vy += (vy * 0.78 - group.vy) * 0.012;
  }

  function initialize() {
    if (state.style !== "galaxy" || !state.graph || !state.nodes.length) return false;
    const owner = state.nodes.find((node) => node.type === "owner");
    if (!owner) return false;
    runtime.owner = owner;
    runtime.ownerHome = { x: owner.x, y: owner.y };
    runtime.categories.clear();
    runtime.repositories.clear();
    const memberships = memberMap();
    const groups = state.nodes.filter((node) => node.type === "group").sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const categoryCount = Math.max(1, groups.length);

    groups.forEach((group, groupIndex) => {
      const members = memberships.get(group.id) || [];
      const basePhase = -Math.PI / 2 + tau * groupIndex / categoryCount;
      const sectorWidth = Math.min(0.92, (tau / categoryCount) * 0.56);
      const category = { node: group, members, armPhase: basePhase, sectorWidth, patternSpeed: 0 };
      let speedTotal = 0;
      members.forEach((repository, slotIndex) => {
        const targetRadius = plannedRadius(repository, slotIndex);
        const slotCenter = members.length <= 1 ? 0 : slotIndex / (members.length - 1) - 0.5;
        const phaseOffset = slotCenter * sectorWidth + ((targetRadius - 220) / 285) * 0.42;
        const angularSpeed = angularSpeedForRadius(targetRadius);
        speedTotal += angularSpeed;
        runtime.repositories.set(repository.id, { node: repository, category, targetRadius, phaseOffset, angularSpeed });
      });
      category.patternSpeed = members.length ? (speedTotal / members.length) * 0.94 : tau / 420;
      runtime.categories.set(group.id, category);
    });

    for (const target of runtime.repositories.values()) {
      const phase = target.category.armPhase + target.phaseOffset;
      const radius = target.targetRadius;
      target.node.x = owner.x + Math.cos(phase) * radius;
      target.node.y = owner.y + Math.sin(phase) * radius;
      const tangential = target.angularSpeed * radius / 60;
      target.node.vx = -Math.sin(phase) * tangential;
      target.node.vy = Math.cos(phase) * tangential;
    }
    for (const category of runtime.categories.values()) positionCategory(category, true);
    owner.vx = 0;
    owner.vy = 0;
    runtime.nodesRef = state.nodes;
    runtime.lastTime = performance.now();
    runtime.initialized = true;
    if (subtitle) subtitle.textContent = "Living Galaxy · differential rotation · all project names visible at normal portfolio size";
    if (!state.selected && detailsDescription) {
      detailsDescription.textContent = motionMedia.matches
        ? "Living Galaxy motion is paused by your reduced-motion preference. Project names remain visible; pan and zoom still work."
        : "Living Galaxy: projects orbit with differential rotation. Project names remain visible at normal portfolio size; pan and zoom.";
    }
    fitView();
    return true;
  }

  function steerOwner(frameScale) {
    const owner = runtime.owner;
    if (!owner) return;
    owner.vx = Number.isFinite(owner.vx) ? owner.vx : 0;
    owner.vy = Number.isFinite(owner.vy) ? owner.vy : 0;
    const home = runtime.ownerHome || { x: owner.x, y: owner.y };
    const dx = home.x - owner.x;
    const dy = home.y - owner.y;
    const spring = 0.00082 * (1 + clamp(Math.hypot(dx, dy) / 180, 0, 1.5));
    owner.vx += dx * spring * frameScale;
    owner.vy += dy * spring * frameScale;
    const damping = Math.pow(0.986, frameScale);
    owner.vx *= damping;
    owner.vy *= damping;
  }

  function steerRepository(target, frameScale) {
    const node = target.node;
    const owner = runtime.owner;
    if (!node || !owner) return;
    node.vx = Number.isFinite(node.vx) ? node.vx : 0;
    node.vy = Number.isFinite(node.vy) ? node.vy : 0;
    let dx = node.x - owner.x;
    let dy = node.y - owner.y;
    let radius = Math.hypot(dx, dy);
    if (radius < 1) {
      const seed = (hash(`${node.id}:galaxy-phase`) % 6283) / 1000;
      dx = Math.cos(seed);
      dy = Math.sin(seed);
      radius = 1;
    }
    const ux = dx / radius;
    const uy = dy / radius;
    const tx = -uy;
    const ty = ux;
    const radialVelocity = node.vx * ux + node.vy * uy;
    const tangentialVelocity = node.vx * tx + node.vy * ty;
    const desiredTangential = target.angularSpeed * radius / 60;
    const radialAcceleration = ((target.targetRadius - radius) * 0.00034 - radialVelocity * 0.034) * frameScale;
    const phaseError = wrapAngle(target.category.armPhase + target.phaseOffset - Math.atan2(dy, dx));
    const phaseAcceleration = clamp(phaseError * radius * 0.000018, -0.010, 0.010) * frameScale;
    const tangentialAcceleration = ((desiredTangential - tangentialVelocity) * 0.020 + phaseAcceleration) * frameScale;
    node.vx += ux * radialAcceleration + tx * tangentialAcceleration;
    node.vy += uy * radialAcceleration + ty * tangentialAcceleration;
  }

  function applyOrbitalSpacing(strength = 1) {
    const owner = runtime.owner;
    if (!owner) return;
    const targets = Array.from(runtime.repositories.values());
    for (let first = 0; first < targets.length; first += 1) {
      const aTarget = targets[first];
      const a = aTarget.node;
      if (!a) continue;
      const aDx = a.x - owner.x;
      const aDy = a.y - owner.y;
      const aRadius = Math.max(1, Math.hypot(aDx, aDy));
      const aAngle = Math.atan2(aDy, aDx);
      const aTx = -Math.sin(aAngle);
      const aTy = Math.cos(aAngle);
      for (let second = first + 1; second < targets.length; second += 1) {
        const bTarget = targets[second];
        const b = bTarget.node;
        if (!b) continue;
        const radialInfluence = clamp(1 - Math.abs(aTarget.targetRadius - bTarget.targetRadius) / 105, 0, 1);
        if (radialInfluence <= 0) continue;
        const bDx = b.x - owner.x;
        const bDy = b.y - owner.y;
        const bRadius = Math.max(1, Math.hypot(bDx, bDy));
        const bAngle = Math.atan2(bDy, bDx);
        let angularGap = angleDelta(aAngle, bAngle);
        if (Math.abs(angularGap) < 0.0001) angularGap = String(a.id).localeCompare(String(b.id)) <= 0 ? 0.0001 : -0.0001;
        const averageRadius = (aRadius + bRadius) / 2;
        const labelClearance = collisionRadius(a) + collisionRadius(b) + 72;
        const comfortAngle = clamp(labelClearance / averageRadius, 0.14, 0.62) * (0.72 + radialInfluence * 0.28);
        const gap = Math.abs(angularGap);
        if (gap >= comfortAngle) continue;
        const proximity = 1 - gap / comfortAngle;
        const phasePush = proximity * proximity * radialInfluence * (aTarget.category === bTarget.category ? 0.0042 : 0.0030) * clamp(strength, 0, 1);
        const direction = angularGap > 0 ? 1 : -1;
        const bTx = -Math.sin(bAngle);
        const bTy = Math.cos(bAngle);
        a.vx -= aTx * phasePush * direction;
        a.vy -= aTy * phasePush * direction;
        b.vx += bTx * phasePush * direction;
        b.vy += bTy * phasePush * direction;
      }
    }
  }

  function limitSpeed(node) {
    if (!node) return;
    const speed = Math.hypot(node.vx || 0, node.vy || 0);
    const maximum = node.type === "owner" ? 0.22 : node.type === "group" ? 0.58 : 0.82;
    if (speed <= maximum || speed < 0.001) return;
    const scale = maximum / speed;
    node.vx *= scale;
    node.vy *= scale;
  }

  function step(now) {
    if (state.nodes !== runtime.nodesRef || !runtime.initialized) {
      if (!initialize()) return false;
    }
    if (motionMedia.matches) return false;
    const dt = clamp(now - runtime.lastTime, 0, 50);
    runtime.lastTime = now;
    if (dt <= 0) return false;
    const frameScale = dt / (1000 / 60);
    steerOwner(frameScale);
    for (const category of runtime.categories.values()) category.armPhase = wrapAngle(category.armPhase + category.patternSpeed * dt / 1000);
    for (const target of runtime.repositories.values()) steerRepository(target, frameScale);
    for (const category of runtime.categories.values()) positionCategory(category, false);
    applyOrbitalSpacing(0.82);
    for (const node of state.nodes) limitSpeed(node);
    for (const node of state.nodes) {
      node.vx = Number.isFinite(node.vx) ? node.vx : 0;
      node.vy = Number.isFinite(node.vy) ? node.vy : 0;
      const damping = node.type === "repository" ? 0.9992 : node.type === "group" ? 0.9975 : 0.995;
      node.vx *= Math.pow(damping, frameScale);
      node.vy *= Math.pow(damping, frameScale);
      node.x += node.vx * frameScale;
      node.y += node.vy * frameScale;
    }
    return true;
  }

  function drawDiskParticles(colors, width, height) {
    const owner = runtime.owner;
    const categories = Array.from(runtime.categories.values());
    if (!owner || !categories.length) return;
    for (const particle of cosmic.particles) {
      const category = categories[particle.armSeed % categories.length];
      const angle = category.armPhase + ((particle.radius - 220) / 285) * 0.42 + particle.armOffset;
      const point = worldToScreen(owner.x + Math.cos(angle) * particle.radius, owner.y + Math.sin(angle) * particle.radius);
      if (point.x < -4 || point.y < -4 || point.x > width + 4 || point.y > height + 4) continue;
      const twinkle = motionMedia.matches ? 1 : 0.94 + Math.sin(performance.now() / 2400 + particle.phase) * 0.06;
      ctx.fillStyle = rgba(colors.text, particle.alpha * twinkle);
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(0.35, particle.size * Math.sqrt(state.zoom)), 0, tau);
      ctx.fill();
    }
  }

  function drawNucleus(colors) {
    const owner = runtime.owner;
    if (!owner) return;
    const point = worldToScreen(owner.x, owner.y);
    const radius = clamp(150 * state.zoom, 74, 220);
    const gradient = ctx.createRadialGradient(point.x, point.y, 4, point.x, point.y, radius);
    gradient.addColorStop(0, rgba(colors.owner, 0.13));
    gradient.addColorStop(0.18, rgba(colors.owner, 0.06));
    gradient.addColorStop(0.62, rgba(colors.owner, 0.012));
    gradient.addColorStop(1, rgba(colors.owner, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, tau);
    ctx.fill();
  }

  function mergedRadii(radii, threshold = 42) {
    const sorted = radii.filter(Number.isFinite).sort((a, b) => a - b);
    const clusters = [];
    for (const radius of sorted) {
      const cluster = clusters[clusters.length - 1];
      if (!cluster || Math.abs(radius - cluster.average) > threshold) clusters.push({ total: radius, count: 1, average: radius });
      else {
        cluster.total += radius;
        cluster.count += 1;
        cluster.average = cluster.total / cluster.count;
      }
    }
    return clusters.map((cluster) => cluster.average);
  }

  function drawRings(colors) {
    if (!runtime.owner) return;
    const center = worldToScreen(runtime.owner.x, runtime.owner.y);
    ctx.save();
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = rgba(colors.muted, 0.075);
    for (const radius of mergedRadii(Array.from(runtime.repositories.values(), (target) => target.targetRadius), 46)) {
      const screenRadius = radius * state.zoom;
      if (screenRadius < 18) continue;
      ctx.beginPath();
      ctx.arc(center.x, center.y, screenRadius, 0, tau);
      ctx.stroke();
    }
    ctx.restore();
  }

  function traceArm(category) {
    if (!runtime.owner) return;
    const maximumRadius = Math.max(545, ...Array.from(runtime.repositories.values(), (target) => target.targetRadius));
    let first = true;
    ctx.beginPath();
    for (let radius = 165; radius <= maximumRadius; radius += Math.max(9, maximumRadius / 160)) {
      const angle = category.armPhase + ((radius - 220) / 285) * 0.42;
      const point = worldToScreen(runtime.owner.x + Math.cos(angle) * radius, runtime.owner.y + Math.sin(angle) * radius);
      if (first) {
        ctx.moveTo(point.x, point.y);
        first = false;
      } else ctx.lineTo(point.x, point.y);
    }
  }

  function drawSpiralSectors(colors) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const category of runtime.categories.values()) {
      traceArm(category);
      ctx.strokeStyle = rgba(colors.group, 0.018);
      ctx.lineWidth = clamp(70 * state.zoom, 22, 78);
      ctx.stroke();
      traceArm(category);
      ctx.strokeStyle = rgba(colors.group, 0.035);
      ctx.lineWidth = clamp(28 * state.zoom, 10, 34);
      ctx.stroke();
      traceArm(category);
      ctx.strokeStyle = rgba(colors.group, 0.115);
      ctx.lineWidth = 0.65;
      ctx.stroke();
    }
    ctx.restore();
  }

  function associationUnit(groupId, key) {
    return (hash(`${groupId}:${key}`) % 10000) / 9999;
  }

  function drawAssociations(colors) {
    if (!runtime.owner) return;
    for (const category of runtime.categories.values()) {
      const group = category.node;
      const point = worldToScreen(group.x, group.y);
      const memberCount = Math.max(1, category.members.length);
      const major = clamp((112 + Math.sqrt(memberCount) * 30) * state.zoom, 72, 205);
      const minor = clamp((42 + Math.sqrt(memberCount) * 11) * state.zoom, 30, 78);
      const tangentAngle = Math.atan2(group.y - runtime.owner.y, group.x - runtime.owner.x) + Math.PI / 2;
      const lobeCount = Math.round(clamp(3 + Math.floor(Math.sqrt(memberCount)), 3, 5));
      const focus = state.selected === group ? 1.32 : state.hovered === group ? 1.14 : 1;
      for (let index = 0; index < lobeCount; index += 1) {
        const along = (associationUnit(group.id, `lobe-${index}-x`) - 0.5) * major * 0.72;
        const across = (associationUnit(group.id, `lobe-${index}-y`) - 0.5) * minor * 0.78;
        const lobeMajor = major * (0.42 + associationUnit(group.id, `lobe-${index}-major`) * 0.26);
        const lobeMinor = minor * (0.50 + associationUnit(group.id, `lobe-${index}-minor`) * 0.34);
        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.rotate(tangentAngle);
        ctx.translate(along, across);
        ctx.scale(1, lobeMinor / lobeMajor);
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, lobeMajor);
        gradient.addColorStop(0, rgba(colors.group, 0.043 * focus));
        gradient.addColorStop(0.42, rgba(colors.group, 0.025 * focus));
        gradient.addColorStop(1, rgba(colors.group, 0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, lobeMajor, 0, tau);
        ctx.fill();
        ctx.restore();
      }
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

  nodeRadius = function galaxyNodeRadius(node) {
    if (state.style !== "galaxy") return baseNodeRadius(node);
    if (node.type === "owner") return 7;
    if (node.type === "group") return 2.2;
    return baseNodeRadius(node);
  };

  drawBackground = function galaxyBackground(colors, width, height) {
    if (state.style !== "galaxy" || !runtime.initialized) {
      baseDrawBackground(colors, width, height);
      return;
    }
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);
    drawDiskParticles(colors, width, height);
    drawNucleus(colors);
    drawRings(colors);
    drawSpiralSectors(colors);
    drawAssociations(colors);
  };

  function drawEdgeStroke(source, target, color, opacity, width, halo = false) {
    if (halo) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.15;
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
  }

  drawEdges = function galaxyEdges(colors) {
    if (state.style !== "galaxy") {
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
      let opacity = relation ? 0.72 : 0.055;
      let width = relation ? 1.55 : 0.72;
      if (focus) {
        if (incident) {
          opacity = state.selected ? (relation ? 1 : 0.95) : (relation ? 0.92 : 0.74);
          width = state.selected ? (relation ? 2.6 : 1.8) : (relation ? 2.05 : 1.35);
        } else opacity = relation ? 0.08 : 0.014;
      }
      if (state.query && !(matchesQuery(a) || matchesQuery(b))) opacity *= 0.25;
      const color = relation ? colors.relation : colors.edge;
      ctx.setLineDash([]);
      drawEdgeStroke(source, target, color, opacity, width, Boolean(incident && state.selected));
    }
    ctx.globalAlpha = 1;
  };

  drawNodesAndLabels = function galaxyNodesAndLabels(colors) {
    if (state.style !== "galaxy") {
      baseDrawNodesAndLabels(colors);
      return;
    }
    const repoCount = state.graph?.repositoryCount ?? state.nodes.filter((node) => node.type === "repository").length;
    const forceRepositories = repoCount <= 48;
    const focus = state.selected || state.hovered;
    const candidates = [];

    for (const node of state.nodes) {
      const point = worldToScreen(node.x, node.y);
      const highlighted = node === state.selected || node === state.hovered;
      const radius = Math.max(3.5, nodeRadius(node) * state.zoom * (highlighted ? 1.13 : 1));
      let opacity = node.archived ? 0.72 : 1;
      if (state.query && !matchesQuery(node)) opacity *= 0.12;
      if (state.selected && !connectedToFocus(node, state.selected)) opacity *= 0.22;

      ctx.globalAlpha = opacity;
      const colorsByStatus = node.type === "owner" ? colors.owner : node.type === "group" ? colors.group : node.archived ? colors.archived : node.fork ? colors.fork : colors.original;
      ctx.fillStyle = colorsByStatus;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, tau);
      ctx.fill();
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
        ctx.globalAlpha = Math.max(opacity, 0.78);
        ctx.strokeStyle = colors.selection;
        ctx.lineWidth = node === state.selected ? 2 : 1.2;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius + 5, 0, tau);
        ctx.stroke();
      }

      const always = node.type !== "repository" || highlighted || forceRepositories;
      if (always || state.zoom >= 0.42) {
        const fontSize = clamp((node.type === "owner" ? 14 : node.type === "group" ? 12 : 11) * Math.sqrt(state.zoom), 9, 15);
        candidates.push({
          node,
          point,
          radius,
          fontSize,
          opacity,
          priority: highlighted ? 100 : node.type === "owner" ? 90 : node.type === "group" ? 80 : (node.stars || 0) + (node.fork ? -1 : 1),
        });
      }
    }
    ctx.globalAlpha = 1;

    candidates.sort((a, b) => b.priority - a.priority || a.node.label.localeCompare(b.node.label));
    const occupied = [];
    for (const candidate of candidates) {
      const box = labelBox(candidate.node, candidate.point, candidate.radius, candidate.fontSize);
      const forced = candidate.node === state.selected || candidate.node === state.hovered || candidate.node.type === "owner" ||
        (forceRepositories && candidate.node.type === "repository");
      if (!forced && occupied.some((other) => boxesOverlap(box, other, 6))) continue;
      occupied.push(box);
      ctx.globalAlpha = Math.max(candidate.opacity, forced ? 0.84 : 0);
      ctx.font = `${candidate.node.type === "owner" ? 700 : candidate.node.type === "group" ? 600 : 500} ${candidate.fontSize}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = colors.background;
      ctx.strokeText(displayLabel(candidate.node), candidate.point.x, box.top + 2);
      ctx.fillStyle = candidate.node.type === "group" ? colors.muted : colors.text;
      ctx.fillText(displayLabel(candidate.node), candidate.point.x, box.top + 2);
    }
    ctx.globalAlpha = 1;
  };

  function reset() {
    runtime.initialized = false;
    runtime.nodesRef = null;
    runtime.owner = null;
    runtime.ownerHome = null;
    runtime.categories.clear();
    runtime.repositories.clear();
  }

  function frame(now) {
    try {
      if (state.style === "galaxy" && state.graph && state.nodes.length) {
        if (step(now)) draw();
      } else if (runtime.initialized || runtime.nodesRef) reset();
    } catch (error) {
      console.warn("Galaxy dynamics paused after an unexpected error.", error);
      reset();
    }
    requestAnimationFrame(frame);
  }

  motionMedia.addEventListener("change", () => {
    runtime.lastTime = performance.now();
  });

  requestAnimationFrame(frame);
}, { once: true });
