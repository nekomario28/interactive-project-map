"use strict";
/* global state, ctx, clamp, draw, drawNodesAndLabels, nodeRadius, nodeOpacity, worldToScreen, displayLabel */

window.addEventListener("DOMContentLoaded", () => {
  const supportedStyles = new Set(["galaxy-systems", "galaxy-hybrid"]);
  const supportedPolicies = new Set(["current", "overview-off", "semantic-lod", "semantic-motion"]);
  const requestedPolicy = new URL(window.location.href).searchParams.get("labelPolicy");
  let activePolicy = supportedPolicies.has(requestedPolicy) ? requestedPolicy : "current";
  const baseDrawNodesAndLabels = drawNodesAndLabels;
  const semanticEligibleRepositoryIds = new Set();
  let lastCamera = null;
  let cameraMovingUntil = 0;
  let lastSnapshot = {
    active: false,
    style: null,
    policy: activePolicy,
    repoCount: 0,
    repoBudget: 0,
    repoLabels: 0,
    totalLabels: 0,
    anchors: {},
    placedRepositoryIds: [],
    eligibleRepositoryIds: [],
    cameraMoving: false,
    zoom: 1,
    viewport: { width: 0, height: 0 },
    typography: {
      repositoryFontSize: 0,
      categoryFontSize: 0,
      categoryCountFontSize: 0,
      categoryToRepositoryRatio: 0,
    },
  };

  function overlap(a, b, padding = 3) {
    return !(a.right + padding < b.left || b.right + padding < a.left || a.bottom + padding < b.top || b.bottom + padding < a.top);
  }

  function visibleBox(box, width, height, margin = 5) {
    return box.left >= margin && box.top >= margin && box.right <= width - margin && box.bottom <= height - margin;
  }

  function smoothstep(edge0, edge1, value) {
    const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function setFont(weight, fontSize) {
    ctx.font = `${weight} ${fontSize}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
  }

  function measuredWidth(text, fontSize, weight) {
    setFont(weight, fontSize);
    return Math.ceil(ctx.measureText(text).width);
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

  function repositoryFontSize() {
    return clamp(11 * Math.sqrt(state.zoom), 9, 15);
  }

  function categoryFontScale() {
    const zoom = Math.max(0.5, state.zoom);
    return clamp(1.6 - Math.log2(zoom) * 0.16, 1.3, 1.62);
  }

  function categoryFontSize() {
    return clamp(repositoryFontSize() * categoryFontScale(), 14, 21);
  }

  function categoryCountFontSize(titleFontSize) {
    return clamp(titleFontSize * 0.72, 10, 14);
  }

  function fontSizeFor(node) {
    if (node.type === "owner") return clamp(14 * Math.sqrt(state.zoom), 11, 18);
    if (node.type === "group") return categoryFontSize();
    return repositoryFontSize();
  }

  function fontWeight(node) {
    if (node.type === "owner") return 700;
    if (node.type === "group") return 700;
    return 500;
  }

  function labelPresentation(node, fontSize, weight) {
    const title = displayLabel(node);
    if (state.style === "galaxy-systems" && node.type === "group") {
      const count = `· ${node.repositoryCount || 0}`;
      const countFontSize = categoryCountFontSize(fontSize);
      const titleWidth = measuredWidth(title, fontSize, weight);
      const countWidth = measuredWidth(count, countFontSize, 550);
      return {
        title,
        count,
        countFontSize,
        titleWidth,
        width: titleWidth + 6 + countWidth + 10,
        height: fontSize + 8,
      };
    }
    return {
      title,
      count: "",
      countFontSize: 0,
      titleWidth: 0,
      width: measuredWidth(title, fontSize, weight) + 10,
      height: fontSize + 7,
    };
  }

  function adaptiveRepoBudget(area, repoCount) {
    if (repoCount <= 0) return 0;
    const density = repoCount / Math.max(1, area / 100000);
    const densityPenalty = 1 / Math.sqrt(Math.max(1, density / 8));
    const zoomGain = clamp(0.72 + state.zoom * 1.35, 0.72, 2.2);
    const raw = (area / 14500) * densityPenalty * zoomGain;
    return Math.min(repoCount, Math.max(12, Math.round(raw)));
  }

  function semanticRepoBudget(area, repoCount) {
    if (repoCount <= 0) return 0;
    const detail = smoothstep(10.7, 14.8, repositoryFontSize());
    const density = repoCount / Math.max(1, area / 100000);
    const densityPenalty = 1 / Math.sqrt(Math.max(1, density / 7));
    const fractional = Math.round(repoCount * Math.pow(detail, 1.55));
    const screenCapacity = Math.max(1, Math.floor((area / 39000) * (0.55 + detail * 0.9) * densityPenalty));
    return Math.min(repoCount, fractional, screenCapacity);
  }

  function cameraMotionState(now) {
    const next = {
      zoom: state.zoom,
      x: state.pan?.x || 0,
      y: state.pan?.y || 0,
    };
    if (lastCamera) {
      const changed = Math.abs(next.zoom - lastCamera.zoom) > 0.0005
        || Math.abs(next.x - lastCamera.x) > 0.25
        || Math.abs(next.y - lastCamera.y) > 0.25;
      if (changed) cameraMovingUntil = now + 180;
    }
    lastCamera = next;
    return now < cameraMovingUntil;
  }

  function semanticScore(candidate, densityPenalty) {
    const stars = Math.max(0, candidate.node.stars || 0);
    const importance = Math.min(1.8, Math.log2(stars + 1) * 0.28) + (candidate.node.fork ? -0.15 : 0);
    return candidate.fontSize + Math.min(0.9, candidate.radius * 0.08) + importance - densityPenalty;
  }

  function updateSemanticEligibility(candidates, area, repoCount) {
    const density = repoCount / Math.max(1, area / 100000);
    const densityPenalty = clamp(Math.log2(Math.max(1, density / 8)) * 0.35, 0, 1.2);
    const liveIds = new Set();
    for (const candidate of candidates) {
      if (candidate.node.type !== "repository") continue;
      liveIds.add(candidate.node.id);
      const score = semanticScore(candidate, densityPenalty);
      const wasEligible = semanticEligibleRepositoryIds.has(candidate.node.id);
      const threshold = wasEligible ? 12.05 : 12.65;
      if (score >= threshold) semanticEligibleRepositoryIds.add(candidate.node.id);
      else semanticEligibleRepositoryIds.delete(candidate.node.id);
      candidate.semanticScore = score;
      candidate.semanticAlpha = smoothstep(11.7, 13.5, score);
    }
    for (const id of [...semanticEligibleRepositoryIds]) {
      if (!liveIds.has(id)) semanticEligibleRepositoryIds.delete(id);
    }
  }

  function policyRepoBudget(area, repoCount) {
    if (activePolicy === "current") return adaptiveRepoBudget(area, repoCount);
    if (activePolicy === "overview-off") {
      return repositoryFontSize() < 11.35 ? 0 : adaptiveRepoBudget(area, repoCount);
    }
    return semanticRepoBudget(area, repoCount);
  }

  function ordinaryRepositoryEligible(candidate) {
    if (activePolicy === "current") return true;
    if (activePolicy === "overview-off") return repositoryFontSize() >= 11.35;
    return semanticEligibleRepositoryIds.has(candidate.node.id);
  }

  function categoryColor(colors) {
    return state.style === "galaxy-systems" ? colors.group : colors.muted;
  }

  function drawCandidateLabel(candidate, chosen, colors, forced, cameraMoving) {
    let policyAlpha = 1;
    if (!forced && candidate.node.type === "repository" && (activePolicy === "semantic-lod" || activePolicy === "semantic-motion")) {
      policyAlpha = candidate.semanticAlpha ?? 1;
      if (activePolicy === "semantic-motion" && cameraMoving) policyAlpha *= 0.12;
    }
    ctx.globalAlpha = Math.max(candidate.opacity * policyAlpha, forced ? 0.86 : 0);
    ctx.textBaseline = "top";
    ctx.lineWidth = candidate.node.type === "group"
      ? (state.style === "galaxy-systems" ? 3.8 : 3.5)
      : (state.style === "galaxy-systems" ? 3.1 : 3);
    ctx.strokeStyle = colors.background;

    if (candidate.presentation.count) {
      const startX = chosen.left + 5;
      ctx.textAlign = "left";
      setFont(candidate.weight, candidate.fontSize);
      ctx.strokeText(candidate.presentation.title, startX, chosen.y);
      ctx.fillStyle = categoryColor(colors);
      ctx.fillText(candidate.presentation.title, startX, chosen.y);

      const countX = startX + candidate.presentation.titleWidth + 6;
      setFont(550, candidate.presentation.countFontSize);
      const countY = chosen.y + Math.max(1, (candidate.fontSize - candidate.presentation.countFontSize) * 0.34);
      ctx.strokeText(candidate.presentation.count, countX, countY);
      ctx.fillStyle = categoryColor(colors);
      ctx.fillText(candidate.presentation.count, countX, countY);
      return;
    }

    setFont(candidate.weight, candidate.fontSize);
    ctx.textAlign = chosen.align;
    ctx.fillStyle = candidate.node.type === "group" ? categoryColor(colors) : colors.text;
    ctx.strokeText(candidate.presentation.title, chosen.x, chosen.y);
    ctx.fillText(candidate.presentation.title, chosen.x, chosen.y);
  }

  function drawAdaptiveLabels(colors) {
    const rect = ctx.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const area = width * height;
    const repoCount = state.nodes.filter((node) => node.type === "repository").length;
    const directIds = directRepositoryIds();
    const candidates = [];
    const cameraMoving = cameraMotionState(performance.now());

    for (const node of state.nodes) {
      const point = worldToScreen(node.x, node.y);
      const highlighted = node === state.selected || node === state.hovered;
      const radius = Math.max(3.5, nodeRadius(node) * state.zoom * (highlighted ? 1.14 : 1));
      const opacity = typeof nodeOpacity === "function" ? nodeOpacity(node) : (node.archived ? 0.72 : 1);
      const directMatch = directIds.has(node.id);
      const fontSize = fontSizeFor(node);
      const weight = fontWeight(node);
      const presentation = labelPresentation(node, fontSize, weight);
      candidates.push({
        node,
        point,
        radius,
        opacity,
        highlighted,
        directMatch,
        fontSize,
        weight,
        presentation,
        priority: labelPriority(node, highlighted, directMatch),
      });
    }

    if (activePolicy === "semantic-lod" || activePolicy === "semantic-motion") {
      updateSemanticEligibility(candidates, area, repoCount);
    } else {
      semanticEligibleRepositoryIds.clear();
    }

    const repoBudget = policyRepoBudget(area, repoCount);
    candidates.sort((a, b) => b.priority - a.priority || a.node.label.localeCompare(b.node.label));
    const occupied = [];
    const anchorCounts = {};
    const placedRepositoryIds = [];
    let repoLabels = 0;

    for (const candidate of candidates) {
      const forced = candidate.highlighted || candidate.node.type !== "repository" || candidate.directMatch;
      if (candidate.node.type === "repository" && !forced) {
        if (!ordinaryRepositoryEligible(candidate)) continue;
        if (repoLabels >= repoBudget) continue;
      }

      const boxes = anchorBoxes(candidate.point, candidate.radius, candidate.presentation.width, candidate.presentation.height);
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

      drawCandidateLabel(candidate, chosen, colors, forced, cameraMoving);
    }
    ctx.globalAlpha = 1;

    const repoFont = repositoryFontSize();
    const groupFont = categoryFontSize();
    lastSnapshot = {
      active: true,
      style: state.style,
      policy: activePolicy,
      repoCount,
      repoBudget,
      repoLabels,
      totalLabels: occupied.length,
      anchors: { ...anchorCounts },
      placedRepositoryIds: [...placedRepositoryIds],
      eligibleRepositoryIds: [...semanticEligibleRepositoryIds].sort(),
      cameraMoving,
      zoom: state.zoom,
      viewport: { width, height },
      typography: {
        repositoryFontSize: repoFont,
        categoryFontSize: groupFont,
        categoryCountFontSize: categoryCountFontSize(groupFont),
        categoryToRepositoryRatio: groupFont / repoFont,
      },
    };
  }

  drawNodesAndLabels = function adaptiveTextOnlyNodesAndLabels(colors) {
    if (!supportedStyles.has(state.style)) {
      lastSnapshot = { ...lastSnapshot, active: false, style: state.style, policy: activePolicy };
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
    policies() {
      return [...supportedPolicies];
    },
    setPolicy(policy) {
      if (!supportedPolicies.has(policy)) throw new Error(`Unsupported label policy: ${policy}`);
      activePolicy = policy;
      semanticEligibleRepositoryIds.clear();
      cameraMovingUntil = 0;
      lastCamera = null;
      draw();
    },
    snapshot() {
      return {
        ...lastSnapshot,
        anchors: { ...lastSnapshot.anchors },
        placedRepositoryIds: [...lastSnapshot.placedRepositoryIds],
        eligibleRepositoryIds: [...lastSnapshot.eligibleRepositoryIds],
        viewport: { ...lastSnapshot.viewport },
        typography: { ...lastSnapshot.typography },
      };
    },
  });

  draw();
}, { once: true });
