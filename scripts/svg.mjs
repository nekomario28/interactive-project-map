import {
  isContributedRepository,
  repositoryOpacity,
  repositoryStatus,
  shouldDecorateArchived,
  statusLegendItems,
  visibleStructuralEdges,
  withContributedColor,
} from "./static-contributed.mjs";

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function displayLabel(node) {
  const label = String(node.label || "");
  return label.length <= 28 ? label : `${label.slice(0, 27)}…`;
}

function labelWidth(node, fontSize = 10) {
  return clamp(12 + displayLabel(node).length * fontSize * 0.58, 42, 190);
}

function nodeRadius(node) {
  if (node.type === "owner") return 25;
  if (node.type === "group") return 7.5;
  return clamp(5 + Math.log2((node.stars ?? 0) + 1) * 1.35, 5, 11.5);
}

function statusOf(node) {
  return repositoryStatus(node);
}

function palette(theme, style) {
  const dark = theme === "dark";
  let base;
  if (style === "obsidian") {
    base = dark
      ? { bg: "#1e1e1e", bg2: "#181818", fg: "#dcddde", muted: "#9a9a9f", edge: "#57575d", owner: "#c4b5fd", group: "#8b7cf6", original: "#a89df7", fork: "#67b7a7", archived: "#b97a7a", relation: "#d7a75b" }
      : { bg: "#f7f7f8", bg2: "#eeeeef", fg: "#242427", muted: "#67676d", edge: "#b9b9c0", owner: "#7868db", group: "#6555c7", original: "#7667d8", fork: "#348e80", archived: "#a75f5f", relation: "#9c6b23" };
  } else {
    base = dark
      ? { bg: "#070a12", bg2: "#0b1120", fg: "#e8edf7", muted: "#9aa7bd", edge: "#344054", owner: "#64d2ff", group: "#6aa7ff", original: "#57d17a", fork: "#b59aff", archived: "#d9847b", relation: "#f4b65f" }
      : { bg: "#fbfcff", bg2: "#f2f6fc", fg: "#172033", muted: "#667085", edge: "#cfd6e3", owner: "#1677a5", group: "#376fbd", original: "#208847", fork: "#7357bd", archived: "#a34d45", relation: "#a46618" };
  }
  return withContributedColor(base, theme);
}

function groupMembers(group, repos) {
  const key = String(group.id).replace(/^group:/, "");
  return repos.filter((repo) => !isContributedRepository(repo) && (repo.groupId === key || group.id === `group:${repo.groupId}`));
}

const TAU = Math.PI * 2;
const GALAXY_SYSTEM_LIMIT = 80;
const CONTRIBUTED_PER_LANE = 8;

function addContributedGalaxyPoints(points, repos, cx, cy, minSize, galaxyMode, animated = false) {
  const contributed = repos
    .filter(isContributedRepository)
    .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0) || String(a.id).localeCompare(String(b.id)));
  if (!contributed.length) return;
  const outerRadius = minSize * 0.455;
  const laneGap = Math.max(30, minSize * 0.072);
  contributed.forEach((repo, index) => {
    const lane = Math.floor(index / CONTRIBUTED_PER_LANE);
    const inLane = index % CONTRIBUTED_PER_LANE;
    const laneCount = Math.min(CONTRIBUTED_PER_LANE, contributed.length - lane * CONTRIBUTED_PER_LANE);
    const seed = (hash(`${repo.id}:${galaxyMode}:contributed-phase`) % 10000) / 10000;
    const angle = -Math.PI / 2 + TAU * (inLane + seed * 0.25) / Math.max(1, laneCount);
    const radius = Math.max(minSize * 0.30, outerRadius - lane * laneGap);
    points.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      node: repo,
      galaxyMode,
      external: true,
      ...(animated ? {
        orbitCenterX: cx,
        orbitCenterY: cy,
        orbitRadius: radius,
        orbitLane: lane,
        orbitDirection: (hash(`${repo.id}:${galaxyMode}:contributed-direction`) & 1) === 0 ? 1 : -1,
        orbitDuration: 760 + lane * 160,
      } : {}),
    });
  });
}

