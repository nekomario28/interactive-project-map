import {
  addExternalBundle,
  isContributedRepository,
  repositoryStatus,
  withContributedColor,
} from "./static-contributed.mjs";

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}
function palette(theme) {
  const base = theme === "light"
    ? { bg: "#fbfcff", fg: "#172033", muted: "#667085", owner: "#1677a5", group: "#376fbd", original: "#208847", fork: "#7357bd", archived: "#a34d45" }
    : { bg: "#070a12", fg: "#e8edf7", muted: "#9aa7bd", owner: "#64d2ff", group: "#6aa7ff", original: "#57d17a", fork: "#b59aff", archived: "#d9847b" };
  return withContributedColor(base, theme);
}
function groupMembers(group, repos) {
  const key = String(group.id).replace(/^group:/, "");
  return repos.filter((repo) => repo.groupId === key || group.id === `group:${repo.groupId}`);
}
function bandPath(x1, y1Top, y1Bottom, x2, y2Top, y2Bottom) {
  const c1 = x1 + (x2 - x1) * 0.42;
  const c2 = x1 + (x2 - x1) * 0.58;
  return `M${x1.toFixed(1)} ${y1Top.toFixed(1)}C${c1.toFixed(1)} ${y1Top.toFixed(1)} ${c2.toFixed(1)} ${y2Top.toFixed(1)} ${x2.toFixed(1)} ${y2Top.toFixed(1)}L${x2.toFixed(1)} ${y2Bottom.toFixed(1)}C${c2.toFixed(1)} ${y2Bottom.toFixed(1)} ${c1.toFixed(1)} ${y1Bottom.toFixed(1)} ${x1.toFixed(1)} ${y1Bottom.toFixed(1)}Z`;
}

function buildSankey(graph, width, height) {
  const groups = graph.nodes.filter((node) => node.type === "group");
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const ownedRepos = repos.filter((repo) => !isContributedRepository(repo));
  let bundles = groups.map((group) => ({ group, members: groupMembers(group, ownedRepos) })).filter((bundle) => bundle.members.length);
  bundles = addExternalBundle(bundles, repos);
  bundles = bundles.map((bundle) => {
    const counts = { original: 0, fork: 0, archived: 0, contributed: 0 };
    for (const repo of bundle.members) counts[repositoryStatus(repo)] += 1;
    return { ...bundle, counts, total: bundle.members.length };
  }).filter((bundle) => bundle.total > 0);
  const total = Math.max(1, bundles.reduce((sum, bundle) => sum + bundle.total, 0));
  const statuses = ["original", "fork", "archived", "contributed"];
  const statusTotals = Object.fromEntries(statuses.map((status) => [status, bundles.reduce((sum, bundle) => sum + bundle.counts[status], 0)]));
  const top = 48;
  const bottom = height - 43;
  const usable = Math.max(80, bottom - top);
  const gap = Math.min(12, usable / Math.max(4, bundles.length * 5));
  const unit = Math.max(2, (usable - gap * Math.max(0, bundles.length - 1)) / total);
  const ownerX = 44;
  const groupX = width * 0.43;
  const statusX = width - 128;
  let cursor = top;
  const groupNodes = [];
  for (const bundle of bundles) {
    const h = Math.max(5, bundle.total * unit);
    groupNodes.push({ ...bundle, y: cursor, h });
    cursor += h + gap;
  }
  const statusGap = 12;
  const statusUsable = usable - statusGap * (statuses.length - 1);
  const statusUnit = statusUsable / total;
  cursor = top;
  const statusNodes = [];
  for (const status of statuses) {
    const h = statusTotals[status] > 0 ? Math.max(5, statusTotals[status] * statusUnit) : 5;
    statusNodes.push({ status, total: statusTotals[status], y: cursor, h });
    cursor += h + statusGap;
  }
  return { bundles, total, ownerX, groupX, statusX, top, usable, unit, groupNodes, statusNodes };
}

