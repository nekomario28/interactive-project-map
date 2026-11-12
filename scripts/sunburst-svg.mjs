import {
  addExternalBundle,
  isContributedRepository,
  repositoryOpacity,
  repositoryStatus,
  shouldDecorateArchived,
  statusLegendItems,
  withContributedColor,
} from "./static-contributed.mjs";

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}
function palette(theme) {
  const base = theme === "light"
    ? { bg: "#fbfcff", fg: "#172033", muted: "#667085", group: "#376fbd", original: "#208847", fork: "#7357bd", archived: "#a34d45", owner: "#1677a5" }
    : { bg: "#070a12", fg: "#e8edf7", muted: "#9aa7bd", group: "#6aa7ff", original: "#57d17a", fork: "#b59aff", archived: "#d9847b", owner: "#64d2ff" };
  return withContributedColor(base, theme);
}
function groupMembers(group, repos) {
  const key = String(group.id).replace(/^group:/, "");
  return repos.filter((repo) => repo.groupId === key || group.id === `group:${repo.groupId}`);
}
function polar(cx, cy, radius, angle) { return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]; }
function ringPath(cx, cy, inner, outer, start, end) {
  const [x1, y1] = polar(cx, cy, outer, start);
  const [x2, y2] = polar(cx, cy, outer, end);
  const [x3, y3] = polar(cx, cy, inner, end);
  const [x4, y4] = polar(cx, cy, inner, start);
  const large = end - start > Math.PI ? 1 : 0;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${outer.toFixed(1)} ${outer.toFixed(1)} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}L${x3.toFixed(1)} ${y3.toFixed(1)}A${inner.toFixed(1)} ${inner.toFixed(1)} 0 ${large} 0 ${x4.toFixed(1)} ${y4.toFixed(1)}Z`;
}
function outsideGroupLabels(groups, cx, cy, outer, width, height, colors) {
  const labelRadius = outer + 22;
  const sides = { left: [], right: [] };
  for (const group of groups) {
    const mid = (group.start + group.end) / 2;
    const side = Math.cos(mid) >= 0 ? "right" : "left";
    const [, idealY] = polar(cx, cy, labelRadius, mid);
    sides[side].push({ ...group, mid, idealY });
  }
  const pieces = [];
  for (const [side, items] of Object.entries(sides)) {
    items.sort((a, b) => a.idealY - b.idealY);
    let cursor = 30;
    for (const item of items) {
      const y = Math.max(cursor, Math.min(height - 45, item.idealY));
      cursor = y + 15;
      const rightSide = side === "right";
      const labelX = rightSide ? Math.min(width - 18, cx + outer + 35) : Math.max(18, cx - outer - 35);
      const elbowX = rightSide ? labelX - 7 : labelX + 7;
      const [arcX, arcY] = polar(cx, cy, outer + 2, item.mid);
      const label = item.label.length > 20 ? `${item.label.slice(0, 19)}…` : item.label;
      const accent = item.external ? colors.contributed : colors.group;
      pieces.push(`<path d="M${arcX.toFixed(1)} ${arcY.toFixed(1)}L${elbowX.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${accent}" stroke-width="0.9" opacity="0.55"${item.external ? ' stroke-dasharray="4 3"' : ""}/>`);
      pieces.push(`<text x="${labelX.toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="${rightSide ? "start" : "end"}" fill="${item.external ? colors.contributed : colors.muted}" font-size="9.2" font-weight="650">${esc(label)} · ${item.count}</text>`);
    }
  }
  return pieces.join("");
}