function denseGalaxyLayout(graph, width, height) {
  const cx = width / 2;
  const cy = height / 2 - 4;
  const minSize = Math.min(width, height);
  const groups = graph.nodes.filter((node) => node.type === "group");
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const points = [];
  const owner = graph.nodes.find((node) => node.type === "owner");
  if (owner) points.push({ x: cx, y: cy, node: owner, galaxyMode: "dense" });
  const count = Math.max(1, groups.length);
  const sector = TAU / count;
  const usableSector = Math.min(1.12, sector * 0.70);
  const groupRadius = minSize * 0.20;
  const firstLane = minSize * 0.32;
  const laneGap = Math.max(46, minSize * 0.105);

  groups.forEach((group, groupIndex) => {
    const base = -Math.PI / 2 + sector * groupIndex;
    points.push({ x: cx + Math.cos(base) * groupRadius, y: cy + Math.sin(base) * groupRadius, node: group, galaxyMode: "dense" });
    const members = groupMembers(group, repos).sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0) || a.label.localeCompare(b.label));
    let cursor = 0;
    let lane = 0;
    while (cursor < members.length) {
      const radius = firstLane + lane * laneGap;
      const remaining = members.slice(cursor);
      const widest = Math.max(...remaining.slice(0, 12).map((repo) => labelWidth(repo)), 64);
      const minimumGap = clamp((widest + 24) / Math.max(80, radius), 0.13, 0.48);
      const capacity = Math.max(1, Math.floor(usableSector / minimumGap));
      const take = Math.min(capacity, members.length - cursor);
      for (let index = 0; index < take; index += 1) {
        const repo = members[cursor + index];
        const local = take <= 1 ? 0 : (index / (take - 1) - 0.5) * usableSector;
        const jitter = ((hash(`${repo.id}:phase`) % 1000) / 1000 - 0.5) * Math.min(0.025, minimumGap * 0.12);
        const angle = base + local + lane * 0.045 + jitter;
        points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, node: repo, galaxyMode: "dense" });
      }
      cursor += take;
      lane += 1;
    }
  });
  addContributedGalaxyPoints(points, repos, cx, cy, minSize, "dense", false);
  return points;
}

function systemOrbitAssignments(group, members) {
  const assignments = [];
  let cursor = 0;
  let lane = 0;
  const seedPhase = ((hash(`${group.id}:system-phase`) % 10000) / 10000) * TAU;
  while (cursor < members.length) {
    const radius = 34 + lane * 28;
    const capacity = Math.max(4, Math.floor((TAU * radius) / 56));
    const take = Math.min(capacity, members.length - cursor);
    for (let index = 0; index < take; index += 1) {
      const repo = members[cursor + index];
      const angle = seedPhase + TAU * index / Math.max(1, take) + lane * 0.31;
      assignments.push({ repo, lane, radius, angle, direction: lane % 2 === 0 ? 1 : -1, duration: 92 + lane * 38 });
    }
    cursor += take;
    lane += 1;
  }
  return assignments;
}

function galaxySystemLayout(graph, width, height) {
  const cx = width / 2;
  const cy = height / 2 - 4;
  const minSize = Math.min(width, height);
  const groups = graph.nodes.filter((node) => node.type === "group");
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const owner = graph.nodes.find((node) => node.type === "owner");
  const count = Math.max(1, groups.length);
  const systems = groups.map((group) => ({
    group,
    assignments: systemOrbitAssignments(group, groupMembers(group, repos).sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0) || a.label.localeCompare(b.label))),
  }));
  const maximumSystemRadius = Math.max(34, ...systems.flatMap((system) => system.assignments.map((assignment) => assignment.radius)));
  const circumferenceRadius = ((maximumSystemRadius * 2 + 54) * count) / TAU;
  const groupRadius = count === 1
    ? minSize * 0.22
    : clamp(Math.max(minSize * 0.25, circumferenceRadius), minSize * 0.25, minSize * 0.72);
  const points = [];
  if (owner) points.push({ x: cx, y: cy, node: owner, galaxyMode: "systems" });

  systems.forEach((system, groupIndex) => {
    const base = -Math.PI / 2 + TAU * groupIndex / count;
    const gx = cx + Math.cos(base) * groupRadius;
    const gy = cy + Math.sin(base) * groupRadius;
    points.push({ x: gx, y: gy, node: system.group, galaxyMode: "systems", systemRadius: Math.max(34, ...system.assignments.map((assignment) => assignment.radius)) });
    for (const assignment of system.assignments) {
      points.push({
        x: gx + Math.cos(assignment.angle) * assignment.radius,
        y: gy + Math.sin(assignment.angle) * assignment.radius,
        node: assignment.repo,
        galaxyMode: "systems",
        orbitCenterX: gx,
        orbitCenterY: gy,
        orbitRadius: assignment.radius,
        orbitLane: assignment.lane,
        orbitDirection: assignment.direction,
        orbitDuration: assignment.duration,
        groupId: system.group.id,
      });
    }
  });
  addContributedGalaxyPoints(points, repos, cx, cy, minSize, "systems", true);
  return points;
}

