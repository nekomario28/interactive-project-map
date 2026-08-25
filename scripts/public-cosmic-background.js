"use strict";
/* global state, canvas, ctx, hash, username, drawBackground, draw, canvasSize, worldToScreen */

(() => {
  const TILE = { width: 960, height: 720 };
  const HAZE_TILE = { width: 1680, height: 1180 };
  const HAZE_DEPTH = 0.035;
  const GALAXY_DUST_COUNT = 64;
  const LAYERS = Object.freeze([
    { id: "far", count: 46, depth: 0.08, radius: [0.38, 0.72], opacity: [0.10, 0.22] },
    { id: "mid", count: 36, depth: 0.18, radius: [0.52, 1.02], opacity: [0.12, 0.28] },
    { id: "near", count: 24, depth: 0.32, radius: [0.72, 1.42], opacity: [0.15, 0.34] },
  ]);
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
  const METEOR_MIN_DELAY = 22_000;
  const METEOR_DELAY_SPAN = 34_000;
  const runtime = {
    meteor: null,
    meteorSequence: 0,
    meteorTimer: null,
    meteorFrame: null,
    envelopeGraph: null,
    envelopeStyle: "",
    envelopeWorldRadius: 0,
  };

  function unit(seed) {
    return (seed >>> 0) / 0xffffffff;
  }

  function range(seed, minimum, maximum) {
    return minimum + (maximum - minimum) * unit(seed);
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function wrap(value, size) {
    return ((value % size) + size) % size;
  }

  function motionReduced() {
    return Boolean(window.matchMedia?.(REDUCED_MOTION_QUERY).matches);
  }

  function effectiveDepth(depth) {
    return motionReduced() ? 0 : depth;
  }

  function cameraDepthTransform(depth) {
    const effective = effectiveDepth(depth);
    if (effective === 0) {
      return { depth: 0, scale: 1, translationFactor: 0, translateX: 0, translateY: 0 };
    }
    const zoom = clamp(Number(state.zoom) || 1, 0.04, 6);
    const scale = Math.pow(zoom, effective);
    const translationFactor = Math.abs(zoom - 1) < 1e-6
      ? effective
      : (scale - 1) / (zoom - 1);
    return {
      depth: effective,
      scale,
      translationFactor,
      translateX: state.pan.x * translationFactor,
      translateY: state.pan.y * translationFactor,
    };
  }

  function layerTile(layer) {
    const transform = cameraDepthTransform(layer.depth);
    return { width: TILE.width * transform.scale, height: TILE.height * transform.scale, scale: transform.scale, transform };
  }

  function scaleAroundViewport(value, center, scale) {
    return center + (value - center) * scale;
  }

  function starPoint(layer, index, width, height) {
    const tile = layerTile(layer);
    const xSeed = hash(`${username}:cosmic:${layer.id}:x:${index}`);
    const ySeed = hash(`${username}:cosmic:${layer.id}:y:${index}`);
    const baseX = unit(xSeed) * TILE.width;
    const baseY = unit(ySeed) * TILE.height;
    return {
      x: wrap(scaleAroundViewport(baseX, width / 2, tile.scale) + tile.transform.translateX, tile.width),
      y: wrap(scaleAroundViewport(baseY, height / 2, tile.scale) + tile.transform.translateY, tile.height),
      radius: range(hash(`${username}:cosmic:${layer.id}:r:${index}`), layer.radius[0], layer.radius[1]) * Math.sqrt(tile.scale),
      opacity: range(hash(`${username}:cosmic:${layer.id}:o:${index}`), layer.opacity[0], layer.opacity[1]),
      tile,
    };
  }

  function forEachWrappedCopy(point, width, height, callback) {
    const tile = point.tile || TILE;
    const maxX = Math.ceil(width / tile.width) + 1;
    const maxY = Math.ceil(height / tile.height) + 1;
    for (let tileX = -1; tileX <= maxX; tileX += 1) {
      const x = point.x + tileX * tile.width;
      if (x < -3 || x > width + 3) continue;
      for (let tileY = -1; tileY <= maxY; tileY += 1) {
        const y = point.y + tileY * tile.height;
        if (y < -3 || y > height + 3) continue;
        callback(x, y);
      }
    }
  }

  function firstVisibleStar(layer, width, height) {
    const count = width < 720 ? Math.ceil(layer.count * 0.68) : layer.count;
    for (let index = 0; index < count; index += 1) {
      const point = starPoint(layer, index, width, height);
      let visible = null;
      forEachWrappedCopy(point, width, height, (x, y) => {
        if (!visible && x >= 2 && x <= width - 2 && y >= 2 && y <= height - 2) visible = { x, y };
      });
      if (visible) return { ...point, ...visible, index };
    }
    return null;
  }

  function drawStars(width, height) {
    const compact = width < 720;
    ctx.fillStyle = "#dce9ff";
    for (const layer of LAYERS) {
      const count = compact ? Math.ceil(layer.count * 0.68) : layer.count;
      for (let index = 0; index < count; index += 1) {
        const point = starPoint(layer, index, width, height);
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

  function hazeScale() {
    return cameraDepthTransform(HAZE_DEPTH).scale;
  }

  function hazePoint(index, transform, tile, width, height) {
    const baseX = unit(hash(`${username}:haze:x:${index}`)) * HAZE_TILE.width;
    const baseY = unit(hash(`${username}:haze:y:${index}`)) * HAZE_TILE.height;
    return {
      x: wrap(scaleAroundViewport(baseX, width / 2, tile.scale) + transform.translateX, tile.width),
      y: wrap(scaleAroundViewport(baseY, height / 2, tile.scale) + transform.translateY, tile.height),
    };
  }

  function drawHaze(width, height) {
    const obsidian = state.style === "obsidian";
    const tint = obsidian ? [124, 110, 246] : [82, 126, 216];
    const alpha = obsidian ? 0.050 : 0.032;
    const transform = cameraDepthTransform(HAZE_DEPTH);
    const scale = hazeScale();
    const tile = { width: HAZE_TILE.width * scale, height: HAZE_TILE.height * scale, scale };
    const radius = Math.max(340, Math.min(560, Math.max(width, height) * 0.48)) * Math.sqrt(scale);
    const copiesX = Math.ceil(width / tile.width) + 1;
    const copiesY = Math.ceil(height / tile.height) + 1;

    for (let index = 0; index < 2; index += 1) {
      const base = hazePoint(index, transform, tile, width, height);
      for (let tileX = -1; tileX <= copiesX; tileX += 1) {
        const x = base.x + tileX * tile.width;
        if (x < -radius || x > width + radius) continue;
        for (let tileY = -1; tileY <= copiesY; tileY += 1) {
          const y = base.y + tileY * tile.height;
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

  function measuredSceneWorldRadius() {
    let radius = 0;
    if (Array.isArray(state.nodes)) {
      for (const node of state.nodes) {
        if (!Number.isFinite(node?.x) || !Number.isFinite(node?.y)) continue;
        radius = Math.max(radius, Math.hypot(node.x, node.y));
      }
    }
    return clamp((radius || 330) + 150, 320, 1800);
  }

  function sceneWorldRadius() {
    const style = String(state.style || "");
    if (runtime.envelopeGraph !== state.graph || runtime.envelopeStyle !== style || runtime.envelopeWorldRadius <= 0) {
      runtime.envelopeGraph = state.graph;
      runtime.envelopeStyle = style;
      runtime.envelopeWorldRadius = measuredSceneWorldRadius();
    }
    return runtime.envelopeWorldRadius;
  }

  function galaxyEnvelope() {
    const size = canvasSize();
    const center = worldToScreen(0, 0);
    const worldRadius = sceneWorldRadius();
    const rawRadius = worldRadius * clamp(Number(state.zoom) || 1, 0.04, 6) * 1.08;
    return {
      center,
      worldRadius,
      screenRadius: clamp(rawRadius, 150, Math.max(size.width, size.height) * 2.8),
      angle: (unit(hash(`${username}:galaxy-envelope:angle`)) - 0.5) * 0.5,
      viewport: size,
    };
  }

  function drawGalaxyDust(radius, core) {
    const radiusScale = clamp(radius / 720, 0.72, 1.3);
    ctx.fillStyle = `rgb(${core[0]},${core[1]},${core[2]})`;
    for (let index = 0; index < GALAXY_DUST_COUNT; index += 1) {
      const angle = unit(hash(`${username}:galaxy-dust:a:${index}`)) * Math.PI * 2;
      const radial = Math.sqrt(unit(hash(`${username}:galaxy-dust:d:${index}`)));
      const distance = radius * (0.13 + radial * 0.72);
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance * 0.82;
      const opacity = range(hash(`${username}:galaxy-dust:o:${index}`), 0.010, 0.038) * (1 - radial * 0.38);
      const pointRadius = range(hash(`${username}:galaxy-dust:r:${index}`), 0.42, 1.16) * radiusScale;
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.arc(x, y, pointRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawGalaxyEnvelope(width, height) {
    if (!state.graph || !Array.isArray(state.nodes) || state.nodes.length === 0) return;
    const envelope = galaxyEnvelope();
    const { center, screenRadius: radius, angle } = envelope;
    if (center.x < -radius || center.x > width + radius || center.y < -radius || center.y > height + radius) return;

    const obsidian = state.style === "obsidian";
    const tint = obsidian ? [126, 104, 238] : [62, 113, 211];
    const core = obsidian ? [176, 146, 255] : [112, 177, 255];

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(angle);
    ctx.scale(1, 0.58);

    const halo = ctx.createRadialGradient(0, 0, radius * 0.04, 0, 0, radius);
    halo.addColorStop(0, `rgba(${core[0]},${core[1]},${core[2]},${obsidian ? 0.050 : 0.058})`);
    halo.addColorStop(0.34, `rgba(${tint[0]},${tint[1]},${tint[2]},${obsidian ? 0.040 : 0.047})`);
    halo.addColorStop(0.72, `rgba(${tint[0]},${tint[1]},${tint[2]},0.018)`);
    halo.addColorStop(1, `rgba(${tint[0]},${tint[1]},${tint[2]},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

    const lobeRadius = radius * 0.56;
    for (const direction of [-1, 1]) {
      const x = direction * radius * 0.24;
      const lobe = ctx.createRadialGradient(x, 0, 0, x, 0, lobeRadius);
      lobe.addColorStop(0, `rgba(${core[0]},${core[1]},${core[2]},0.024)`);
      lobe.addColorStop(0.55, `rgba(${tint[0]},${tint[1]},${tint[2]},0.012)`);
      lobe.addColorStop(1, `rgba(${tint[0]},${tint[1]},${tint[2]},0)`);
      ctx.fillStyle = lobe;
      ctx.fillRect(x - lobeRadius, -lobeRadius, lobeRadius * 2, lobeRadius * 2);
    }

    drawGalaxyDust(radius, core);
    ctx.restore();
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
    drawGalaxyEnvelope(width, height);
    drawStars(width, height);
    if (!motionReduced()) drawMeteor(width, height);
    ctx.globalAlpha = 1;
    ctx.lineCap = "butt";
  };

  function cameraFixedPoint(size = canvasSize()) {
    const zoom = clamp(Number(state.zoom) || 1, 0.04, 6);
    if (Math.abs(zoom - 1) < 1e-6) return null;
    return {
      x: size.width / 2 - state.pan.x / (zoom - 1),
      y: size.height / 2 - state.pan.y / (zoom - 1),
    };
  }

  function snapshot() {
    const size = canvasSize();
    const meteor = meteorStateAt(performance.now());
    const envelope = state.graph ? galaxyEnvelope() : null;
    return {
      reducedMotion: motionReduced(),
      pan: { x: state.pan.x, y: state.pan.y },
      zoom: state.zoom,
      tile: { ...TILE },
      layers: LAYERS.map((layer) => {
        const transform = cameraDepthTransform(layer.depth);
        return {
          id: layer.id,
          depth: layer.depth,
          parallax: transform.depth,
          zoomParallax: layer.depth,
          zoomScale: transform.scale,
          translationFactor: transform.translationFactor,
        };
      }),
      cameraFixedPoint: cameraFixedPoint(size),
      nearStar: firstVisibleStar(LAYERS[2], size.width, size.height),
      envelope,
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
