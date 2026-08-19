function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function displayLabel(node) {
  const label = String(node.label || "");
  return label.length <= 26 ? label : `${label.slice(0, 25)}…`;
}

function labelWidth(node, fontSize = 9.5) {
  return clamp(12 + displayLabel(node).length * fontSize * 0.58, 42, 175);
}

function statusOf(node) {
  if (node.type !== "repository") return node.type;
  if (node.archived) return "archived";
  return node.fork ? "fork" : "original";
}

function palette(theme) {
  return theme === "light"
    ? { bg: "#fbfcff", panel: "#f4f7fb", fg: "#172033", muted: "#667085", edge: "#b9c3d1", owner: "#1677a5", group: "#376fbd", original: "#208847", fork: "#7357bd", archived: "#a34d45", relation: "#a46618" }
    : { bg: "#080b12", panel: "#0e1420", fg: "#e8edf7", muted: "#98a5b9", edge: "#425069", owner: "#64d2ff", group: "#6aa7ff", original: "#57d17a", fork: "#b59aff", archived: "#d9847b", relation: "#f4b65f" };
}

function groupMembers(group, repos) {
  const key = String(group.id).replace(/^group:/, "");
  return repos.filter((repo) => repo.groupId === key || group.id === `group:${repo.groupId}`);
}

function buildTreeLayout(graph, width, height) {
  const groups = graph.nodes.filter((node) => node.type === "group");
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const owner = graph.nodes.find((node) => node.type === "owner");
  const marginX = 26;
  const usableWidth = Math.max(120, width - marginX * 2);
  const ownerY = 42;
  const groupY = Math.max(112, Math.min(145, height * 0.31));
  const repoTop = Math.max(groupY + 88, Math.min(height - 92, height * 0.61));
  const repoBottom = height - 54;
  const points = [];
  if (owner) points.push({ x: width / 2, y: ownerY, node: owner, depth: 0 });

  const bundles = groups.map((group) => ({
    group,
    members: groupMembers(group, repos).sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0) || a.label.localeCompare(b.label)),
  }));
  const assigned = new Set(bundles.flatMap((bundle) => bundle.members.map((repo) => repo.id)));
  const unassigned = repos.filter((repo) => !assigned.has(repo.id));
  if (unassigned.length) {
    bundles.push({
      group: { id: "group:other", label: "Other", type: "group", repositoryCount: unassigned.length },
      members: unassigned,
    });
  }

  const totalWeight = Math.max(1, bundles.reduce((sum, bundle) => sum + Math.max(1, bundle.members.length), 0));
  const gutter = bundles.length > 1 ? Math.min(18, usableWidth * 0.018) : 0;
  const available = Math.max(80, usableWidth - gutter * Math.max(0, bundles.length - 1));
  let cursorX = marginX;

  for (const bundle of bundles) {
    const weight = Math.max(1, bundle.members.length);
    const segmentWidth = available * weight / totalWeight;
    const left = cursorX;
    const right = cursorX + segmentWidth;
    const center = (left + right) / 2;
    points.push({ x: center, y: groupY, node: bundle.group, depth: 1, left, right });

    if (bundle.members.length) {
      const widest = Math.max(...bundle.members.slice(0, 30).map((repo) => labelWidth(repo)), 62);
      const slotWidth = clamp(widest + 18, 68, 158);
      const columns = Math.max(1, Math.floor(Math.max(50, segmentWidth) / slotWidth));
      const rows = Math.max(1, Math.ceil(bundle.members.length / columns));
      const rowGap = rows <= 1 ? 0 : Math.max(28, Math.min(54, (repoBottom - repoTop) / Math.max(1, rows - 1)));
      bundle.members.forEach((repo, index) => {
        const row = Math.floor(index / columns);
        const col = index % columns;
        const countInRow = Math.min(columns, bundle.members.length - row * columns);
        const x = countInRow <= 1 ? center : left + segmentWidth * ((col + 1) / (countInRow + 1));
        const y = clamp(repoTop + row * rowGap, repoTop, repoBottom);
        points.push({ x, y, node: repo, depth: 2, parentId: bundle.group.id });
      });
    }
    cursorX = right + gutter;
  }
  return points;
}

