"use strict";
/* global state, canvas, ctx, hash, username, drawBackground, draw, canvasSize */

(() => {
  const TILE = { width: 960, height: 720 };
  const HAZE_TILE = { width: 1680, height: 1180 };
  const LAYERS = Object.freeze([
    { id: "far", count: 46, parallax: 0.08, radius: [0.38, 0.72], opacity: [0.10, 0.22] },
    { id: "mid", count: 36, parallax: 0.18, radius: [0.52, 1.02], opacity: [0.12, 0.28] },
    { id: "near", count: 24, parallax: 0.32, radius: [0.72, 1.42], opacity: [0.15, 0.34] },
  ]);
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
  const METEOR_MIN_DELAY = 22_000;
  const METEOR_DELAY_SPAN = 34_000;
  const runtime = {
    meteor: null,
    meteorSequence: 0,
    meteorTimer: null,
    meteorFrame: null,
  };

  function unit(seed) {
    return (seed >>> 0) / 0xffffffff;
  }

  function range(seed, minimum, maximum) {
    return minimum + (maximum - minimum) * unit(seed);
  }

  function wrap(value, size) {
    return ((value % size) + size) % size;
  }

  function motionReduced() {
    return Boolean(window.matchMedia?.(REDUCED_MOTION_QUERY).matches);
  }

  function effectiveParallax(layer) {
    return motionReduced() ? 0 : layer.parallax;
  }

  function starPoint(layer, index) {
    const parallax = effectiveParallax(layer);
    const xSeed = hash(`${username}:cosmic:${layer.id}:x:${index}`);
    const ySeed = hash(`${username}:cosmic:${layer.id}:y:${index}`);
    return {
      x: wrap(unit(xSeed) * TILE.width + state.pan.x * parallax, TILE.width),
      y: wrap(unit(ySeed) * TILE.height + state.pan.y * parallax, TILE.height),
      radius: range(hash(`${username}:cosmic:${layer.id}:r:${index}`), layer.radius[0], layer.radius[1]),
      opacity: range(hash(`${username}:cosmic:${layer.id}:o:${index}`), layer.opacity[0], layer.opacity[1]),
    };
  }

  function forEachWrappedCopy(point, width, height, callback) {
    const maxX = Math.ceil(width / TILE.width) + 1;
    const maxY = Math.ceil(height / TILE.height) + 1;
    for (let tileX = -1; tileX <= maxX; tileX += 1) {
      const x = point.x + tileX * TILE.width;
      if (x < -3 || x > width + 3) continue;
      for (let tileY = -1; tileY <= maxY; tileY += 1) {
        const y = point.y + tileY * TILE.height;
        if (y < -3 || y > height + 3) continue;
        callback(x, y);
      }
    }
  }

  function drawStars(width, height) {
    const compact = width < 720;
    ctx.fillStyle = "#dce9ff";
    for (const layer of LAYERS) {
      const count = compact ? Math.ceil(layer.count * 0.68) : layer.count;
      for (let index = 0; index < count; index += 1) {
        const point = starPoint(layer, index);
        ctx.globalAlpha = point.opacity;
        forEachWrappedCopy(point, width, height, (x, y) => {
          ctx.beginPath();
          ctx.arc(x, y, point.radius, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
    ctx.globalAlpha = 1;
  }

  function hazePoint(index, parallax) {
    return {
      x: wrap(unit(hash(`${username}:haze:x:${index}`)) * HAZE_TILE.width + state.pan.x * parallax, HAZE_TILE.width),
      y: wrap(unit(hash(`${username}:haze:y:${index}`)) * HAZE_TILE.height + state.pan.y * parallax, HAZE_TILE.height),
    };
  }

  function drawHaze(width, height) {
    const obsidian = state.style === "obsidian";
    const tint = obsidian ? [124, 110, 246] : [82, 126, 216];
    const alpha = obsidian ? 0.055 : 0.034;
    const radius = Math.max(340, Math.min(520, Math.max(width, height) * 0.48));
    const parallax = motionReduced() ? 0 : 0.035;
    const copiesX = Math.ceil(width / HAZE_TILE.width) + 1;
    const copiesY = Math.ceil(height / HAZE_TILE.height) + 1;

    for (let index = 0; index < 2; index += 1) {
      const base = hazePoint(index, parallax);
      for (let tileX = -1; tileX <= copiesX; tileX += 1) {
        const x = base.x + tileX * HAZE_TILE.width;
        if (x < -radius || x > width + radius) continue;
        for (let tileY = -1; tileY <= copiesY; tileY += 1) {
          const y = base.y + tileY * HAZE_TILE.height;
          if (y < -radius || y > height + radius) continue;
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
          gradient.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${alpha})`);
          gradient.addColorStop(0.55, `rgba(${tint[0]},${tint[1]},${tint[2]},${alpha * 0.35})`);
          gradient.addColorStop(1, `rgba(${tint[0]},${tint[1]},${tint[2]},0)`);
          ctx.fillStyle = gradient;
          ctx.fillRect(Math.max(0, x - radius), Math.max(0, y - radius), Math.min(width, radius * 2), Math.min(height, radius * 2));
        }
      }
    }
  }

  function meteorStateAt(now) {
    const meteor = runtime.meteor;
    if (!meteor) return null;
    const progress = (now - meteor.startedAt) / meteor.duration;
    if (progress >= 1) return null;
    const eased = progress * (2 - progress);
    const headX = meteor.x + meteor.dx * eased;
    const headY = meteor.y + meteor.dy * eased;
    const distance = Math.hypot(meteor.dx, meteor.dy) || 1;
    const ux = meteor.dx / distance;
    const uy = meteor.dy / distance;
    const trail = meteor.trail * (0.78 + 0.22 * Math.sin(progress * Math.PI));
    return {
      progress,
      headX,
      headY,
      tailX: headX - ux * trail,
      tailY: headY - uy * trail,
      alpha: Math.sin(Math.PI * progress),
    };
  }

  function drawMeteor(width, height, now = performance.now()) {
    const current = meteorStateAt(now);
    if (!current) {
      if (runtime.meteor) {
        runtime.meteor = null;
        scheduleMeteor();
      }
      return;
    }
    if (current.headX < -260 || current.headX > width + 260 || current.headY < -260 || current.headY > height + 260) return;

    const gradient = ctx.createLinearGradient(current.tailX, current.tailY, current.headX, current.headY);
    gradient.addColorStop(0, "rgba(190,218,255,0)");
    gradient.addColorStop(0.72, `rgba(205,228,255,${0.23 * current.alpha})`);
    gradient.addColorStop(1, `rgba(245,250,255,${0.74 * current.alpha})`);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.25;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(current.tailX, current.tailY);
    ctx.lineTo(current.headX, current.headY);
    ctx.stroke();

    ctx.globalAlpha = 0.10 * current.alpha;
    ctx.strokeStyle = "#dcecff";
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    ctx.moveTo(current.tailX, current.tailY);
    ctx.lineTo(current.headX, current.headY);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function nextMeteorDelay() {
    const seed = hash(`${username}:meteor:delay:${runtime.meteorSequence}`);
    return METEOR_MIN_DELAY + (seed % METEOR_DELAY_SPAN);
  }

  function clearMeteorTimer() {
    if (runtime.meteorTimer !== null) window.clearTimeout(runtime.meteorTimer);
    runtime.meteorTimer = null;
  }

  function scheduleMeteor() {
    clearMeteorTimer();
    if (motionReduced() || document.hidden || runtime.meteor) return;
    runtime.meteorTimer = window.setTimeout(() => {
      runtime.meteorTimer = null;
      spawnMeteor();
    }, nextMeteorDelay());
  }

  function requestMeteorFrame() {
    if (!runtime.meteor || runtime.meteorFrame !== null) return;
    runtime.meteorFrame = window.requestAnimationFrame(() => {
      runtime.meteorFrame = null;
      if (!runtime.meteor) return;
      draw();
      if (runtime.meteor) requestMeteorFrame();
    });
  }

  function spawnMeteor() {
    if (motionReduced() || document.hidden || runtime.meteor) return false;
    clearMeteorTimer();
    runtime.meteorSequence += 1;
    const size = canvasSize();
    const seed = hash(`${username}:meteor:${runtime.meteorSequence}`);
    const direction = (seed & 1) === 0 ? 1 : -1;
    const xUnit = unit(hash(`${username}:meteor:x:${runtime.meteorSequence}`));
    const yUnit = unit(hash(`${username}:meteor:y:${runtime.meteorSequence}`));
    const travelUnit = unit(hash(`${username}:meteor:travel:${runtime.meteorSequence}`));
    const x = direction > 0 ? -70 + xUnit * size.width * 0.58 : size.width + 70 - xUnit * size.width * 0.58;
    const y = -24 + yUnit * size.height * 0.30;
    runtime.meteor = {
      startedAt: performance.now(),
      duration: 860 + (seed % 360),
      x,
      y,
      dx: direction * (size.width * (0.48 + travelUnit * 0.20) + 260),
      dy: size.height * (0.30 + travelUnit * 0.12) + 180,
      trail: 110 + (seed % 90),
    };
    requestMeteorFrame();
    return true;
  }

  drawBackground = function reactiveCosmicBackground(colors, width, height) {
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);
    drawHaze(width, height);
    drawStars(width, height);
    if (!motionReduced()) drawMeteor(width, height);
    ctx.globalAlpha = 1;
    ctx.lineCap = "butt";
  };

  function snapshot() {
    const size = canvasSize();
    const meteor = meteorStateAt(performance.now());
    return {
      reducedMotion: motionReduced(),
      pan: { x: state.pan.x, y: state.pan.y },
      tile: { ...TILE },
      layers: LAYERS.map((layer) => ({ id: layer.id, parallax: effectiveParallax(layer) })),
      nearStar: starPoint(LAYERS[2], 0),
      meteor: meteor ? { active: true, ...meteor } : { active: false },
      viewport: size,
    };
  }

  function syncMotionPreference() {
    if (motionReduced()) {
      clearMeteorTimer();
      runtime.meteor = null;
      if (runtime.meteorFrame !== null) window.cancelAnimationFrame(runtime.meteorFrame);
      runtime.meteorFrame = null;
      draw();
      return;
    }
    scheduleMeteor();
    draw();
  }

  window.ProjectMapCosmicBackground = Object.freeze({
    snapshot,
    spawnMeteor,
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearMeteorTimer();
      return;
    }
    scheduleMeteor();
  });

  window.addEventListener("DOMContentLoaded", () => {
    const media = window.matchMedia?.(REDUCED_MOTION_QUERY);
    media?.addEventListener?.("change", syncMotionPreference);
    document.getElementById("motionToggle")?.addEventListener("click", () => window.setTimeout(syncMotionPreference, 0));
    scheduleMeteor();
    draw();
  });
})();
