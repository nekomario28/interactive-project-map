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

function palette(theme) {
  const base = theme === "dark"
    ? { bg: "#070a12", fg: "#e8edf7", muted: "#9aa7bd", edge: "#344054", owner: "#64d2ff", group: "#6aa7ff", original: "#57d17a", fork: "#b59aff", archived: "#d9847b", relation: "#f4b65f" }
    : { bg: "#fbfcff", fg: "#172033", muted: "#667085", edge: "#cfd6e3", owner: "#1677a5", group: "#376fbd", original: "#208847", fork: "#7357bd", archived: "#a34d45", relation: "#a46618" };
  return withContributedColor(base, theme);
}

function groupMembers(group, repos) {
  const key = String(group.id).replace(/^group:/, "");
  return repos.filter((repo) => repo.groupId === key || group.id === `group:${repo.groupId}`);
}

export function layoutRadialTree(graph, width, height) {
  const cx = width / 2;
  const cy = height / 2 - 4;
  const minSize = Math.min(width, height);
  const groups = graph.nodes.filter((node) => node.type === "group");
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const points = [];
  const owner = graph.nodes.find((node) => node.type === "owner");
  if (owner) points.push({ x: cx, y: cy, node: owner });

  const groupRadius = minSize * 0.27;
  const repoBaseRadius = minSize * 0.40;
  const laneGap = Math.max(34, minSize * 0.07);
  const count = Math.max(1, groups.length);
  const sector = Math.PI * 2 / count;

  groups.forEach((group, groupIndex) => {
    const base = -Math.PI / 2 + sector * groupIndex;
    points.push({ x: cx + Math.cos(base) * groupRadius, y: cy + Math.sin(base) * groupRadius, node: group });
    const members = groupMembers(group, repos).sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0) || a.label.localeCompare(b.label));
    const spread = Math.min(0.72, Math.max(0.18, sector * 0.62));
    const perLane = Math.max(1, Math.floor(spread / 0.18));
    members.forEach((repo, memberIndex) => {
      const lane = Math.floor(memberIndex / perLane);
      const inLane = memberIndex % perLane;
      const laneCount = Math.min(perLane, members.length - lane * perLane);
      const offset = laneCount <= 1 ? 0 : (inLane / (laneCount - 1) - 0.5) * spread;
      const angularJitter = ((hash(`${repo.id}:a`) % 1000) / 1000 - 0.5) * 0.045;
      const radialJitter = ((hash(`${repo.id}:r`) % 1000) / 1000 - 0.5) * minSize * 0.045;
      const radius = repoBaseRadius + lane * laneGap + radialJitter;
      const angle = base + offset + angularJitter;
      points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, node: repo });
    });
  });

  const assigned = new Set(points.map((point) => point.node.id));
  const unassigned = repos.filter((repo) => !assigned.has(repo.id));
  const contributed = unassigned.filter(isContributedRepository).sort((a, b) => a.label.localeCompare(b.label));
  const otherUnassigned = unassigned.filter((repo) => !isContributedRepository(repo));

  otherUnassigned.forEach((repo, index) => {
    const angle = -Math.PI / 2 + Math.PI * 2 * index / Math.max(1, otherUnassigned.length);
    const radius = repoBaseRadius + (index % 2) * laneGap;
    points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, node: repo });
  });

  if (contributed.length) {
    const occupiedRepositories = points.filter((point) => point.node.type === "repository");
    const maxOwnedRadius = occupiedRepositories.reduce(
      (max, point) => Math.max(max, Math.hypot(point.x - cx, point.y - cy)),
      repoBaseRadius,
    );
    const externalGap = Math.max(42, minSize * 0.10);
    const externalRadius = maxOwnedRadius + externalGap;
    contributed.forEach((repo, index) => {
      const angle = Math.PI * 2 * index / contributed.length;
      points.push({
        x: cx + Math.cos(angle) * externalRadius,
        y: cy + Math.sin(angle) * externalRadius,
        node: repo,
      });
    });

    const maxRenderableRadius = minSize * 0.41;
    if (externalRadius > maxRenderableRadius) {
      const scale = maxRenderableRadius / externalRadius;
      for (const point of points) {
        if (point.node.type === "owner") continue;
        point.x = cx + (point.x - cx) * scale;
        point.y = cy + (point.y - cy) * scale;
      }
    }
  }

  return points;
}

function boxesOverlap(a, b, padding = 3) {
  return !(a.right + padding < b.left || b.right + padding < a.left || a.bottom + padding < b.top || b.bottom + padding < a.top);
}