function boxesOverlap(a, b, padding = 3) {
  return !(a.right + padding < b.left || b.right + padding < a.left || a.bottom + padding < b.top || b.bottom + padding < a.top);
}

function placeLabels(points, width, height) {
  const ordered = [...points].sort((a, b) => {
    const pa = a.node.type === "owner" ? 10000 : a.node.type === "group" ? 9000 : (a.node.stars ?? 0) * 10 + (a.node.fork ? 0 : 5) - (a.node.archived ? 3 : 0);
    const pb = b.node.type === "owner" ? 10000 : b.node.type === "group" ? 9000 : (b.node.stars ?? 0) * 10 + (b.node.fork ? 0 : 5) - (b.node.archived ? 3 : 0);
    return pb - pa || a.node.label.localeCompare(b.node.label);
  });
  const occupied = [];
  const placements = new Map();
  for (const point of ordered) {
    const node = point.node;
    const fontSize = node.type === "owner" ? 14 : node.type === "group" ? 10.5 : 9.2;
    const widthPx = labelWidth(node, fontSize);
    const heightPx = fontSize + 6;
    const nodeR = node.type === "owner" ? 18 : node.type === "group" ? 7 : 5.5;
    const candidates = node.type === "repository"
      ? [
          { x: point.x, y: point.y + nodeR + 7 },
          { x: point.x, y: point.y - nodeR - heightPx - 5 },
          { x: point.x + nodeR + widthPx / 2 + 7, y: point.y - heightPx / 2 },
          { x: point.x - nodeR - widthPx / 2 - 7, y: point.y - heightPx / 2 },
        ]
      : [{ x: point.x, y: point.y + nodeR + 8 }];
    for (const candidate of candidates) {
      const box = { left: candidate.x - widthPx / 2, right: candidate.x + widthPx / 2, top: candidate.y, bottom: candidate.y + heightPx };
      if (box.left < 8 || box.right > width - 8 || box.top < 8 || box.bottom > height - 30) continue;
      if (occupied.some((other) => boxesOverlap(box, other, node.type === "repository" ? 4 : 6))) continue;
      placements.set(node.id, { ...candidate, fontSize, box });
      occupied.push(box);
      break;
    }
  }
  return placements;
}

function legend(colors, width, height) {
  const items = [[colors.original, "Original"], [colors.fork, "Fork"], [colors.archived, "Archived"]];
  let x = 18;
  return items.map(([color, label]) => {
    const chunk = `<circle cx="${x + 4}" cy="${height - 16}" r="4" fill="${color}"/><text x="${x + 13}" y="${height - 12.5}" fill="${colors.muted}" font-size="9.5">${label}</text>`;
    x += 32 + label.length * 5.8;
    return chunk;
  }).join("") + `<text x="${width - 18}" y="${height - 12.5}" text-anchor="end" fill="${colors.muted}" font-size="9.5">Tree view</text>`;
}