export function renderSankeySvg(graph, theme, width, height) {
  const colors = palette(theme);
  const layout = buildSankey(graph, width, height);
  const ownerWidth = 13;
  const groupWidth = 13;
  const statusWidth = 13;
  const pieces = [];

  let ownerCursor = layout.top;
  for (const group of layout.groupNodes) {
    const flowH = group.total * layout.unit;
    const external = group.group.external === true;
    const flowColor = external ? colors.contributed : colors.group;
    const title = external
      ? `External contribution context → ${group.group.label}: ${group.total}`
      : `${graph.owner} → ${group.group.label}: ${group.total}`;
    pieces.push(`<path d="${bandPath(layout.ownerX + ownerWidth, ownerCursor, ownerCursor + flowH, layout.groupX, group.y, group.y + group.h)}" fill="${flowColor}" opacity="${external ? 0.24 : 0.16}"><title>${esc(title)}</title></path>`);
    ownerCursor += flowH;
  }

  const statusCursor = Object.fromEntries(layout.statusNodes.map((node) => [node.status, node.y]));
  for (const group of layout.groupNodes) {
    let groupCursor = group.y;
    for (const statusNode of layout.statusNodes) {
      const count = group.counts[statusNode.status];
      if (!count) continue;
      const sourceH = group.h * count / group.total;
      const targetH = statusNode.total ? statusNode.h * count / statusNode.total : 0;
      pieces.push(`<path d="${bandPath(layout.groupX + groupWidth, groupCursor, groupCursor + sourceH, layout.statusX, statusCursor[statusNode.status], statusCursor[statusNode.status] + targetH)}" fill="${colors[statusNode.status]}" opacity="0.38"><title>${esc(group.group.label)} → ${statusNode.status}: ${count}</title></path>`);
      groupCursor += sourceH;
      statusCursor[statusNode.status] += targetH;
    }
  }

  pieces.push(`<rect x="${layout.ownerX}" y="${layout.top}" width="${ownerWidth}" height="${layout.usable}" rx="4" fill="${colors.owner}"/><text x="${layout.ownerX}" y="${layout.top - 8}" text-anchor="start" fill="${colors.fg}" font-size="10" font-weight="700">Portfolio context</text>`);
  for (const group of layout.groupNodes) {
    const external = group.group.external === true;
    pieces.push(`<rect x="${layout.groupX}" y="${group.y.toFixed(1)}" width="${groupWidth}" height="${group.h.toFixed(1)}" rx="3" fill="${external ? colors.contributed : colors.group}"/><text x="${layout.groupX - 7}" y="${(group.y + group.h / 2 + 3).toFixed(1)}" text-anchor="end" fill="${external ? colors.contributed : colors.muted}" font-size="9.2">${esc(group.group.label.length > 18 ? `${group.group.label.slice(0, 17)}…` : group.group.label)}</text>`);
  }
  for (const node of layout.statusNodes) {
    pieces.push(`<rect x="${layout.statusX}" y="${node.y.toFixed(1)}" width="${statusWidth}" height="${node.h.toFixed(1)}" rx="3" fill="${colors[node.status]}"/><text x="${layout.statusX + statusWidth + 7}" y="${(node.y + node.h / 2 + 3).toFixed(1)}" fill="${colors.fg}" font-size="9.5" font-weight="650">${node.status[0].toUpperCase()}${node.status.slice(1)} ${node.total}</text>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Sankey of ${esc(graph.owner)} public GitHub repositories by portfolio context and repository status">\n<rect width="100%" height="100%" rx="16" fill="${colors.bg}"/><text x="18" y="21" fill="${colors.fg}" font-size="12" font-weight="700">Portfolio context → Category / External → Status</text><g>${pieces.join("")}</g><text x="${width - 18}" y="${height - 14}" text-anchor="end" fill="${colors.muted}" font-size="9.5">Sankey · ${graph.repositoryCount} owned${graph.contributedRepositoryCount ? ` + ${graph.contributedRepositoryCount} contributed` : ""}</text>\n</svg>`;
}
