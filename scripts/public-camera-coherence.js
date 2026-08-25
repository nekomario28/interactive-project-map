"use strict";
/* global state, canvas, canvasSize, screenToWorld, worldToScreen, draw */

(() => {
  const LINE_PIXELS = 16;
  const MAX_WHEEL_PIXELS = 140;
  const WHEEL_SENSITIVITY = 0.00145;
  const KEY_ZOOM_FACTOR = 1.16;
  const PAN_GUARD_FRACTION = 0.18;
  const PAN_GUARD_MIN_PIXELS = 56;
  const PAN_GUARD_MAX_PIXELS = 144;
  const PAN_OVERSCROLL_RESISTANCE = 0.2;

  function clampValue(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function normalizedWheelPixels(event) {
    let pixels = Number(event.deltaY) || 0;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) pixels *= LINE_PIXELS;
    else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) pixels *= Math.min(900, canvasSize().height);
    return clampValue(pixels, -MAX_WHEEL_PIXELS, MAX_WHEEL_PIXELS);
  }

  function sceneBounds() {
    if (!Array.isArray(state.nodes) || state.nodes.length === 0) return null;
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
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
    return { minX, minY, maxX, maxY };
  }

  function sceneFitZoom() {
    const bounds = sceneBounds();
    if (!bounds) return 0.42;
    const size = canvasSize();
    const padding = 150;
    const width = Math.max(1, bounds.maxX - bounds.minX + padding * 2);
    const height = Math.max(1, bounds.maxY - bounds.minY + padding * 2);
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

  function panBounds(zoom = state.zoom) {
    const bounds = sceneBounds();
    const size = canvasSize();
    if (!bounds || !Number.isFinite(zoom) || zoom <= 0) {
      return { active: false, guardX: 0, guardY: 0, minX: state.pan.x, maxX: state.pan.x, minY: state.pan.y, maxY: state.pan.y };
    }
    const guardX = clampValue(size.width * PAN_GUARD_FRACTION, PAN_GUARD_MIN_PIXELS, PAN_GUARD_MAX_PIXELS);
    const guardY = clampValue(size.height * PAN_GUARD_FRACTION, PAN_GUARD_MIN_PIXELS, PAN_GUARD_MAX_PIXELS);
    return {
      active: true,
      guardX,
      guardY,
      minX: guardX - size.width / 2 - bounds.maxX * zoom,
      maxX: size.width - guardX - size.width / 2 - bounds.minX * zoom,
      minY: guardY - size.height / 2 - bounds.maxY * zoom,
      maxY: size.height - guardY - size.height / 2 - bounds.minY * zoom,
    };
  }

  function resistedPanValue(value, minimum, maximum) {
    if (value < minimum) return minimum + (value - minimum) * PAN_OVERSCROLL_RESISTANCE;
    if (value > maximum) return maximum + (value - maximum) * PAN_OVERSCROLL_RESISTANCE;
    return value;
  }

  function constrainPan({ elastic = false, redraw = true } = {}) {
    const limits = panBounds();
    if (!limits.active) return snapshot();
    const nextX = elastic
      ? resistedPanValue(state.pan.x, limits.minX, limits.maxX)
      : clampValue(state.pan.x, limits.minX, limits.maxX);
    const nextY = elastic
      ? resistedPanValue(state.pan.y, limits.minY, limits.maxY)
      : clampValue(state.pan.y, limits.minY, limits.maxY);
    const changed = Math.abs(nextX - state.pan.x) >= 1e-9 || Math.abs(nextY - state.pan.y) >= 1e-9;
    state.pan.x = nextX;
    state.pan.y = nextY;
    if (changed && redraw) draw();
    return snapshot();
  }

  function reanchorZoom(screenX, screenY, nextZoom, { redraw = true } = {}) {
    const before = screenToWorld(screenX, screenY);
    state.zoom = nextZoom;
    const after = worldToScreen(before.x, before.y);
    state.pan.x += screenX - after.x;
    state.pan.y += screenY - after.y;
    constrainPan({ redraw: false });
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
    if (Math.abs(nextZoom - state.zoom) < 1e-9) return constrainPan({ redraw });
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
    const pointerCount = state.pointers?.size || 0;
    if (pointerCount === 2) {
      // The base viewer owns pinch distance and the primary pinch transform.
      // Run after that event dispatch so every input path shares the same bounds.
      queueMicrotask(() => {
        if (state.pointers?.size !== 2) return;
        const pair = [...state.pointers.values()];
        if (pair.length < 2) return;
        const midpoint = { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 };
        enforceZoomBoundsAt(midpoint.x, midpoint.y);
      });
      return;
    }
    if (pointerCount === 1 && state.panning) {
      // Keep base-viewer pan ownership, but compress overscroll after its move.
      queueMicrotask(() => constrainPan({ elastic: true }));
    }
  }

  function handlePointerEndBounds() {
    const shouldSettle = Boolean(state.panning) || (state.pointers?.size || 0) >= 2;
    if (!shouldSettle) return;
    queueMicrotask(() => constrainPan());
  }

  function snapshot() {
    const limits = zoomLimits();
    return {
      zoom: state.zoom,
      pan: { x: state.pan.x, y: state.pan.y },
      limits,
      panLimits: panBounds(),
    };
  }

  canvas.addEventListener("wheel", handleWheel, { capture: true, passive: false });
  canvas.addEventListener("keydown", handleKeyboard, { capture: true });
  canvas.addEventListener("pointermove", handlePointerMoveBounds, { capture: true, passive: true });
  canvas.addEventListener("pointerup", handlePointerEndBounds, { capture: true, passive: true });
  canvas.addEventListener("pointercancel", handlePointerEndBounds, { capture: true, passive: true });
  canvas.addEventListener("lostpointercapture", handlePointerEndBounds, { capture: true, passive: true });

  window.ProjectMapCameraCoherence = Object.freeze({
    normalizedWheelPixels,
    sceneFitZoom,
    zoomLimits,
    panBounds,
    constrainPan,
    zoomAt,
    enforceZoomBoundsAt,
    snapshot,
  });
})();
