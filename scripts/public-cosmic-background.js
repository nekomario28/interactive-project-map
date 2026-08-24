"use strict";
/* global state, ctx, hash, username, drawBackground, draw, worldToScreen, canvasSize, performance */

(() => {
  // Historical background donor copied from the final profile-local Project Map
  // before the Action migration:
  // nekomario28/nekomario28@ead72debca2a16608ebc5b799993c0234ea10cab
  //   scripts/render_project_map.py
  //   scripts/enhance_project_map_preview.py
  // Only the ambient background layer belongs here: stars, rings, loose stellar
  // associations and the owner nucleus. Foreground/category decoration stays owned
  // by IPM's native Galaxy runtimes.
  const DONOR_COMMIT = "ead72debca2a16608ebc5b799993c0234ea10cab";
  const Y_FLATTEN = 0.63;
  const STAR_COUNT = 92;
  const RINGS = Object.freeze([132, 194, 256]);
  const STAR_INNER = 70;
  const STAR_SPAN = 242;
  const TWINKLE_PERIOD_MS = 14000;
  const baseDrawBackground = drawBackground;

  function unit(seed) {
    return (seed >>> 0) / 0xffffffff;
  }

  function range(seed, minimum, maximum) {
    return minimum + (maximum - minimum) * unit(seed);
  }

  function galaxyNodes() {
    const owner = state.nodes.find((node) => node?.type === "owner") || { x: 0, y: 0 };
    const groups = state.nodes
      .filter((node) => node?.type === "group")
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return { owner, groups };
  }

  function groupPhase(group, index, count, owner) {
    const dx = Number(group?.x) - Number(owner?.x);
    const dy = Number(group?.y) - Number(owner?.y);
    if (Number.isFinite(dx) && Number.isFinite(dy) && Math.hypot(dx, dy) > 2) {
      return Math.atan2(dy, dx);
    }
    return -Math.PI / 2 + Math.PI * 2 * index / Math.max(1, count);
  }

  function donorStar(index, groups, owner) {
    const count = Math.max(1, groups.length);
    const groupIndex = index % count;
    const base = groupPhase(groups[groupIndex], groupIndex, count, owner);
    const radius = STAR_INNER + Math.sqrt(unit(hash(`${username}:profile-galaxy:radius:${index}`))) * STAR_SPAN;
    const angle = base
      + ((radius - 128) / 148) * 0.38
      + range(hash(`${username}:profile-galaxy:angle:${index}`), -0.34, 0.34);
    return {
      x: owner.x + Math.cos(angle) * radius,
      y: owner.y + Math.sin(angle) * radius * Y_FLATTEN,
      radius: [0.45, 0.60, 0.75, 0.95][hash(`${username}:profile-galaxy:size:${index}`) % 4],
      opacity: range(hash(`${username}:profile-galaxy:opacity:${index}`), 0.10, 0.30),
      twinklePhase: unit(hash(`${username}:profile-galaxy:twinkle:${index}`)) * Math.PI * 2,
    };
  }

  function twinkle(star, now) {
    const phase = star.twinklePhase + (now % TWINKLE_PERIOD_MS) / TWINKLE_PERIOD_MS * Math.PI * 2;
    return star.opacity * (0.78 + 0.22 * (0.5 + 0.5 * Math.sin(phase)));
  }

  function drawStellarDisk(colors, groups, owner, now) {
    ctx.fillStyle = colors.text;
    for (let index = 0; index < STAR_COUNT; index += 1) {
      const star = donorStar(index, groups, owner);
      const point = worldToScreen(star.x, star.y);
      ctx.globalAlpha = twinkle(star, now);
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(0.35, star.radius * state.zoom), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawRings(colors, owner) {
    const center = worldToScreen(owner.x, owner.y);
    ctx.strokeStyle = colors.muted;
    ctx.lineWidth = 0.55;
    for (const radius of RINGS) {
      ctx.globalAlpha = 0.075;
      ctx.beginPath();
      ctx.ellipse(
        center.x,
        center.y,
        radius * state.zoom,
        radius * Y_FLATTEN * state.zoom,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function associationGeometry(groupIndex) {
    return {
      major: 72 + range(hash(`${username}:association:${groupIndex}:major`), -5, 9),
      minor: 30 + range(hash(`${username}:association:${groupIndex}:minor`), -3, 6),
    };
  }

  function drawAssociationLobe(group, groupIndex, lobeIndex, owner) {
    const point = worldToScreen(group.x, group.y);
    const { major, minor } = associationGeometry(groupIndex);
    const along = range(hash(`${username}:association:${groupIndex}:${lobeIndex}:along`), -0.34, 0.34) * major;
    const across = range(hash(`${username}:association:${groupIndex}:${lobeIndex}:across`), -0.36, 0.36) * minor;
    const rx = major * range(hash(`${username}:association:${groupIndex}:${lobeIndex}:rx`), 0.42, 0.66);
    const ry = minor * range(hash(`${username}:association:${groupIndex}:${lobeIndex}:ry`), 0.50, 0.82);
    const tangent = Math.atan2(group.y - owner.y, group.x - owner.x) + Math.PI / 2;
    const tilt = range(hash(`${username}:association:${groupIndex}:${lobeIndex}:tilt`), -12, 12) * Math.PI / 180;

    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(tangent + tilt);
    ctx.translate(along * state.zoom, across * state.zoom);
    ctx.scale(1, Math.max(0.15, ry / rx));
    const radius = Math.max(1, rx * state.zoom);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, "rgba(106,167,255,0.043)");
    gradient.addColorStop(0.42, "rgba(106,167,255,0.025)");
    gradient.addColorStop(0.78, "rgba(100,210,255,0.008)");
    gradient.addColorStop(1, "rgba(106,167,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawStellarAssociations(colors, groups, owner) {
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex];
      for (let lobeIndex = 0; lobeIndex < 4; lobeIndex += 1) {
        drawAssociationLobe(group, groupIndex, lobeIndex, owner);
      }

      const point = worldToScreen(group.x, group.y);
      const { major, minor } = associationGeometry(groupIndex);
      ctx.fillStyle = colors.text;
      for (let starIndex = 0; starIndex < 7; starIndex += 1) {
        let sx = range(hash(`${username}:association:${groupIndex}:star:${starIndex}:x`), -0.56, 0.56) * major;
        let sy = range(hash(`${username}:association:${groupIndex}:star:${starIndex}:y`), -0.58, 0.58) * minor;
        const normalized = Math.hypot(sx / major, sy / minor);
        if (normalized > 0.90) {
          const scale = 0.90 / normalized;
          sx *= scale;
          sy *= scale;
        }
        const radius = range(hash(`${username}:association:${groupIndex}:star:${starIndex}:r`), 0.45, 0.95);
        ctx.globalAlpha = range(hash(`${username}:association:${groupIndex}:star:${starIndex}:o`), 0.09, 0.17);
        ctx.beginPath();
        ctx.arc(
          point.x + sx * state.zoom,
          point.y + sy * state.zoom,
          radius * Math.max(0.55, state.zoom),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawNucleus(owner) {
    const center = worldToScreen(owner.x, owner.y);
    const radius = Math.max(24, 92 * state.zoom);
    const gradient = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
    gradient.addColorStop(0, "rgba(100,210,255,0.20)");
    gradient.addColorStop(0.45, "rgba(100,210,255,0.045)");
    gradient.addColorStop(1, "rgba(100,210,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBackground = function profileLocalGalaxyBackground(colors, width, height) {
    if (state.style === "obsidian" || !state.nodes?.length) {
      baseDrawBackground(colors, width, height);
      return;
    }

    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);
    const { owner, groups } = galaxyNodes();
    drawStellarDisk(colors, groups, owner, performance.now());
    drawRings(colors, owner);
    drawStellarAssociations(colors, groups, owner);
    drawNucleus(owner);
    ctx.globalAlpha = 1;
    ctx.lineCap = "butt";
  };

  function snapshot() {
    const { owner, groups } = galaxyNodes();
    const firstStar = donorStar(0, groups, owner);
    return {
      donor: "nekomario28/profile-local-background",
      donorCommit: DONOR_COMMIT,
      geometry: "world-space-category-background",
      starCount: STAR_COUNT,
      rings: [...RINGS],
      yFlatten: Y_FLATTEN,
      associationLobes: 4,
      associationStars: 7,
      twinklePeriodMs: TWINKLE_PERIOD_MS,
      groupCount: groups.length,
      pan: { ...state.pan },
      zoom: state.zoom,
      firstStar: {
        world: { x: firstStar.x, y: firstStar.y },
        screen: worldToScreen(firstStar.x, firstStar.y),
      },
      viewport: canvasSize(),
    };
  }

  window.ProjectMapCosmicBackground = Object.freeze({ snapshot });
  window.addEventListener("DOMContentLoaded", () => draw());
})();
