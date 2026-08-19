"use strict";
/* global canvas, state, draw, drawRepoLabels, matches, ctx, clamp */

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

  if (style === "sunburst" || typeof canvas === "undefined" || typeof state === "undefined") return;

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  // Galaxy nodes are scenery/data points, not draggable objects. A drag that
  // starts on a node becomes viewport panning once it passes the click slop.
  canvas.addEventListener("pointermove", (event) => {
    if (state.style !== "galaxy" || state.pointers.size !== 1 || !state.drag || !state.pointers.has(event.pointerId)) return;
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

  let releaseAnchor = null;

  // Obsidian-like dragging should not snap when the pointer is released.
  // Hold the dropped node briefly while its local force neighborhood settles,
  // then fade the anchor out after the force simulation has cooled.
  canvas.addEventListener("pointerup", () => {
    if (state.style !== "obsidian" || !state.drag || !state.moved) return;
    releaseAnchor = {
      node: state.drag,
      x: state.drag.x,
      y: state.drag.y,
      startedAt: performance.now(),
      duration: 520,
    };
    releaseAnchor.node.vx = 0;
    releaseAnchor.node.vy = 0;
  }, true);

  window.addEventListener("DOMContentLoaded", () => {
    function softenObsidianRelease(now) {
      if (releaseAnchor) {
        if (state.style !== "obsidian" || !state.nodes.includes(releaseAnchor.node)) {
          releaseAnchor = null;
        } else {
          const elapsed = now - releaseAnchor.startedAt;
          if (elapsed >= releaseAnchor.duration) {
            releaseAnchor.node.vx *= 0.2;
            releaseAnchor.node.vy *= 0.2;
            releaseAnchor = null;
          } else {
            const holdEnd = 150;
            const fade = elapsed <= holdEnd ? 1 : 1 - (elapsed - holdEnd) / (releaseAnchor.duration - holdEnd);
            const strength = 0.18 + 0.82 * Math.max(0, Math.min(1, fade));
            releaseAnchor.node.x += (releaseAnchor.x - releaseAnchor.node.x) * strength;
            releaseAnchor.node.y += (releaseAnchor.y - releaseAnchor.node.y) * strength;
            releaseAnchor.node.vx *= 0.12;
            releaseAnchor.node.vy *= 0.12;
            if (typeof draw === "function") draw();
          }
        }
      }
      requestAnimationFrame(softenObsidianRelease);
    }
    requestAnimationFrame(softenObsidianRelease);
  }, { once: true });
})();