function galaxyLayout(graph, width, height) {
  const repositoryCount = graph.nodes.filter((node) => node.type === "repository").length;
  return repositoryCount <= GALAXY_SYSTEM_LIMIT
    ? galaxySystemLayout(graph, width, height)
    : denseGalaxyLayout(graph, width, height);
}

function obsidianLayout(graph, width, height) {
  const rawNodes = graph.nodes;
  const nodes = rawNodes.map((raw, index) => {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const jitter = (hash(raw.id) % 1000) / 1000;
    const angle = index * golden + jitter * 0.6;
    const radius = 34 + Math.sqrt((index + 1) / Math.max(1, rawNodes.length)) * 340;
    return { ...raw, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, vx: 0, vy: 0 };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const links = visibleStructuralEdges(graph.edges)
    .map((edge) => ({ ...edge, sourceNode: byId.get(edge.source), targetNode: byId.get(edge.target) }))
    .filter((edge) => edge.sourceNode && edge.targetNode);

  for (let step = 0; step < 90; step += 1) {
    const alpha = 1 - step / 90;
    for (let first = 0; first < nodes.length; first += 1) {
      const a = nodes[first];
      for (let second = first + 1; second < nodes.length; second += 1) {
        const b = nodes[second];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          const angle = (hash(`${a.id}:${b.id}`) % 6283) / 1000;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          d2 = 1;
        }
        const distance = Math.sqrt(d2);
        const minimum = Math.min(72, 18 + (labelWidth(a) + labelWidth(b)) * 0.18);
        const force = (10000 * alpha) / Math.max(d2, minimum * minimum * 0.45);
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }
    for (const link of links) {
      const a = link.sourceNode;
      const b = link.targetNode;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const target = link.type === "ownership" ? 160 : 118;
      const amount = (distance - target) * 0.012 * alpha;
      const fx = (dx / distance) * amount;
      const fy = (dy / distance) * amount;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
    for (const node of nodes) {
      node.vx += -node.x * 0.00125 * alpha;
      node.vy += -node.y * 0.00125 * alpha;
      node.vx *= 0.83;
      node.vy *= 0.83;
      node.x += node.vx;
      node.y += node.vy;
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x - labelWidth(node) / 2 - 16);
    maxX = Math.max(maxX, node.x + labelWidth(node) / 2 + 16);
    minY = Math.min(minY, node.y - 28);
    maxY = Math.max(maxY, node.y + 38);
  }
  const sourceWidth = Math.max(1, maxX - minX);
  const sourceHeight = Math.max(1, maxY - minY);
  const scale = Math.min((width - 54) / sourceWidth, (height - 68) / sourceHeight);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return nodes.map((node) => ({ x: width / 2 + (node.x - centerX) * scale, y: height / 2 - 8 + (node.y - centerY) * scale, node }));
}

export function layoutGraphForStyle(graph, width, height, style = "galaxy") {
  return style === "obsidian" ? obsidianLayout(graph, width, height) : galaxyLayout(graph, width, height);
}

function boxesOverlap(a, b, padding = 3) {
  return !(a.right + padding < b.left || b.right + padding < a.left || a.bottom + padding < b.top || b.bottom + padding < a.top);
}

function placeLabels(points, width, height) {
  const priorities = [...points].sort((a, b) => {
    const pa = a.node.type === "owner" ? 10000 : a.node.type === "group" ? 9000 : (isContributedRepository(a.node) ? 8000 : (a.node.stars ?? 0) * 10 + (a.node.fork ? 0 : 5) - (a.node.archived ? 4 : 0));
    const pb = b.node.type === "owner" ? 10000 : b.node.type === "group" ? 9000 : (isContributedRepository(b.node) ? 8000 : (b.node.stars ?? 0) * 10 + (b.node.fork ? 0 : 5) - (b.node.archived ? 4 : 0));
    return pb - pa || a.node.label.localeCompare(b.node.label);
  });
  const occupied = [];
  const placements = new Map();
  for (const point of priorities) {
    const node = point.node;
    const fontSize = node.type === "owner" ? 15 : node.type === "group" ? 10.5 : 9.5;
    const widthPx = labelWidth(node, fontSize);
    const heightPx = fontSize + 6;
    const radius = nodeRadius(node);
    const candidates = [
      { x: point.x, y: point.y + radius + 8, anchor: "middle" },
      { x: point.x, y: point.y - radius - heightPx - 5, anchor: "middle" },
      { x: point.x + radius + 8 + widthPx / 2, y: point.y - heightPx / 2, anchor: "middle" },
      { x: point.x - radius - 8 - widthPx / 2, y: point.y - heightPx / 2, anchor: "middle" },
    ];
    let chosen = null;
    for (const candidate of candidates) {
      const box = { left: candidate.x - widthPx / 2, right: candidate.x + widthPx / 2, top: candidate.y, bottom: candidate.y + heightPx };
      if (box.left < 8 || box.right > width - 8 || box.top < 8 || box.bottom > height - 26) continue;
      if (occupied.some((other) => boxesOverlap(box, other, node.type === "repository" ? 4 : 6))) continue;
      chosen = { ...candidate, fontSize, box };
      break;
    }
    if (chosen || node.type === "owner" || isContributedRepository(node)) {
      const fallback = chosen || { x: point.x, y: clamp(point.y + radius + 8, 8, height - 34), anchor: "middle", fontSize, box: { left: point.x - widthPx / 2, right: point.x + widthPx / 2, top: point.y + radius + 8, bottom: point.y + radius + 8 + heightPx } };
      placements.set(node.id, fallback);
      occupied.push(fallback.box);
    }
  }
  return placements;
}

function stars(owner, width, height, fg) {
  const seed = hash(owner);
  return Array.from({ length: 90 }, (_, i) => {
    const x = hash(`${seed}:x:${i}`) % width;
    const y = hash(`${seed}:y:${i}`) % height;
    const r = 0.35 + (hash(`${seed}:r:${i}`) % 10) / 10;
    const opacity = 0.10 + (hash(`${seed}:o:${i}`) % 42) / 100;
    return `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${fg}" opacity="${opacity.toFixed(2)}"/>`;
  }).join("");
}

function legend(colors, width, height) {
  let x = 18;
  return statusLegendItems(colors).map(([color, label]) => {
    const chunk = `<circle cx="${x + 4}" cy="${height - 16}" r="4" fill="${color}"/><text x="${x + 13}" y="${height - 12.5}" fill="${colors.muted}" font-size="9.5">${label}</text>`;
    x += 17 + label.length * 5.8 + 15;
    return chunk;
  }).join("") + `<text x="${width - 18}" y="${height - 12.5}" text-anchor="end" fill="${colors.muted}" font-size="9.5">${esc("project map")}</text>`;
}

function galaxySystemGuides(points, colors) {
  const groups = points.filter((point) => point.node.type === "group" && point.galaxyMode === "systems");
  const repos = points.filter((point) => point.node.type === "repository" && point.galaxyMode === "systems" && !isContributedRepository(point.node));
  return groups.map((groupPoint) => {
    const members = repos.filter((point) => point.groupId === groupPoint.node.id);
    const radii = [...new Set(members.map((point) => point.orbitRadius).filter(Number.isFinite))].sort((a, b) => a - b);
    const outer = Math.max(34, ...radii) + 14;
    const rings = radii.map((radius) => `<circle cx="${groupPoint.x.toFixed(1)}" cy="${groupPoint.y.toFixed(1)}" r="${radius.toFixed(1)}" fill="none" stroke="${colors.group}" stroke-width="0.7" opacity="0.13"/>`).join("");
    return `<g data-galaxy-system="${esc(groupPoint.node.id)}"><circle cx="${groupPoint.x.toFixed(1)}" cy="${groupPoint.y.toFixed(1)}" r="${outer.toFixed(1)}" fill="${colors.group}" opacity="0.025"/><circle cx="${groupPoint.x.toFixed(1)}" cy="${groupPoint.y.toFixed(1)}" r="${outer.toFixed(1)}" fill="none" stroke="${colors.group}" stroke-width="1" opacity="0.16"/>${rings}</g>`;
  }).join("");
}

function categoryRelationLines(graph, points, colors) {
  const byId = new Map(points.map((point) => [point.node.id, point]));
  const groupPoints = new Map(points.filter((point) => point.node.type === "group").map((point) => [point.node.id, point]));
  const counts = new Map();
  for (const edge of graph.edges) {
    if (edge.type !== "relation") continue;
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    const sourceGroup = source?.node?.groupId ? `group:${source.node.groupId}` : null;
    const targetGroup = target?.node?.groupId ? `group:${target.node.groupId}` : null;
    if (!sourceGroup || !targetGroup || sourceGroup === targetGroup || !groupPoints.has(sourceGroup) || !groupPoints.has(targetGroup)) continue;
    const key = [sourceGroup, targetGroup].sort().join("|");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const owner = points.find((point) => point.node.type === "owner");
  return [...counts.entries()].map(([key, count]) => {
    const [sourceId, targetId] = key.split("|");
    const source = groupPoints.get(sourceId);
    const target = groupPoints.get(targetId);
    if (!source || !target) return "";
    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2;
    const controlX = owner ? midX * 0.62 + owner.x * 0.38 : midX;
    const controlY = owner ? midY * 0.62 + owner.y * 0.38 : midY;
    const lineWidth = clamp(0.8 + Math.log2(count + 1) * 0.45, 0.8, 2.2);
    return `<path data-category-relation="true" d="M${source.x.toFixed(1)},${source.y.toFixed(1)} Q${controlX.toFixed(1)},${controlY.toFixed(1)} ${target.x.toFixed(1)},${target.y.toFixed(1)}" fill="none" stroke="${colors.relation}" stroke-width="${lineWidth.toFixed(2)}" stroke-dasharray="4 5" opacity="0.34"><title>${esc(`${source.node.label} ↔ ${target.node.label}: ${count} relation${count === 1 ? "" : "s"}`)}</title></path>`;
  }).join("");
}

function staticEdgeLines(graph, points, colors, mapStyle, systemsMode) {
  const byId = new Map(points.map((point) => [point.node.id, point]));
  const edges = visibleStructuralEdges(graph.edges);
  if (systemsMode) {
    const ownership = edges.filter((edge) => edge.type === "ownership").map((edge) => {
      const source = byId.get(edge.source);
      const target = byId.get(edge.target);
      if (!source || !target) return "";
      return `<line x1="${source.x.toFixed(1)}" y1="${source.y.toFixed(1)}" x2="${target.x.toFixed(1)}" y2="${target.y.toFixed(1)}" stroke="${colors.edge}" stroke-width="1" opacity="0.32"/>`;
    }).join("");
    return ownership + categoryRelationLines(graph, points, colors);
  }
  return edges.map((edge) => {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) return "";
    const relation = edge.type === "relation";
    return `<line x1="${source.x.toFixed(1)}" y1="${source.y.toFixed(1)}" x2="${target.x.toFixed(1)}" y2="${target.y.toFixed(1)}" stroke="${relation ? colors.relation : colors.edge}" stroke-width="${relation ? 1.4 : 1}" opacity="${relation ? 0.72 : mapStyle === "obsidian" ? 0.38 : 0.52}"${relation ? ' stroke-dasharray="5 4"' : ""}/>`;
  }).join("");
}

function renderPoint(point, labels, colors, mapStyle, systemsMode) {
  const { x, y, node } = point;
  const status = statusOf(node);
  const fill = colors[status] || colors.original;
  const radius = nodeRadius(node);
  const placement = labels.get(node.id);
  const baseLabel = placement
    ? `<text x="${placement.x.toFixed(1)}" y="${placement.y.toFixed(1)}" text-anchor="${placement.anchor}" fill="${node.type === "group" ? colors.muted : colors.fg}" font-size="${placement.fontSize}" font-weight="${node.type === "owner" ? 700 : node.type === "group" ? 600 : 500}" paint-order="stroke" stroke="${colors.bg}" stroke-width="${mapStyle === "galaxy" ? 2.5 : 1.8}" stroke-linejoin="round">${esc(displayLabel(node))}</text>`
    : "";
  const archivedRing = shouldDecorateArchived(node)
    ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(radius + 3.5).toFixed(1)}" fill="none" stroke="${colors.archived}" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.9"/>`
    : "";
  const ownerRing = node.type === "owner"
    ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(radius + 7).toFixed(1)}" fill="none" stroke="${fill}" opacity="0.25"/>`
    : "";
  const opacity = node.type === "repository" ? repositoryOpacity(node, { archived: 0.72, contributed: 0.96 }) : 0.96;
  const core = `<title>${esc(`${node.label}${node.type === "repository" ? ` · ${status}` : ""}`)}</title><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${fill}" opacity="${opacity}"/>${ownerRing}${archivedRing}`;

  if (!systemsMode || node.type !== "repository" || !Number.isFinite(point.orbitCenterX) || !Number.isFinite(point.orbitCenterY)) {
    return `<g${isContributedRepository(node) ? ' data-galaxy-orbit="contributed"' : ""}>${core}${baseLabel}</g>`;
  }

  const direction = point.orbitDirection < 0 ? -1 : 1;
  const duration = Math.max(40, Number(point.orbitDuration) || 120);
  const orbitAnimation = `<animateTransform attributeName="transform" type="rotate" from="0 ${point.orbitCenterX.toFixed(1)} ${point.orbitCenterY.toFixed(1)}" to="${direction * 360} ${point.orbitCenterX.toFixed(1)} ${point.orbitCenterY.toFixed(1)}" dur="${duration.toFixed(0)}s" repeatCount="indefinite"/>`;
  const label = placement
    ? `<g>${baseLabel}<animateTransform attributeName="transform" type="rotate" from="0 ${placement.x.toFixed(1)} ${placement.y.toFixed(1)}" to="${-direction * 360} ${placement.x.toFixed(1)} ${placement.y.toFixed(1)}" dur="${duration.toFixed(0)}s" repeatCount="indefinite"/></g>`
    : "";
  const membership = isContributedRepository(node)
    ? ""
    : `<line x1="${point.orbitCenterX.toFixed(1)}" y1="${point.orbitCenterY.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${colors.edge}" stroke-width="0.75" opacity="0.18"/>`;
  return `<g data-galaxy-orbit="${isContributedRepository(node) ? "contributed" : "true"}" transform="rotate(0 ${point.orbitCenterX.toFixed(1)} ${point.orbitCenterY.toFixed(1)})">${membership}${core}${label}${orbitAnimation}</g>`;
}

export function renderGalaxySvg(graph, theme, width, height, style = "galaxy") {
  const mapStyle = style === "obsidian" ? "obsidian" : "galaxy";
  const colors = palette(theme, mapStyle);
  const points = layoutGraphForStyle(graph, width, height, mapStyle);
  const labels = placeLabels(points, width, height);
  const systemsMode = mapStyle === "galaxy" && points.some((point) => point.galaxyMode === "systems");

  const background = mapStyle === "galaxy"
    ? `<defs><radialGradient id="galaxy-bg" cx="50%" cy="46%" r="72%"><stop offset="0%" stop-color="${colors.bg2}"/><stop offset="100%" stop-color="${colors.bg}"/></radialGradient></defs><rect width="100%" height="100%" rx="16" fill="url(#galaxy-bg)"/><g>${stars(graph.owner, width, height, colors.fg)}</g>`
    : `<defs><radialGradient id="obsidian-bg" cx="50%" cy="43%" r="72%"><stop offset="0%" stop-color="${colors.bg2}"/><stop offset="100%" stop-color="${colors.bg}"/></radialGradient></defs><rect width="100%" height="100%" rx="12" fill="url(#obsidian-bg)"/>`;

  const lines = staticEdgeLines(graph, points, colors, mapStyle, systemsMode);
  const guides = systemsMode ? galaxySystemGuides(points, colors) : "";
  const nodes = points.map((point) => renderPoint(point, labels, colors, mapStyle, systemsMode)).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(mapStyle === "obsidian" ? "Obsidian-style" : systemsMode ? "Galaxy systems" : "Galaxy-style")} map of ${esc(graph.owner)} public GitHub repositories">\n  ${background}\n  <g>${lines}</g>\n  <g>${guides}${nodes}</g>\n  <g>${legend(colors, width, height)}</g>\n</svg>`;
}
