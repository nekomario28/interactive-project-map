"use strict";
(() => {
  const allStyles = new Set(["radial","galaxy","obsidian","tree","treemap","timeline","cluster","sunburst","matrix","sankey"]);
  const dedicatedStyles = new Set(["tree","radial","treemap","timeline","cluster","sunburst","matrix","sankey"]);
  const styleSelectRouter = document.getElementById("style");
  const styleQuery = new URL(location.href).searchParams;

  function styleUrl(style, username) {
    const route = dedicatedStyles.has(style) ? `../${style}/` : "../u/";
    const url = new URL(route, location.href);
    if (username) url.searchParams.set("username", username);
    url.searchParams.set("style", style);
    return url;
  }

  const requestedStyle = styleQuery.get("style");
  if (dedicatedStyles.has(requestedStyle)) {
    location.replace(styleUrl(requestedStyle, styleQuery.get("username")).toString());
    return;
  }

  if (styleSelectRouter) {
    styleSelectRouter.addEventListener("change", (event) => {
      const style = styleSelectRouter.value;
      if (!allStyles.has(style) || !dedicatedStyles.has(style)) return;
      event.stopImmediatePropagation();
      location.assign(styleUrl(style, styleQuery.get("username")).toString());
    }, true);
  }

  window.addEventListener("DOMContentLoaded", () => {
    // Living Galaxy adapted from the existing nekomario28/nekomario28 github.io viewer:
    // graph.js + orbital-spacing.js + galaxy-structure.js + cosmic.js.
    // That interactive page is the behavioral source of truth for Galaxy mode.
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const galaxy = {
      initialized: false,
      nodesRef: null,
      owner: null,
      ownerHome: null,
      categories: new Map(),
      repositories: new Map(),
      lastTime: performance.now(),
      obsidianNodesRef: null,
      obsidianAlpha: 0,
    };

    const cosmic = { particles: [], seed: 0x6e656b6f };
    const tau = Math.PI * 2;

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
      const red = parseInt(full.slice(0, 2), 16);
      const green = parseInt(full.slice(2, 4), 16);
      const blue = parseInt(full.slice(4, 6), 16);
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
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
      const periodSeconds = 250 + normalized * 210;
      return tau / periodSeconds;
    }

    function plannedRadius(repository, slotIndex) {
      const lane = slotIndex % 3;
      const tier = Math.floor(slotIndex / 3);
      const jitter = (hash(`${repository.id}:galaxy-radius`) % 25) - 12;
      // This is identical to the original profile geometry at normal portfolio sizes.
      // Do not cap large tiers so the generic viewer still supports the 300-repo contract.
      return Math.max(205, 220 + lane * 92 + tier * 34 + jitter);
    }

    function memberMap() {
      const result = new Map();
      for (const node of state.nodes) {
        if (node.type === "group") result.set(node.id, []);
      }
      for (const edge of state.edges) {
        if (!["membership", "member"].includes(edge.type)) continue;
        const source = state.byId.get(edge.source);
        const target = state.byId.get(edge.target);
        if (source?.type !== "group" || target?.type !== "repository") continue;
        result.get(source.id)?.push(target);
      }
      for (const members of result.values()) {
        members.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      }
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
      const owner = galaxy.owner;
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

    function initializeGalaxy() {
      if (state.style !== "galaxy" || !state.graph || !state.nodes.length) return false;
      const owner = state.nodes.find((node) => node.type === "owner");
      if (!owner) return false;

      galaxy.owner = owner;
      galaxy.ownerHome = { x: owner.x, y: owner.y };
      galaxy.categories.clear();
      galaxy.repositories.clear();

      const memberships = memberMap();
      const groups = state.nodes
        .filter((node) => node.type === "group")
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const categoryCount = Math.max(1, groups.length);

      groups.forEach((group, groupIndex) => {
        const members = memberships.get(group.id) || [];
        const basePhase = -Math.PI / 2 + (tau * groupIndex) / categoryCount;
        const sectorWidth = Math.min(0.92, (tau / categoryCount) * 0.56);
        const category = {
          node: group,
          members,
          armPhase: basePhase,
          sectorWidth,
          patternSpeed: 0,
        };
        let speedTotal = 0;
        members.forEach((repository, slotIndex) => {
          const targetRadius = plannedRadius(repository, slotIndex);
          const slotCenter = members.length <= 1 ? 0 : slotIndex / (members.length - 1) - 0.5;
          const spiralOffset = ((targetRadius - 220) / 285) * 0.42;
          const phaseOffset = slotCenter * sectorWidth + spiralOffset;
          const angularSpeed = angularSpeedForRadius(targetRadius);
          speedTotal += angularSpeed;
          galaxy.repositories.set(repository.id, {
            node: repository,
            category,
            targetRadius,
            phaseOffset,
            angularSpeed,
          });
        });
        category.patternSpeed = members.length ? (speedTotal / members.length) * 0.94 : tau / 420;
        galaxy.categories.set(group.id, category);
      });

      for (const target of galaxy.repositories.values()) {
        const phase = target.category.armPhase + target.phaseOffset;
        const radius = target.targetRadius;
        target.node.x = owner.x + Math.cos(phase) * radius;
        target.node.y = owner.y + Math.sin(phase) * radius;
        const tangential = (target.angularSpeed * radius) / 60;
        target.node.vx = -Math.sin(phase) * tangential;
        target.node.vy = Math.cos(phase) * tangential;
      }
      for (const category of galaxy.categories.values()) positionCategory(category, true);

      owner.vx = 0;
      owner.vy = 0;
      galaxy.nodesRef = state.nodes;
      galaxy.lastTime = performance.now();
      galaxy.initialized = true;
      if (subtitle) subtitle.textContent = "Living Galaxy · differential rotation · drag nodes, pan and zoom";
      if (!state.selected && detailsDescription) {
        detailsDescription.textContent = motionMedia.matches
          ? "Living Galaxy motion is paused by your reduced-motion system preference. Drag nodes, pan empty space, and zoom."
          : "Living Galaxy: projects orbit with differential rotation. Drag a node to disturb its orbit, pan empty space, and zoom.";
      }
      fitView();
      return true;
    }

    function steerOwner(frameScale) {
      const owner = galaxy.owner;
      if (!owner) return;
      owner.vx = Number.isFinite(owner.vx) ? owner.vx : 0;
      owner.vy = Number.isFinite(owner.vy) ? owner.vy : 0;
      if (state.drag === owner) {
        galaxy.ownerHome = { x: owner.x, y: owner.y };
        owner.vx = 0;
        owner.vy = 0;
        return;
      }
      const home = galaxy.ownerHome || { x: owner.x, y: owner.y };
      const dx = home.x - owner.x;
      const dy = home.y - owner.y;
      const distance = Math.hypot(dx, dy);
      const spring = 0.00082 * (1 + clamp(distance / 180, 0, 1.5));
      owner.vx += dx * spring * frameScale;
      owner.vy += dy * spring * frameScale;
      const damping = Math.pow(0.986, frameScale);
      owner.vx *= damping;
      owner.vy *= damping;
    }

    function steerRepository(target, frameScale) {
      const node = target.node;
      const owner = galaxy.owner;
      if (!node || !owner) return;
      node.vx = Number.isFinite(node.vx) ? node.vx : 0;
      node.vy = Number.isFinite(node.vy) ? node.vy : 0;
      if (state.drag === node) {
        node.vx = 0;
        node.vy = 0;
        return;
      }

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
      const desiredTangential = (target.angularSpeed * radius) / 60;
      const radialError = target.targetRadius - radius;
      const radialAcceleration = (radialError * 0.00034 - radialVelocity * 0.034) * frameScale;
      const currentPhase = Math.atan2(dy, dx);
      const desiredPhase = target.category.armPhase + target.phaseOffset;
      const phaseError = wrapAngle(desiredPhase - currentPhase);
      const phaseAcceleration = clamp(phaseError * radius * 0.000018, -0.010, 0.010) * frameScale;
      const tangentialAcceleration =
        ((desiredTangential - tangentialVelocity) * 0.020 + phaseAcceleration) * frameScale;
      node.vx += ux * radialAcceleration + tx * tangentialAcceleration;
      node.vy += uy * radialAcceleration + ty * tangentialAcceleration;
    }

    function applyOrbitalSpacing(strength = 1) {
      const owner = galaxy.owner;
      if (!owner) return;
      const targets = Array.from(galaxy.repositories.values());
      for (let first = 0; first < targets.length; first += 1) {
        const aTarget = targets[first];
        const a = aTarget.node;
        if (!a || state.drag === a) continue;
        const aDx = a.x - owner.x;
        const aDy = a.y - owner.y;
        const aRadius = Math.max(1, Math.hypot(aDx, aDy));
        const aAngle = Math.atan2(aDy, aDx);
        const aTx = -Math.sin(aAngle);
        const aTy = Math.cos(aAngle);

        for (let second = first + 1; second < targets.length; second += 1) {
          const bTarget = targets[second];
          const b = bTarget.node;
          if (!b || state.drag === b) continue;
          const radialGap = Math.abs(aTarget.targetRadius - bTarget.targetRadius);
          const radialInfluence = clamp(1 - radialGap / 105, 0, 1);
          if (radialInfluence <= 0) continue;
          const bDx = b.x - owner.x;
          const bDy = b.y - owner.y;
          const bRadius = Math.max(1, Math.hypot(bDx, bDy));
          const bAngle = Math.atan2(bDy, bDx);
          let angularGap = angleDelta(aAngle, bAngle);
          if (Math.abs(angularGap) < 0.0001) {
            angularGap = String(a.id).localeCompare(String(b.id)) <= 0 ? 0.0001 : -0.0001;
          }
          const averageRadius = (aRadius + bRadius) / 2;
          const labelClearance = collisionRadius(a) + collisionRadius(b) + 72;
          const comfortAngle = clamp(labelClearance / averageRadius, 0.14, 0.62) * (0.72 + radialInfluence * 0.28);
          const gap = Math.abs(angularGap);
          if (gap >= comfortAngle) continue;
          const proximity = 1 - gap / comfortAngle;
          const sameCategory = aTarget.category === bTarget.category;
          const phasePush =
            proximity * proximity * radialInfluence * (sameCategory ? 0.0042 : 0.0030) * clamp(strength, 0, 1);
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
      if (!node || state.drag === node) return;
      const speed = Math.hypot(node.vx || 0, node.vy || 0);
      const maximum = node.type === "owner" ? 0.22 : node.type === "group" ? 0.58 : 0.82;
      if (speed <= maximum || speed < 0.001) return;
      const scale = maximum / speed;
      node.vx *= scale;
      node.vy *= scale;
    }

    function stepGalaxy(now) {
      if (state.nodes !== galaxy.nodesRef || !galaxy.initialized) {
        if (!initializeGalaxy()) return false;
      }
      if (motionMedia.matches) return false;
      const dt = clamp(now - galaxy.lastTime, 0, 50);
      galaxy.lastTime = now;
      if (dt <= 0) return false;
      const frameScale = dt / (1000 / 60);

      steerOwner(frameScale);
      for (const category of galaxy.categories.values()) {
        category.armPhase = wrapAngle(category.armPhase + category.patternSpeed * (dt / 1000));
      }
      for (const target of galaxy.repositories.values()) steerRepository(target, frameScale);
      for (const category of galaxy.categories.values()) positionCategory(category, false);
      applyOrbitalSpacing(0.82);
      for (const node of state.nodes) limitSpeed(node);

      for (const node of state.nodes) {
        node.vx = Number.isFinite(node.vx) ? node.vx : 0;
        node.vy = Number.isFinite(node.vy) ? node.vy : 0;
        if (state.drag === node) continue;
        const damping = node.type === "repository" ? 0.9992 : node.type === "group" ? 0.9975 : 0.995;
        node.vx *= Math.pow(damping, frameScale);
        node.vy *= Math.pow(damping, frameScale);
        node.x += node.vx * frameScale;
        node.y += node.vy * frameScale;
      }
      return true;
    }

    function ensureObsidianState() {
      if (galaxy.obsidianNodesRef === state.nodes) return;
      galaxy.obsidianNodesRef = state.nodes;
      galaxy.obsidianAlpha = 0.22;
      for (const node of state.nodes) {
        node.vx = Number.isFinite(node.vx) ? node.vx : 0;
        node.vy = Number.isFinite(node.vy) ? node.vy : 0;
      }
    }

    function stepObsidian() {
      ensureObsidianState();
      if (state.drag) galaxy.obsidianAlpha = Math.max(galaxy.obsidianAlpha, 0.9);
      const alpha = galaxy.obsidianAlpha;
      if (alpha < 0.002) return false;
      const nodes = state.nodes;

      for (let first = 0; first < nodes.length; first += 1) {
        const a = nodes[first];
        for (let second = first + 1; second < nodes.length; second += 1) {
          const b = nodes[second];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) {
            const angle = (hash(`${a.id}:${b.id}:live`) % 6283) / 1000;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            d2 = 1;
          }
          const distance = Math.sqrt(d2);
          const minimum = collisionRadius(a) + collisionRadius(b) + 10;
          const effective = Math.max(d2, minimum * minimum * 0.38);
          const force = (13500 * alpha) / effective;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          if (state.drag !== a) {
            a.vx -= fx;
            a.vy -= fy;
          }
          if (state.drag !== b) {
            b.vx += fx;
            b.vy += fy;
          }
          if (distance < minimum) {
            const push = (minimum - distance) * 0.018 * alpha;
            if (state.drag !== a) {
              a.vx -= (dx / distance) * push;
              a.vy -= (dy / distance) * push;
            }
            if (state.drag !== b) {
              b.vx += (dx / distance) * push;
              b.vy += (dy / distance) * push;
            }
          }
        }
      }

      for (const edge of state.edges) {
        const a = state.byId.get(edge.source);
        const b = state.byId.get(edge.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const target = edge.type === "ownership" ? 190 : 142;
        const amount = (distance - target) * 0.012 * alpha;
        const fx = (dx / distance) * amount;
        const fy = (dy / distance) * amount;
        if (state.drag !== a) {
          a.vx += fx;
          a.vy += fy;
        }
        if (state.drag !== b) {
          b.vx -= fx;
          b.vy -= fy;
        }
      }

      for (const node of nodes) {
        if (state.drag === node) {
          node.vx = 0;
          node.vy = 0;
          continue;
        }
        node.vx += -node.x * 0.0013 * alpha;
        node.vy += -node.y * 0.0013 * alpha;
        node.vx *= 0.83;
        node.vy *= 0.83;
        node.x += node.vx;
        node.y += node.vy;
      }
      galaxy.obsidianAlpha *= 0.965;
      return true;
    }

    function associationUnit(groupId, key) {
      return (hash(`${groupId}:${key}`) % 10000) / 9999;
    }

    function drawDiskParticles(colors, width, height) {
      const owner = galaxy.owner;
      const categories = Array.from(galaxy.categories.values());
      if (!owner || !categories.length) return;
      for (const particle of cosmic.particles) {
        const category = categories[particle.armSeed % categories.length];
        const spiral = ((particle.radius - 220) / 285) * 0.42;
        const angle = category.armPhase + spiral + particle.armOffset;
        const point = worldToScreen(
          owner.x + Math.cos(angle) * particle.radius,
          owner.y + Math.sin(angle) * particle.radius,
        );
        if (point.x < -4 || point.y < -4 || point.x > width + 4 || point.y > height + 4) continue;
        const twinkle = motionMedia.matches ? 1 : 0.94 + Math.sin(performance.now() / 2400 + particle.phase) * 0.06;
        ctx.fillStyle = rgba(colors.text, particle.alpha * twinkle);
        ctx.beginPath();
        ctx.arc(point.x, point.y, Math.max(0.35, particle.size * Math.sqrt(state.zoom)), 0, tau);
        ctx.fill();
      }
    }

    function drawNucleus(colors) {
      const owner = galaxy.owner;
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
        if (!cluster || Math.abs(radius - cluster.average) > threshold) {
          clusters.push({ total: radius, count: 1, average: radius });
        } else {
          cluster.total += radius;
          cluster.count += 1;
          cluster.average = cluster.total / cluster.count;
        }
      }
      return clusters.map((cluster) => cluster.average);
    }

    function drawRings(colors) {
      const owner = galaxy.owner;
      if (!owner) return;
      const center = worldToScreen(owner.x, owner.y);
      const radii = mergedRadii(Array.from(galaxy.repositories.values(), (target) => target.targetRadius), 46);
      ctx.save();
      ctx.setLineDash([]);
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = rgba(colors.muted, 0.075);
      for (const radius of radii) {
        const screenRadius = radius * state.zoom;
        if (screenRadius < 18) continue;
        ctx.beginPath();
        ctx.arc(center.x, center.y, screenRadius, 0, tau);
        ctx.stroke();
      }
      ctx.restore();
    }

    function traceArm(category) {
      const owner = galaxy.owner;
      if (!owner) return;
      let first = true;
      const maximumRadius = Math.max(545, ...Array.from(galaxy.repositories.values(), (target) => target.targetRadius));
      ctx.beginPath();
      for (let radius = 165; radius <= maximumRadius; radius += Math.max(9, maximumRadius / 160)) {
        const angle = category.armPhase + ((radius - 220) / 285) * 0.42;
        const point = worldToScreen(
          owner.x + Math.cos(angle) * radius,
          owner.y + Math.sin(angle) * radius,
        );
        if (first) {
          ctx.moveTo(point.x, point.y);
          first = false;
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
    }

    function drawSpiralSectors(colors) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const category of galaxy.categories.values()) {
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

    function drawAssociations(colors) {
      const owner = galaxy.owner;
      if (!owner) return;
      for (const category of galaxy.categories.values()) {
        const group = category.node;
        if (!group) continue;
        const point = worldToScreen(group.x, group.y);
        const memberCount = Math.max(1, category.members.length);
        const major = clamp((112 + Math.sqrt(memberCount) * 30) * state.zoom, 72, 205);
        const minor = clamp((42 + Math.sqrt(memberCount) * 11) * state.zoom, 30, 78);
        const tangentAngle = Math.atan2(group.y - owner.y, group.x - owner.x) + Math.PI / 2;
        const lobeCount = Math.round(clamp(3 + Math.floor(Math.sqrt(memberCount)), 3, 5));
        const focus = state.selected === group ? 1.32 : state.hovered === group ? 1.14 : 1;
        for (let index = 0; index < lobeCount; index += 1) {
          const along = (associationUnit(group.id, `lobe-${index}-x`) - 0.5) * major * 0.72;
          const across = (associationUnit(group.id, `lobe-${index}-y`) - 0.5) * minor * 0.78;
          const lobeMajor = major * (0.42 + associationUnit(group.id, `lobe-${index}-major`) * 0.26);
          const lobeMinor = minor * (0.50 + associationUnit(group.id, `lobe-${index}-minor`) * 0.34);
          const tilt = (associationUnit(group.id, `lobe-${index}-tilt`) - 0.5) * 0.42;
          ctx.save();
          ctx.translate(point.x, point.y);
          ctx.rotate(tangentAngle);
          ctx.translate(along, across);
          ctx.rotate(tilt);
          ctx.scale(1, lobeMinor / lobeMajor);
          const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, lobeMajor);
          gradient.addColorStop(0, rgba(colors.group, 0.043 * focus));
          gradient.addColorStop(0.42, rgba(colors.group, 0.025 * focus));
          gradient.addColorStop(0.78, rgba(colors.owner, 0.008 * focus));
          gradient.addColorStop(1, rgba(colors.group, 0));
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(0, 0, lobeMajor, 0, tau);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    const baseNodeRadius = nodeRadius;
    const baseDrawBackground = drawBackground;
    const baseDrawEdges = drawEdges;

    nodeRadius = function liveNodeRadius(node) {
      if (state.style !== "galaxy") return baseNodeRadius(node);
      if (node.type === "owner") return 7;
      if (node.type === "group") return 2.2;
      return baseNodeRadius(node);
    };

    drawBackground = function liveDrawBackground(colors, width, height) {
      if (state.style !== "galaxy" || !galaxy.initialized) {
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

    drawEdges = function liveDrawEdges(colors) {
      if (state.style !== "galaxy" || !galaxy.initialized) {
        baseDrawEdges(colors);
        return;
      }
      for (const edge of state.edges) {
        const sourceNode = state.byId.get(edge.source);
        const targetNode = state.byId.get(edge.target);
        if (!sourceNode || !targetNode) continue;
        const source = worldToScreen(sourceNode.x, sourceNode.y);
        const target = worldToScreen(targetNode.x, targetNode.y);
        const structural = edge.type !== "relation";
        let opacity = structural ? 0.045 : 0.72;
        if (state.selected && (sourceNode === state.selected || targetNode === state.selected)) {
          opacity = structural ? 0.34 : 0.94;
        } else if (state.selected) {
          opacity = structural ? 0.018 : 0.10;
        }
        if (state.query && !(matchesQuery(sourceNode) || matchesQuery(targetNode))) opacity *= 0.35;
        ctx.strokeStyle = rgba(edge.type === "relation" ? colors.relation : colors.edge, opacity);
        ctx.lineWidth = edge.type === "relation" ? 1.45 : 0.65;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    function frame(now) {
      let changed = false;
      try {
        if (state.graph && state.nodes.length) {
          if (state.style === "galaxy") {
            changed = stepGalaxy(now);
          } else {
            galaxy.initialized = false;
            galaxy.nodesRef = null;
            if (state.style === "obsidian") changed = stepObsidian();
          }
        }
        if (changed) draw();
      } catch (error) {
        console.warn("Live graph dynamics paused after an unexpected error.", error);
      }
      requestAnimationFrame(frame);
    }

    motionMedia.addEventListener("change", () => {
      galaxy.lastTime = performance.now();
      if (state.style === "galaxy" && !state.selected && detailsDescription) {
        detailsDescription.textContent = motionMedia.matches
          ? "Living Galaxy motion is paused by your reduced-motion system preference. Drag nodes, pan empty space, and zoom."
          : "Living Galaxy: projects orbit with differential rotation. Drag a node to disturb its orbit, pan empty space, and zoom.";
      }
    });

    requestAnimationFrame(frame);
  }, { once: true });
})();
