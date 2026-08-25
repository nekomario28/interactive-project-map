"use strict";
/* global state, canvas, canvasSize, screenToWorld, worldToScreen, draw */

(() => {
  const LINE_PIXELS = 16;
  const MAX_WHEEL_PIXELS = 140;
  const WHEEL_SENSITIVITY = 0.00145;
  const KEY_ZOOM_FACTOR = 1.16;

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

  function reanchorZoom(screenX, screenY, nextZoom, { redraw = true } = {}) {
    const before = screenToWorld(screenX, screenY);
    state.zoom = nextZoom;
    const after = worldToScreen(before.x, before.y);
    state.pan.x += screenX - after.x;
    state.pan.y += screenY - after.y;
    if (redraw) draw();
    return snapshot();
  }

  function zoomAt(screenX, screenY, factor, { redraw = true } = {}) {
    if (!Number.isFinite(factor) || factor <= 0) return snapshot();
    const limits = zoomLimits();
    const nextZoom = clampValue(state.zoom * factor, limits.min, limits.max);
    return reanchorZoom(screenX, screenY, nextZoom, { redraw });
  }

  function enforceZoomBoundsAt(screenX, screenY, { redraw = true } = {}) {
    const limits = zoomLimits();
    const nextZoom = clampValue(state.zoom, limits.min, limits.max);
    if (Math.abs(nextZoom - state.zoom) < 1e-9) return snapshot();
    return reanchorZoom(screenX, screenY, nextZoom, { redraw });
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

  function handleKeyboard(event) {
    if (!["+", "=", "-"].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const size = canvasSize();
    zoomAt(size.width / 2, size.height / 2, event.key === "-" ? 1 / KEY_ZOOM_FACTOR : KEY_ZOOM_FACTOR);
  }

  function handlePointerMoveBounds() {
    if (state.pointers?.size !== 2) return;
    // The base viewer owns pinch distance and the primary pinch transform.
    // Run after that event dispatch so every input path shares the same bounds.
    queueMicrotask(() => {
      if (state.pointers?.size !== 2) return;
      const pair = [...state.pointers.values()];
      if (pair.length < 2) return;
      const midpoint = { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 };
      enforceZoomBoundsAt(midpoint.x, midpoint.y);
    });
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
  canvas.addEventListener("keydown", handleKeyboard, { capture: true });
  canvas.addEventListener("pointermove", handlePointerMoveBounds, { capture: true, passive: true });

  window.ProjectMapCameraCoherence = Object.freeze({
    normalizedWheelPixels,
    sceneFitZoom,
    zoomLimits,
    zoomAt,
    enforceZoomBoundsAt,
    snapshot,
  });
})();
