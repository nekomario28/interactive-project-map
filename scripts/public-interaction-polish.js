"use strict";
/* global canvas, state, drawRepoLabels, matches, ctx, clamp, hitTest, updateDetails */

(() => {
  const style = document.body.dataset.mapStyle;

  // Sunburst: keep every repository label visible and orient labels radially,
  // matching the conventional Sunburst reading direction (center -> outside).
  if (style === "sunburst" && typeof drawRepoLabels === "function") {
    drawRepoLabels = function readableRadialRepoLabels(colors, origin, outer, repoInner) {
      const labelRadius = repoInner + (outer - repoInner) * 0.53;
      for (const repo of state.segments) {
        const highlighted = repo === state.selected || repo === state.hovered;
        const span = Math.max(0.001, repo.end - repo.start);
        const mid = (repo.start + repo.end) / 2;
        const x = origin.x + Math.cos(mid) * labelRadius;
        const y = origin.y + Math.sin(mid) * labelRadius;
        const arcRoom = Math.max(5.8, labelRadius * span * 0.82);
        const radialRoom = Math.max(30, outer - repoInner - 10);
        const lengthFit = radialRoom / Math.max(1, repo.label.length * 0.56);
        const fontSize = clamp(Math.min(highlighted ? 11.8 : 10.4, arcRoom, Math.max(7.1, lengthFit)), 7.1, 12.2);
        const flipped = Math.cos(mid) < 0;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(flipped ? mid + Math.PI : mid);
        ctx.globalAlpha = matches(repo) ? (highlighted ? 1 : 0.96) : 0.12;
        ctx.font = `${highlighted ? 750 : 650} ${fontSize}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.lineWidth = highlighted ? 3.4 : 2.7;
        ctx.strokeStyle = colors.background;
        ctx.strokeText(repo.label, 0, 0);
        ctx.fillStyle = colors.text;
        ctx.fillText(repo.label, 0, 0);
        ctx.restore();
      }
    };
  }

  if (typeof canvas === "undefined" || typeof state === "undefined") return;

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function isGalaxyPresentationStyle(value) {
    return value === "galaxy" || String(value || "").startsWith("galaxy-");
  }

  // One interaction contract across every canvas preset:
  // - click a selectable item -> focus it (owned by each viewer)
  // - click clean blank space -> clear focus
  // - drag/pan/pinch -> never clear focus on release
  // Obsidian owns the same contract in its dedicated capture-phase runtime, so
  // its stopImmediatePropagation naturally prevents this fallback from double-running.
  const blankPointers = new Map();
  if (typeof hitTest === "function" && typeof updateDetails === "function") {
    canvas.addEventListener("pointerdown", (event) => {
      const point = canvasPoint(event);
      blankPointers.set(event.pointerId, {
        start: point,
        moved: false,
        blank: !hitTest(point.x, point.y),
      });
    }, true);

    canvas.addEventListener("pointermove", (event) => {
      const gesture = blankPointers.get(event.pointerId);
      if (!gesture || gesture.moved) return;
      const point = canvasPoint(event);
      if (Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) >= 6) gesture.moved = true;
    }, true);

    canvas.addEventListener("pointerup", (event) => {
      const gesture = blankPointers.get(event.pointerId);
      blankPointers.delete(event.pointerId);
      if (!gesture || gesture.moved || !gesture.blank) return;
      const point = canvasPoint(event);
      if (!hitTest(point.x, point.y)) updateDetails(null);
    }, true);

    canvas.addEventListener("pointercancel", (event) => blankPointers.delete(event.pointerId), true);
    canvas.addEventListener("lostpointercapture", (event) => blankPointers.delete(event.pointerId), true);
  }

  // Galaxy-family presets are presentation-first: nodes are not draggable. A
  // drag that starts on a node becomes viewport panning after the click slop.
  canvas.addEventListener("pointermove", (event) => {
    if (!isGalaxyPresentationStyle(state.style) || state.pointers.size !== 1 || !state.drag || !state.pointers.has(event.pointerId)) return;
    const point = canvasPoint(event);
    state.pointers.set(event.pointerId, point);
    const distance = Math.hypot(point.x - state.down.x, point.y - state.down.y);
    if (distance < 6) {
      event.stopImmediatePropagation();
      return;
    }
    state.moved = true;
    state.drag = null;
    state.panning = true;
    state.last = state.down;
  }, true);
})();