export function renderTreeSvg(graph, theme, width, height) {
  const colors = palette(theme);
  const points = buildTreeLayout(graph, width, height);
  const byId = new Map(points.map((point) => [point.node.id, point]));
  const labels = placeLabels(points, width, height);
  const owner = points.find((point) => point.node.type === "owner");
  const groups = points.filter((point) => point.node.type === "group");

  const structural = [];
  if (owner && groups.length) {
    const branchY = owner.y + Math.max(32, (groups[0].y - owner.y) * 0.47);
    structural.push(`<line x1="${owner.x.toFixed(1)}" y1="${owner.y.toFixed(1)}" x2="${owner.x.toFixed(1)}" y2="${branchY.toFixed(1)}" stroke="${colors.edge}" opacity="0.72"/>`);
    const minGroupX = Math.min(...groups.map((point) => point.x));
    const maxGroupX = Math.max(...groups.map((point) => point.x));
    structural.push(`<line x1="${minGroupX.toFixed(1)}" y1="${branchY.toFixed(1)}" x2="${maxGroupX.toFixed(1)}" y2="${branchY.toFixed(1)}" stroke="${colors.edge}" opacity="0.72"/>`);
    for (const group of groups) {
      structural.push(`<line x1="${group.x.toFixed(1)}" y1="${branchY.toFixed(1)}" x2="${group.x.toFixed(1)}" y2="${group.y.toFixed(1)}" stroke="${colors.edge}" opacity="0.72"/>`);
    }
  }

  for (const group of groups) {
    const members = points.filter((point) => point.node.type === "repository" && point.parentId === group.node.id);
    if (!members.length) continue;
    const junctionY = group.y + Math.max(34, (Math.min(...members.map((point) => point.y)) - group.y) * 0.48);
    structural.push(`<line x1="${group.x.toFixed(1)}" y1="${group.y.toFixed(1)}" x2="${group.x.toFixed(1)}" y2="${junctionY.toFixed(1)}" stroke="${colors.edge}" opacity="0.58"/>`);
    const byRow = new Map();
    for (const member of members) {
      const rowKey = member.y.toFixed(1);
      const row = byRow.get(rowKey) ?? [];
      row.push(member);
      byRow.set(rowKey, row);
    }
    for (const row of byRow.values()) {
      const rowY = row[0].y;
      const rowJunction = Math.min(rowY - 14, junctionY + 18);
      structural.push(`<line x1="${group.x.toFixed(1)}" y1="${junctionY.toFixed(1)}" x2="${group.x.toFixed(1)}" y2="${rowJunction.toFixed(1)}" stroke="${colors.edge}" opacity="0.45"/>`);
      const minX = Math.min(...row.map((point) => point.x));
      const maxX = Math.max(...row.map((point) => point.x));
      structural.push(`<line x1="${minX.toFixed(1)}" y1="${rowJunction.toFixed(1)}" x2="${maxX.toFixed(1)}" y2="${rowJunction.toFixed(1)}" stroke="${colors.edge}" opacity="0.45"/>`);
      for (const member of row) {
        structural.push(`<line x1="${member.x.toFixed(1)}" y1="${rowJunction.toFixed(1)}" x2="${member.x.toFixed(1)}" y2="${member.y.toFixed(1)}" stroke="${colors.edge}" opacity="0.45"/>`);
      }
    }
  }

  const relationLines = graph.edges.filter((edge) => edge.type === "relation").map((edge) => {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) return "";
    return `<line x1="${source.x.toFixed(1)}" y1="${source.y.toFixed(1)}" x2="${target.x.toFixed(1)}" y2="${target.y.toFixed(1)}" stroke="${colors.relation}" stroke-width="1.3" stroke-dasharray="5 4" opacity="0.65"/>`;
  }).join("");

  const nodes = points.map(({ x, y, node }) => {
    const status = statusOf(node);
    const fill = colors[status] || colors.original;
    const radius = node.type === "owner" ? 18 : node.type === "group" ? 7 : clamp(4.8 + Math.log2((node.stars ?? 0) + 1) * 1.15, 4.8, 9.5);
    const placement = labels.get(node.id);
    const label = placement
      ? `<text x="${placement.x.toFixed(1)}" y="${placement.y.toFixed(1)}" text-anchor="middle" fill="${node.type === "group" ? colors.muted : colors.fg}" font-size="${placement.fontSize}" font-weight="${node.type === "owner" ? 700 : node.type === "group" ? 600 : 500}" paint-order="stroke" stroke="${colors.bg}" stroke-width="2" stroke-linejoin="round">${esc(displayLabel(node))}</text>`
      : "";
    const title = node.type === "repository" ? `<title>${esc(`${node.label} · ${status}`)}</title>` : "";
    const archivedRing = node.type === "repository" && node.archived
      ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(radius + 3.2).toFixed(1)}" fill="none" stroke="${colors.archived}" stroke-width="1.1" stroke-dasharray="3 3"/>`
      : "";
    return `<g>${title}<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${fill}" opacity="${node.archived ? 0.74 : 0.97}"/>${archivedRing}${label}</g>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Tree-style map of ${esc(graph.owner)} public GitHub repositories">\n  <rect width="100%" height="100%" rx="14" fill="${colors.bg}"/>\n  <rect x="10" y="10" width="${width - 20}" height="${height - 42}" rx="10" fill="${colors.panel}" opacity="0.3"/>\n  <g>${structural.join("")}</g>\n  <g>${relationLines}</g>\n  <g>${nodes}</g>\n  <g>${legend(colors, width, height)}</g>\n</svg>`;
}
