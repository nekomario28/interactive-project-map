"use strict";
/* global state, canvas, canvasSize, screenToWorld, worldToScreen, draw */

(() => {
  const LINE_PIXELS = 16;
  const MAX_WHEEL_PIXELS = 140;
  const WHEEL_SENSITIVITY = 0.00145;

  function clampValue(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function normalizedWheelPixels(event) {
    let pixels = Number(event.deltaY) || 0;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) pixels *= LINE_PIXELS;
    else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) pixels *= Math.min(900, canvasSize().height);
    return clampValue(pixels, -MAX_WHEEL_PIXELS, MAX_WHEEL_PIXELS);
  }

  function sceneFitZoom() {
    if (!Array.isArray(state.nodes) || state.nodes.length === 0) return 0.42;
    const size = canvasSize();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of state.nodes) {
      if (!Number.isFinite(node?.x) || !Number.isFinite(node?.y)) continue;
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x);
      maxY = Math.max(maxY, node.y);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return 0.42;
    const padding = 150;
    const width = Math.max(1, maxX - minX + padding * 2);
    const height = Math.max(1, maxY - minY + padding * 2);
    return clampValue(Math.min((size.width * 0.84) / width, (size.height * 0.78) / height), 0.04, 2.2);
  }

  function zoomLimits() {
    const fit = sceneFitZoom();
    return {
      fit,
      min: clampValue(fit * 0.46, 0.08, 0.72),
      max: clampValue(Math.max(4.5, fit * 5.2), 4.5, 6),
    };
  }

  function zoomAt(screenX, screenY, factor, { redraw = true } = {}) {
    if (!Number.isFinite(factor) || factor <= 0) return snapshot();
    const before = screenToWorld(screenX, screenY);
    const limits = zoomLimits();
    state.zoom = clampValue(state.zoom * factor, limits.min, limits.max);
    const after = worldToScreen(before.x, before.y);
    state.pan.x += screenX - after.x;
    state.pan.y += screenY - after.y;
    if (redraw) draw();
    return snapshot();
  }

  function handleWheel(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const pixels = normalizedWheelPixels(event);
    zoomAt(screenX, screenY, Math.exp(-pixels * WHEEL_SENSITIVITY));
  }

  function snapshot() {
    const limits = zoomLimits();
    return {
      zoom: state.zoom,
      pan: { x: state.pan.x, y: state.pan.y },
      limits,
    };
  }

  canvas.addEventListener("wheel", handleWheel, { capture: true, passive: false });

  window.ProjectMapCameraCoherence = Object.freeze({
    normalizedWheelPixels,
    sceneFitZoom,
    zoomLimits,
    zoomAt,
    snapshot,
  });
})();
