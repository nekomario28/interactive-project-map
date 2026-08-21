"use strict";
/* global state, ctx, clamp, draw, drawNodesAndLabels, nodeRadius, nodeOpacity, nodeColor, worldToScreen, displayLabel */

window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const params = new URL(location.href).searchParams;
    if (params.get("labels") !== "soft" || state.style !== "galaxy-systems") return;

    const baseDrawNodesAndLabels = drawNodesAndLabels;

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

    function priority(node, highlighted, directMatch) {
      if (highlighted) return 10000;
      if (node.type === "owner") return 9000;
      if (node.type === "group") return 8000 + (node.repositoryCount || 0) * 4;
      if (directMatch) return 7000;
      return 100 + Math.min(200, node.stars || 0) * 3 + (node.fork ? 0 : 18) + (node.archived ? -12 : 0);
    }

    drawNodesAndLabels = function adaptiveSoftSystemLabels(colors) {
      if (state.style !== "galaxy-systems") return baseDrawNodesAndLabels(colors);

      const rect = ctx.canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const area = width * height;
      const repoCount = state.nodes.filter((node) => node.type === "repository").length;
      const searchApi = window.ProjectMapSearchContext;
      const directIds = new Set(searchApi?.snapshot?.().directRepositoryIds || []);
      const candidates = [];

      for (const node of state.nodes) {
        const point = worldToScreen(node.x, node.y);
        const highlighted = node === state.selected || node === state.hovered;
        const radius = Math.max(3.5, nodeRadius(node) * state.zoom * (highlighted ? 1.14 : 1));
        const opacity = typeof nodeOpacity === "function" ? nodeOpacity(node) : (node.archived ? 0.72 : 1);
        ctx.globalAlpha = opacity;
        ctx.fillStyle = nodeColor(node, colors);
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (node.type === "repository" && node.archived) {
          ctx.strokeStyle = colors.archived;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius + 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (highlighted) {
          ctx.globalAlpha = Math.max(opacity, 0.82);
          ctx.strokeStyle = colors.selection;
          ctx.lineWidth = node === state.selected ? 2 : 1.2;
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius + 5, 0, Math.PI * 2);
          ctx.stroke();
        }

        const directMatch = directIds.has(node.id);
        const always = node.type !== "repository" || highlighted || directMatch;
        const densityZoomFloor = repoCount > 140 ? 0.63 : repoCount > 90 ? 0.52 : repoCount > 55 ? 0.40 : 0.30;
        if (!always && state.zoom < densityZoomFloor) continue;

        const fontSize = clamp((node.type === "owner" ? 14 : node.type === "group" ? 12 : 10.5) * Math.sqrt(state.zoom), 8.5, 15);
        const weight = node.type === "owner" ? 700 : node.type === "group" ? 650 : directMatch ? 650 : 500;
        const text = node.type === "group" ? `${displayLabel(node)} · ${node.repositoryCount || 0}` : displayLabel(node);
        const measured = textMetrics(text, fontSize, weight);
        candidates.push({ node, point, radius, fontSize, weight, text, opacity, directMatch, highlighted, measured, priority: priority(node, highlighted, directMatch) });
      }
      ctx.globalAlpha = 1;

      candidates.sort((a, b) => b.priority - a.priority || a.node.label.localeCompare(b.node.label));
      const occupied = [];
      let repoLabels = 0;
      const adaptiveBudget = clamp(Math.floor(area / 16500), 18, 78);
      const zoomBudget = Math.max(1, state.zoom / 0.42);
      const repoBudget = Math.min(repoCount, Math.round(adaptiveBudget * clamp(zoomBudget, 0.72, 1.9)));

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
        if (candidate.node.type === "repository") repoLabels += 1;
        ctx.globalAlpha = Math.max(candidate.opacity, forced ? 0.90 : 0.72);
        ctx.font = `${candidate.weight} ${candidate.fontSize}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
        ctx.textAlign = chosen.align;
        ctx.textBaseline = "top";
        ctx.lineWidth = 3;
        ctx.strokeStyle = colors.background;
        ctx.strokeText(candidate.text, chosen.x, chosen.y);
        ctx.fillStyle = candidate.node.type === "group" ? colors.group : colors.text;
        ctx.fillText(candidate.text, chosen.x, chosen.y);
      }
      ctx.globalAlpha = 1;

      window.ProjectMapSoftLabelDebug = {
        repoCount,
        repoBudget,
        repoLabels,
        totalLabels: occupied.length,
        zoom: state.zoom,
        viewport: { width, height },
      };
    };

    draw();
  }, 0);
}, { once: true });
