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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function palette(theme) {
  const base = theme === "light"
    ? { bg: "#fbfcff", panel: "#eef3f9", fg: "#172033", muted: "#667085", border: "#ffffff", original: "#2b9851", fork: "#7357bd", archived: "#a34d45", group: "#376fbd" }
    : { bg: "#070a12", panel: "#0d1421", fg: "#e8edf7", muted: "#9aa7bd", border: "#070a12", original: "#57d17a", fork: "#b59aff", archived: "#d9847b", group: "#6aa7ff" };
  return withContributedColor(base, theme);
}

function groupMembers(group, repos) {
  const key = String(group.id).replace(/^group:/, "");
  return repos.filter((repo) => repo.groupId === key || group.id === `group:${repo.groupId}`);
}

function repoWeight(repo) {
  return 1 + Math.log2((repo.stars ?? 0) + 1) * 0.35;
}

function slice(items, rect, horizontal) {
  const total = Math.max(1e-9, items.reduce((sum, item) => sum + item.weight, 0));
  let cursor = horizontal ? rect.x : rect.y;
  return items.map((item, index) => {
    const fraction = item.weight / total;
    const last = index === items.length - 1;
    const size = horizontal ? rect.width * fraction : rect.height * fraction;
    const box = horizontal
      ? { x: cursor, y: rect.y, width: last ? rect.x + rect.width - cursor : size, height: rect.height }
      : { x: rect.x, y: cursor, width: rect.width, height: last ? rect.y + rect.height - cursor : size };
    cursor += size;
    return { ...item, box };
  });
}

function labelFor(repo, width) {
  const maxChars = Math.max(4, Math.floor((width - 12) / 6));
  const label = String(repo.label || "");
  return label.length <= maxChars ? label : `${label.slice(0, Math.max(3, maxChars - 1))}…`;
}

function groupLabel(label, width) {
  const maxChars = Math.max(2, Math.floor((width - 12) / 5.4));
  const text = String(label || "");
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(1, maxChars - 1))}…`;
}

export function renderTreemapSvg(graph, theme, width, height) {
  const colors = palette(theme);
  const groups = graph.nodes.filter((node) => node.type === "group");
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const ownedRepos = repos.filter((repo) => !isContributedRepository(repo));
  let bundles = groups.map((group) => {
    const members = groupMembers(group, ownedRepos).sort((a, b) => repoWeight(b) - repoWeight(a) || a.label.localeCompare(b.label));
    return { group, members, weight: members.reduce((sum, repo) => sum + repoWeight(repo), 0) || 1 };
  }).filter((bundle) => bundle.members.length);
  const assigned = new Set(bundles.flatMap((bundle) => bundle.members.map((repo) => repo.id)));
  const other = ownedRepos.filter((repo) => !assigned.has(repo.id));
  if (other.length) bundles.push({ group: { id: "group:other", label: "Other", type: "group" }, members: other, weight: other.reduce((sum, repo) => sum + repoWeight(repo), 0) });
  bundles = addExternalBundle(bundles, repos, (group, members) => ({ group, members, weight: members.reduce((sum, repo) => sum + repoWeight(repo), 0) || 1 }));

  const plot = { x: 14, y: 16, width: width - 28, height: height - 50 };
  const groupBoxes = slice(bundles, plot, plot.width >= plot.height);
  const pieces = [];
  for (const bundle of groupBoxes) {
    const { box, group, members } = bundle;
    const inset = 4;
    const external = group.external === true;
    pieces.push(`<rect x="${box.x.toFixed(1)}" y="${box.y.toFixed(1)}" width="${Math.max(0, box.width).toFixed(1)}" height="${Math.max(0, box.height).toFixed(1)}" rx="8" fill="${colors.panel}" stroke="${external ? colors.contributed : colors.group}" stroke-width="1.2"${external ? ' stroke-dasharray="4 3"' : ""}/>`);
    if (box.width >= 30 && box.height >= 24) {
      const compact = box.width < 74 || box.height < 34;
      pieces.push(`<text x="${(box.x + (compact ? 5 : 8)).toFixed(1)}" y="${(box.y + (compact ? 13 : 17)).toFixed(1)}" fill="${external ? colors.contributed : colors.fg}" font-size="${compact ? 8.2 : 11}" font-weight="700">${esc(groupLabel(group.label, box.width))}</text>`);
    }
    const header = box.height >= 34 ? 24 : 17;
    const inner = { x: box.x + inset, y: box.y + header, width: Math.max(0, box.width - inset * 2), height: Math.max(0, box.height - header - 4) };
    if (inner.width < 12 || inner.height < 12) continue;
    const repoBoxes = slice(members.map((repo) => ({ repo, weight: repoWeight(repo) })), inner, inner.width < inner.height);
    for (const item of repoBoxes) {
      const repo = item.repo;
      const r = item.box;
      const status = repositoryStatus(repo);
      const fill = colors[status];
      const opacity = repositoryOpacity(repo, { original: 0.90, fork: 0.78, archived: 0.68, contributed: 0.90 });
      pieces.push(`<g><title>${esc(repo.label)} · ${status}</title><rect x="${(r.x + 1).toFixed(1)}" y="${(r.y + 1).toFixed(1)}" width="${Math.max(0, r.width - 2).toFixed(1)}" height="${Math.max(0, r.height - 2).toFixed(1)}" rx="4" fill="${fill}" opacity="${opacity}"${shouldDecorateArchived(repo) ? ` stroke="${fill}" stroke-width="1.2" stroke-dasharray="3 2"` : ""}/>`);
      if (r.width >= 54 && r.height >= 24) {
        const font = clamp(Math.min(11, r.height * 0.28), 8, 11);
        pieces.push(`<text x="${(r.x + 6).toFixed(1)}" y="${(r.y + 15).toFixed(1)}" fill="${colors.bg}" font-size="${font.toFixed(1)}" font-weight="650">${esc(labelFor(repo, r.width))}</text>`);
      }
      pieces.push(`</g>`);
    }
  }

  const legend = statusLegendItems(colors).map(([color, label], index) => {
    const x = 18 + index * 94;
    return `<rect x="${x}" y="${height - 24}" width="8" height="8" rx="2" fill="${color}"/><text x="${x + 13}" y="${height - 16.5}" fill="${colors.muted}" font-size="9.5">${label}</text>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Treemap of ${esc(graph.owner)} public GitHub repositories">\n  <rect width="100%" height="100%" rx="16" fill="${colors.bg}"/>\n  <g>${pieces.join("")}</g>\n  <g>${legend}</g>\n  <text x="${width - 18}" y="${height - 16.5}" text-anchor="end" fill="${colors.muted}" font-size="9.5">Treemap · ${graph.repositoryCount} owned${graph.contributedRepositoryCount ? ` + ${graph.contributedRepositoryCount} contributed` : ""}</text>\n</svg>`;
}
