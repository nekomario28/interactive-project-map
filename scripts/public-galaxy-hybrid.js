"use strict";
/* global state, clamp, hash, subtitle, detailsDescription, fitView, draw, drawBackground, worldToScreen, ctx, palette, performance, requestAnimationFrame */

window.addEventListener("DOMContentLoaded", () => {
  if (state.style !== "galaxy-hybrid" || !window.GalaxyCommon) return;
  const { TAU, rgba, wrapAngle, memberMap, ownerNode } = window.GalaxyCommon;
  const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  const runtime = {
    initialized: false,
    nodesRef: null,
    owner: null,
    categories: new Map(),
    repositories: new Map(),
    globalRotation: 0,
    lastTime: performance.now(),
    armCount: 1,
  };

  const dust = Array.from({ length: 170 }, (_, index) => ({
    arm: hash(`hybrid:dust:arm:${index}`) % 3,
    t: (hash(`hybrid:dust:t:${index}`) % 10000) / 10000,
    offset: ((hash(`hybrid:dust:o:${index}`) % 1000) / 1000 - 0.5) * 0.48,
    radial: ((hash(`hybrid:dust:r:${index}`) % 1000) / 1000 - 0.5) * 42,
    size: 0.45 + (hash(`hybrid:dust:s:${index}`) % 90) / 100,
    alpha: 0.035 + (hash(`hybrid:dust:a:${index}`) % 90) / 1000,
  }));

  function orbitAssignments(group, members) {
    const assignments = [];
    let cursor = 0;
    let lane = 0;
    const seedPhase = ((hash(`${group.id}:hybrid-phase`) % 10000) / 10000) * TAU;
    const direction = (hash(`${group.id}:hybrid-direction`) & 1) === 0 ? 1 : -1;
    while (cursor < members.length) {
      const semiMajor = 54 + lane * 50;
      const semiMinor = semiMajor * 0.68;
      const capacity = Math.max(5, Math.floor((TAU * semiMajor) / 82));
      const take = Math.min(capacity, members.length - cursor);
      for (let index = 0; index < take; index += 1) {
        assignments.push({
          node: members[cursor + index],
          lane,
          semiMajor,
          semiMinor,
          phase: seedPhase + TAU * index / Math.max(1, take) + lane * 0.27,
          period: 480 + lane * 240,
          direction,
        });
      }
      cursor += take;
      lane += 1;
    }
    return assignments;
  }

  function placeCategory(category) {
    const angle = category.baseAngle + runtime.globalRotation;
    category.angle = angle;
    category.node.x = Math.cos(angle) * category.globalRadius;
    category.node.y = Math.sin(angle) * category.globalRadius;
    category.node.vx = 0;
    category.node.vy = 0;
  }

  function placeRepository(target) {
    const category = target.category;
    const orientation = category.angle + Math.PI / 2;
    const localX = Math.cos(target.phase) * target.semiMajor;
    const localY = Math.sin(target.phase) * target.semiMinor;
    const cos = Math.cos(orientation);
    const sin = Math.sin(orientation);
    target.node.x = category.node.x + localX * cos - localY * sin;
    target.node.y = category.node.y + localX * sin + localY * cos;
    target.node.vx = 0;
    target.node.vy = 0;
  }

  function initialize() {
    if (state.style !== "galaxy-hybrid" || !state.graph || !state.nodes.length) return false;
    const owner = ownerNode(state);
    if (!owner) return false;
    const memberships = memberMap(state);
    const groups = state.nodes
      .filter((node) => node.type === "group")
      .sort((a, b) => (memberships.get(b.id)?.length || 0) - (memberships.get(a.id)?.length || 0) || String(a.id).localeCompare(String(b.id)));
    const count = Math.max(1, groups.length);
    const armCount = count <= 3 ? 1 : count <= 8 ? 2 : 3;
    runtime.armCount = armCount;
    runtime.owner = owner;
    runtime.categories.clear();
    runtime.repositories.clear();
    runtime.globalRotation = 0;
    owner.x = 0;
    owner.y = 0;
    owner.vx = 0;
    owner.vy = 0;

    let maximumSystemRadius = 54;
    const prepared = groups.map((group) => {
      const members = memberships.get(group.id) || [];
      const assignments = orbitAssignments(group, members);
      const systemRadius = Math.max(54, ...assignments.map((target) => target.semiMajor));
      maximumSystemRadius = Math.max(maximumSystemRadius, systemRadius);
      return { group, members, assignments, systemRadius };
    });
    const tierGap = Math.max(190, maximumSystemRadius * 1.45 + 105);
    const baseRadius = Math.max(190, maximumSystemRadius + 126);

    prepared.forEach((preparedCategory, index) => {
      const armIndex = index % armCount;
      const tier = Math.floor(index / armCount);
      const baseAngle = -Math.PI / 2 + armIndex * TAU / armCount + tier * 0.62;
      const category = {
        node: preparedCategory.group,
        members: preparedCategory.members,
        assignments: preparedCategory.assignments,
        systemRadius: preparedCategory.systemRadius,
        armIndex,
        tier,
        baseAngle,
        angle: baseAngle,
        globalRadius: baseRadius + tier * tierGap,
      };
      runtime.categories.set(category.node.id, category);
      for (const target of category.assignments) {
        target.category = category;
        runtime.repositories.set(target.node.id, target);
      }
      placeCategory(category);
    });
    for (const target of runtime.repositories.values()) placeRepository(target);

    runtime.nodesRef = state.nodes;
    runtime.lastTime = performance.now();
    runtime.initialized = true;
    if (subtitle) subtitle.textContent = "Galaxy Hybrid · one spiral galaxy with local category systems";
    if (!state.selected && detailsDescription) {
      detailsDescription.textContent = motionMedia.matches
        ? "Galaxy Hybrid: the global spiral and local category systems are paused by your reduced-motion preference."
        : "Galaxy Hybrid: the whole spiral turns very slowly while repositories follow slower elliptical orbits around their category.";
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
    runtime.globalRotation = wrapAngle(runtime.globalRotation + TAU * dt / (2400 * 1000));
    for (const category of runtime.categories.values()) placeCategory(category);
    for (const target of runtime.repositories.values()) {
      target.phase = wrapAngle(target.phase + target.direction * TAU * dt / (target.period * 1000));
      placeRepository(target);
    }
    return runtime.categories.size > 0;
  }

  const baseDrawBackground = drawBackground;

  function drawNucleus(colors) {
    const owner = runtime.owner;
    if (!owner) return;
    const point = worldToScreen(owner.x, owner.y);
    const radius = clamp(145 * state.zoom, 58, 210);
    const gradient = ctx.createRadialGradient(point.x, point.y, 2, point.x, point.y, radius);
    gradient.addColorStop(0, rgba(colors.owner, 0.18));
    gradient.addColorStop(0.22, rgba(colors.owner, 0.07));
    gradient.addColorStop(0.7, rgba(colors.owner, 0.015));
    gradient.addColorStop(1, rgba(colors.owner, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, TAU);
    ctx.fill();
  }

  function drawSpiralDust(colors, width, height) {
    if (!runtime.categories.size) return;
    const categories = [...runtime.categories.values()];
    const maxRadius = Math.max(...categories.map((category) => category.globalRadius), 260);
    const minRadius = Math.min(...categories.map((category) => category.globalRadius), 180) * 0.45;
    for (const particle of dust) {
      const arm = particle.arm % runtime.armCount;
      const radius = minRadius + particle.t * (maxRadius + 120 - minRadius) + particle.radial;
      const angle = -Math.PI / 2 + arm * TAU / runtime.armCount + particle.t * 1.72 + runtime.globalRotation + particle.offset;
      const point = worldToScreen(Math.cos(angle) * radius, Math.sin(angle) * radius);
      if (point.x < -8 || point.y < -8 || point.x > width + 8 || point.y > height + 8) continue;
      ctx.globalAlpha = particle.alpha;
      ctx.fillStyle = colors.group;
      ctx.beginPath();
      ctx.arc(point.x, point.y, particle.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawSystems(colors) {
    for (const category of runtime.categories.values()) {
      const center = worldToScreen(category.node.x, category.node.y);
      const focus = state.selected === category.node || state.hovered === category.node || category.members.includes(state.selected) || category.members.includes(state.hovered);
      const outer = Math.max(24, (category.systemRadius + 30) * state.zoom);
      const gradient = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, outer);
      gradient.addColorStop(0, rgba(colors.group, focus ? 0.10 : 0.045));
      gradient.addColorStop(1, rgba(colors.group, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(center.x, center.y, outer, 0, TAU);
      ctx.fill();

      const orientation = category.angle + Math.PI / 2;
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(orientation);
      ctx.strokeStyle = rgba(colors.group, focus ? 0.31 : 0.11);
      ctx.lineWidth = focus ? 0.9 : 0.6;
      const lanes = new Map();
      for (const target of category.assignments) if (!lanes.has(target.lane)) lanes.set(target.lane, target);
      for (const target of lanes.values()) {
        ctx.beginPath();
        ctx.ellipse(0, 0, target.semiMajor * state.zoom, target.semiMinor * state.zoom, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawBackground = function hybridBackground(colors, width, height) {
    baseDrawBackground(colors, width, height);
    if (state.style !== "galaxy-hybrid" || !runtime.initialized) return;
    drawNucleus(colors);
    drawSpiralDust(colors, width, height);
    drawSystems(colors);
  };

  function frame(now) {
    const changed = step(now);
    if (changed) draw();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
});