function placeLabels(points, width, height) {
  const ordered = [...points].sort((a, b) => {
    const pa = a.node.type === "owner" ? 10000 : a.node.type === "group" ? 9000 : (a.node.stars ?? 0) * 10 + (a.node.fork ? 0 : 5) - (a.node.archived ? 4 : 0);
    const pb = b.node.type === "owner" ? 10000 : b.node.type === "group" ? 9000 : (b.node.stars ?? 0) * 10 + (b.node.fork ? 0 : 5) - (b.node.archived ? 4 : 0);
    return pb - pa || a.node.label.localeCompare(b.node.label);
  });
  const occupied = [];
  const placements = new Map();
  for (const point of ordered) {
    const node = point.node;
    const fontSize = node.type === "owner" ? 15 : node.type === "group" ? 10.5 : 9.5;
    const widthPx = labelWidth(node, fontSize);
    const heightPx = fontSize + 6;
    const radius = nodeRadius(node);
    const candidates = [
      { x: point.x, y: point.y + radius + 8 },
      { x: point.x, y: point.y - radius - heightPx - 5 },
      { x: point.x + radius + 8 + widthPx / 2, y: point.y - heightPx / 2 },
      { x: point.x - radius - 8 - widthPx / 2, y: point.y - heightPx / 2 },
    ];
    let chosen = null;
    for (const candidate of candidates) {
      const box = { left: candidate.x - widthPx / 2, right: candidate.x + widthPx / 2, top: candidate.y, bottom: candidate.y + heightPx };
      if (box.left < 8 || box.right > width - 8 || box.top < 8 || box.bottom > height - 26) continue;
      if (occupied.some((other) => boxesOverlap(box, other, node.type === "repository" ? 4 : 6))) continue;
      chosen = { ...candidate, fontSize, box };
      break;
    }
    if (chosen || node.type === "owner") {
      const fallback = chosen || { x: point.x, y: clamp(point.y + radius + 8, 8, height - 34), fontSize, box: { left: point.x - widthPx / 2, right: point.x + widthPx / 2, top: point.y + radius + 8, bottom: point.y + radius + 8 + heightPx } };
      placements.set(node.id, fallback);
      occupied.push(fallback.box);
    }
  }
  return placements;
}

function legend(colors, width, height) {
  let x = 18;
  return statusLegendItems(colors).map(([color, label]) => {
    const chunk = `<circle cx="${x + 4}" cy="${height - 16}" r="4" fill="${color}"/><text x="${x + 13}" y="${height - 12.5}" fill="${colors.muted}" font-size="9.5">${label}</text>`;
    x += 17 + label.length * 5.8 + 15;
    return chunk;
  }).join("") + `<text x="${width - 18}" y="${height - 12.5}" text-anchor="end" fill="${colors.muted}" font-size="9.5">Radial Tree · Classic</text>`;
}

export function renderRadialTreeSvg(graph, theme, width, height) {
  const colors = palette(theme);
  const points = layoutRadialTree(graph, width, height);
  const byId = new Map(points.map((point) => [point.node.id, point]));
  const labels = placeLabels(points, width, height);

  const lines = visibleStructuralEdges(graph.edges).map((edge) => {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) return "";
    const relation = edge.type === "relation";
    return `<line x1="${source.x.toFixed(1)}" y1="${source.y.toFixed(1)}" x2="${target.x.toFixed(1)}" y2="${target.y.toFixed(1)}" stroke="${relation ? colors.relation : colors.edge}" stroke-width="${relation ? 1.4 : 1}" opacity="${relation ? 0.72 : 0.58}"${relation ? ' stroke-dasharray="5 4"' : ""}/>`;
  }).join("");

  const nodes = points.map(({ x, y, node }) => {
    const status = repositoryStatus(node);
    const fill = colors[status] || colors.original;
    const radius = nodeRadius(node);
    const placement = labels.get(node.id);
    const title = node.type === "repository" ? `<title>${esc(`${node.label} · ${status}`)}</title>` : "";
    const label = placement
      ? `<text x="${placement.x.toFixed(1)}" y="${placement.y.toFixed(1)}" text-anchor="middle" fill="${node.type === "group" ? colors.muted : colors.fg}" font-size="${placement.fontSize}" font-weight="${node.type === "owner" ? 700 : node.type === "group" ? 600 : 500}" paint-order="stroke" stroke="${colors.bg}" stroke-width="2.4" stroke-linejoin="round">${esc(displayLabel(node))}</text>`
      : "";
    const archivedRing = shouldDecorateArchived(node)
      ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(radius + 3.5).toFixed(1)}" fill="none" stroke="${colors.archived}" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.9"/>`
      : "";
    const ownerRing = node.type === "owner"
      ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(radius + 7).toFixed(1)}" fill="none" stroke="${fill}" opacity="0.25"/>`
      : "";
    const opacity = node.type === "repository" ? repositoryOpacity(node, { archived: 0.72, contributed: 0.96 }) : 0.96;
    return `<g>${title}<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${fill}" opacity="${opacity}"/>${ownerRing}${archivedRing}${label}</g>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Radial Tree classic map of ${esc(graph.owner)} public GitHub repositories">\n  <rect width="100%" height="100%" rx="16" fill="${colors.bg}"/>\n  <g>${lines}</g>\n  <g>${nodes}</g>\n  <g>${legend(colors, width, height)}</g>\n</svg>`;
}
