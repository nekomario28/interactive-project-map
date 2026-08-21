"use strict";
/* global state, ctx, clamp, draw, drawNodesAndLabels, nodeRadius, nodeOpacity, worldToScreen, displayLabel */

window.addEventListener("DOMContentLoaded", () => {
  const supportedStyles = new Set(["galaxy-systems", "galaxy-hybrid"]);
  const baseDrawNodesAndLabels = drawNodesAndLabels;
  let lastSnapshot = {
    active: false,
    style: null,
    repoCount: 0,
    repoBudget: 0,
    repoLabels: 0,
    totalLabels: 0,
    anchors: {},
    placedRepositoryIds: [],
    zoom: 1,
    viewport: { width: 0, height: 0 },
  };

  function overlap(a, b, padding = 3) {
    return !(a.right + padding < b.left || b.right + padding < a.left || a.bottom + padding < b.top || b.bottom + padding < a.top);
  }

  function visibleBox(box, width, height, margin = 5) {
    return box.left >= margin && box.top >= margin && box.right <= width - margin && box.bottom <= height - margin;
  }

  function textMetrics(text, fontSize, weight) {
    ctx.font = `${weight} ${fontSize}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
    const measured = ctx.measureText(text);
    return { width: Math.ceil(measured.width) + 10, height: fontSize + 7 };
  }

  function anchorBoxes(point, radius, width, height) {
    const gap = Math.max(6, radius + 6);
    return [
      { anchor: "bottom", x: point.x, y: point.y + gap, left: point.x - width / 2, right: point.x + width / 2, top: point.y + gap, bottom: point.y + gap + height, align: "center" },
      { anchor: "right", x: point.x + gap, y: point.y - height / 2, left: point.x + gap, right: point.x + gap + width, top: point.y - height / 2, bottom: point.y + height / 2, align: "left" },
      { anchor: "top", x: point.x, y: point.y - gap - height, left: point.x - width / 2, right: point.x + width / 2, top: point.y - gap - height, bottom: point.y - gap, align: "center" },
      { anchor: "left", x: point.x - gap, y: point.y - height / 2, left: point.x - gap - width, right: point.x - gap, top: point.y - height / 2, bottom: point.y + height / 2, align: "right" },
    ];
  }

  function directRepositoryIds() {
    const snapshot = window.ProjectMapSearchContext?.snapshot?.();
    return new Set(Array.isArray(snapshot?.directRepositoryIds) ? snapshot.directRepositoryIds : []);
  }

  function labelPriority(node, highlighted, directMatch) {
    if (highlighted) return 10000;
    if (node.type === "owner") return 9000;
    if (node.type === "group") return 8000 + (node.repositoryCount || 0) * 4;
    if (directMatch) return 7000;
    return 100 + Math.min(200, node.stars || 0) * 3 + (node.fork ? 0 : 18) + (node.archived ? -12 : 0);
  }

  function labelText(node) {
    if (state.style === "galaxy-systems" && node.type === "group") return `${displayLabel(node)} · ${node.repositoryCount || 0}`;
    return displayLabel(node);
  }

  function fontWeight(node) {
    if (node.type === "owner") return 700;
    if (node.type === "group") return state.style === "galaxy-systems" ? 650 : 600;
    return 500;
  }

  function adaptiveRepoBudget(area, repoCount) {
    if (repoCount <= 0) return 0;
    const density = repoCount / Math.max(1, area / 100000);
    const densityPenalty = 1 / Math.sqrt(Math.max(1, density / 8));
    const zoomGain = clamp(0.72 + state.zoom * 1.35, 0.72, 2.2);
    const raw = (area / 14500) * densityPenalty * zoomGain;
    return Math.min(repoCount, Math.max(12, Math.round(raw)));
  }

  function drawAdaptiveLabels(colors) {
    const rect = ctx.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const area = width * height;
    const repoCount = state.nodes.filter((node) => node.type === "repository").length;
    const repoBudget = adaptiveRepoBudget(area, repoCount);
    const directIds = directRepositoryIds();
    const candidates = [];

    for (const node of state.nodes) {
      const point = worldToScreen(node.x, node.y);
      const highlighted = node === state.selected || node === state.hovered;
      const radius = Math.max(3.5, nodeRadius(node) * state.zoom * (highlighted ? 1.14 : 1));
      const opacity = typeof nodeOpacity === "function" ? nodeOpacity(node) : (node.archived ? 0.72 : 1);
      const directMatch = directIds.has(node.id);
      const fontSize = clamp((node.type === "owner" ? 14 : node.type === "group" ? 12 : 11) * Math.sqrt(state.zoom), 9, 15);
      const weight = fontWeight(node);
      const text = labelText(node);
      const measured = textMetrics(text, fontSize, weight);
      candidates.push({
        node,
        point,
        radius,
        opacity,
        highlighted,
        directMatch,
        fontSize,
        weight,
        text,
        measured,
        priority: labelPriority(node, highlighted, directMatch),
      });
    }

    candidates.sort((a, b) => b.priority - a.priority || a.node.label.localeCompare(b.node.label));
    const occupied = [];
    const anchorCounts = {};
    const placedRepositoryIds = [];
    let repoLabels = 0;

    for (const candidate of candidates) {
      const forced = candidate.highlighted || candidate.node.type !== "repository" || candidate.directMatch;
      if (candidate.node.type === "repository" && !forced && repoLabels >= repoBudget) continue;

      const boxes = anchorBoxes(candidate.point, candidate.radius, candidate.measured.width, candidate.measured.height);
      const order = candidate.node.type === "group" ? [2, 0, 1, 3] : [0, 1, 2, 3];
      let chosen = null;
      for (const index of order) {
        const box = boxes[index];
        if (!visibleBox(box, width, height)) continue;
        if (!occupied.some((other) => overlap(box, other, forced ? 1 : 3))) {
          chosen = box;
          break;
        }
      }
      if (!chosen && forced) chosen = boxes.find((box) => visibleBox(box, width, height)) || boxes[0];
      if (!chosen) continue;

      occupied.push(chosen);
      anchorCounts[chosen.anchor] = (anchorCounts[chosen.anchor] || 0) + 1;
      if (candidate.node.type === "repository") {
        repoLabels += 1;
        placedRepositoryIds.push(candidate.node.id);
      }

      ctx.globalAlpha = Math.max(candidate.opacity, forced ? 0.86 : 0);
      ctx.font = `${candidate.weight} ${candidate.fontSize}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
      ctx.textAlign = chosen.align;
      ctx.textBaseline = "top";
      ctx.lineWidth = state.style === "galaxy-systems" ? 3.1 : 3;
      ctx.strokeStyle = colors.background;
      ctx.strokeText(candidate.text, chosen.x, chosen.y);
      ctx.fillStyle = candidate.node.type === "group"
        ? (state.style === "galaxy-systems" ? colors.group : colors.muted)
        : colors.text;
      ctx.fillText(candidate.text, chosen.x, chosen.y);
    }
    ctx.globalAlpha = 1;

    lastSnapshot = {
      active: true,
      style: state.style,
      repoCount,
      repoBudget,
      repoLabels,
      totalLabels: occupied.length,
      anchors: { ...anchorCounts },
      placedRepositoryIds: [...placedRepositoryIds],
      zoom: state.zoom,
      viewport: { width, height },
    };
  }

  drawNodesAndLabels = function adaptiveTextOnlyNodesAndLabels(colors) {
    if (!supportedStyles.has(state.style)) {
      lastSnapshot = { ...lastSnapshot, active: false, style: state.style };
      baseDrawNodesAndLabels(colors);
      return;
    }

    const originalFillText = ctx.fillText;
    const originalStrokeText = ctx.strokeText;
    ctx.fillText = () => {};
    ctx.strokeText = () => {};
    try {
      baseDrawNodesAndLabels(colors);
    } finally {
      ctx.fillText = originalFillText;
      ctx.strokeText = originalStrokeText;
    }
    drawAdaptiveLabels(colors);
  };

  window.ProjectMapAdaptiveLabels = Object.freeze({
    supports(style) {
      return supportedStyles.has(style);
    },
    snapshot() {
      return {
        ...lastSnapshot,
        anchors: { ...lastSnapshot.anchors },
        placedRepositoryIds: [...lastSnapshot.placedRepositoryIds],
        viewport: { ...lastSnapshot.viewport },
      };
    },
  });

  draw();
}, { once: true });