export function renderSunburstSvg(graph, theme, width, height) {
  const colors = palette(theme);
  const groups = graph.nodes.filter((node) => node.type === "group");
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const ownedRepos = repos.filter((repo) => !isContributedRepository(repo));
  const cx = width / 2;
  const cy = height / 2 - 7;
  const outer = Math.min(width, height) * 0.34;
  const ownerRadius = outer * 0.21;
  const groupInner = ownerRadius + 8;
  const groupOuter = outer * 0.55;
  const repoInner = groupOuter + 5;
  const repoOuter = outer;
  let bundles = groups.map((group) => ({ group, members: groupMembers(group, ownedRepos) })).filter((bundle) => bundle.members.length);
  bundles = addExternalBundle(bundles, repos);
  const total = Math.max(1, bundles.reduce((sum, bundle) => sum + bundle.members.length, 0));
  let cursor = -Math.PI / 2;
  const pieces = [];
  const groupLabels = [];

  for (const bundle of bundles) {
    const span = (Math.PI * 2 * bundle.members.length) / total;
    const start = cursor;
    const end = cursor + span;
    const gap = Math.min(0.018, span * 0.08);
    const groupColor = bundle.group.external ? colors.contributed : colors.group;
    pieces.push(`<path d="${ringPath(cx, cy, groupInner, groupOuter, start + gap, end - gap)}" fill="${groupColor}" fill-opacity="0.18" stroke="${groupColor}" stroke-width="1" stroke-opacity="0.78"${bundle.group.external ? ' stroke-dasharray="4 3"' : ""}/>`);
    groupLabels.push({ start, end, label: bundle.group.label, count: bundle.members.length, external: bundle.group.external === true });

    const repoSpan = span / bundle.members.length;
    bundle.members.forEach((repo, index) => {
      const rStart = start + index * repoSpan + Math.min(0.009, repoSpan * 0.08);
      const rEnd = start + (index + 1) * repoSpan - Math.min(0.009, repoSpan * 0.08);
      const status = repositoryStatus(repo);
      const color = colors[status];
      const opacity = repositoryOpacity(repo, { archived: 0.68, fork: 0.80, contributed: 0.92 });
      pieces.push(`<g><title>${esc(repo.label)} · ${status}</title><path d="${ringPath(cx, cy, repoInner, repoOuter, rStart, rEnd)}" fill="${color}" fill-opacity="${opacity}"${shouldDecorateArchived(repo) ? ` stroke="${color}" stroke-width="1.1" stroke-dasharray="2 2"` : ` stroke="${colors.bg}" stroke-width="0.8"`}/>`);
      if (repoSpan >= 0.16 || isContributedRepository(repo)) {
        const repoMid = (rStart + rEnd) / 2;
        const [rx, ry] = polar(cx, cy, (repoInner + repoOuter) / 2, repoMid);
        const label = repo.label.length > 11 ? `${repo.label.slice(0, 10)}…` : repo.label;
        pieces.push(`<text x="${rx.toFixed(1)}" y="${(ry + 3).toFixed(1)}" text-anchor="middle" fill="${colors.bg}" font-size="7.8" font-weight="600">${esc(label)}</text>`);
      }
      pieces.push(`</g>`);
    });
    cursor = end;
  }

  pieces.push(outsideGroupLabels(groupLabels, cx, cy, repoOuter, width, height, colors));
  pieces.push(`<circle cx="${cx}" cy="${cy}" r="${ownerRadius.toFixed(1)}" fill="${colors.owner}" opacity="0.96"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="${colors.bg}" font-size="12" font-weight="750">${esc(graph.owner.length > 16 ? `${graph.owner.slice(0, 15)}…` : graph.owner)}</text>`);
  const legend = statusLegendItems(colors).map(([color, label], index) => {
    const x = 18 + index * 94;
    return `<rect x="${x}" y="${height - 22}" width="8" height="8" rx="2" fill="${color}"/><text x="${x + 13}" y="${height - 14.5}" fill="${colors.muted}" font-size="9.5">${label}</text>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Sunburst of ${esc(graph.owner)} public GitHub repositories">\n<rect width="100%" height="100%" rx="16" fill="${colors.bg}"/><g>${pieces.join("")}</g><g>${legend}</g><text x="${width - 18}" y="${height - 14.5}" text-anchor="end" fill="${colors.muted}" font-size="9.5">Sunburst · ${graph.repositoryCount} owned${graph.contributedRepositoryCount ? ` + ${graph.contributedRepositoryCount} contributed` : ""}</text>\n</svg>`;
}
