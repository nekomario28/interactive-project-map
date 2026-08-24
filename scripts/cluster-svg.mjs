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
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function palette(theme) {
  const base = theme === "light"
    ? { bg: "#fbfcff", fg: "#172033", muted: "#667085", cluster: "#376fbd", clusterFill: "#e9f1fb", original: "#208847", fork: "#7357bd", archived: "#a34d45" }
    : { bg: "#070a12", fg: "#e8edf7", muted: "#9aa7bd", cluster: "#6aa7ff", clusterFill: "#0d1728", original: "#57d17a", fork: "#b59aff", archived: "#d9847b" };
  return withContributedColor(base, theme);
}
function groupMembers(group, repos) {
  const key = String(group.id).replace(/^group:/, "");
  return repos.filter((repo) => repo.groupId === key || group.id === `group:${repo.groupId}`);
}
function labelWidth(text, fontSize = 9.5) { return clamp(12 + String(text).length * fontSize * 0.58, 38, 150); }
function overlaps(a, b, padding = 3) { return !(a.right + padding < b.left || b.right + padding < a.left || a.bottom + padding < b.top || b.bottom + padding < a.top); }

function clusterLayout(graph, width, height) {
  const groups = graph.nodes.filter((node) => node.type === "group");
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const ownedRepos = repos.filter((repo) => !isContributedRepository(repo));
  let bundles = groups.map((group) => ({ group, members: groupMembers(group, ownedRepos) })).filter((bundle) => bundle.members.length);
  bundles = addExternalBundle(bundles, repos);
  const centerX = width / 2;
  const centerY = height / 2 - 6;
  const orbitX = Math.max(90, width * 0.30);
  const orbitY = Math.max(70, height * 0.25);
  const clusters = [];
  const nodes = [];
  bundles.forEach((bundle, index) => {
    const { group } = bundle;
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(1, bundles.length);
    const cx = bundles.length === 1 ? centerX : centerX + Math.cos(angle) * orbitX;
    const cy = bundles.length === 1 ? centerY : centerY + Math.sin(angle) * orbitY;
    const members = [...bundle.members].sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0) || a.label.localeCompare(b.label));
    const radius = clamp(38 + Math.sqrt(Math.max(1, members.length)) * 13, 48, Math.min(width, height) * 0.21);
    clusters.push({ group, members, cx, cy, radius });
    const golden = Math.PI * (3 - Math.sqrt(5));
    members.forEach((repo, repoIndex) => {
      const nodeRadius = clamp(4.4 + Math.log2((repo.stars ?? 0) + 1) * 1.2, 4.4, 10.5);
      const fraction = Math.sqrt((repoIndex + 0.7) / Math.max(1, members.length + 0.4));
      const localRadius = Math.max(0, radius - 17) * fraction;
      const localAngle = repoIndex * golden;
      nodes.push({ repo, x: cx + Math.cos(localAngle) * localRadius, y: cy + Math.sin(localAngle) * localRadius, radius: nodeRadius });
    });
  });
  return { clusters, nodes };
}

export function renderClusterSvg(graph, theme, width, height) {
  const colors = palette(theme);
  const { clusters, nodes } = clusterLayout(graph, width, height);
  const pieces = [];
  for (const cluster of clusters) {
    const external = cluster.group.external === true;
    pieces.push(`<circle cx="${cluster.cx.toFixed(1)}" cy="${cluster.cy.toFixed(1)}" r="${cluster.radius.toFixed(1)}" fill="${colors.clusterFill}" fill-opacity="0.58" stroke="${external ? colors.contributed : colors.cluster}" stroke-width="1.25" stroke-opacity="0.72"${external ? ' stroke-dasharray="5 4"' : ""}/>`);
    const title = cluster.group.label.length > 22 ? `${cluster.group.label.slice(0, 21)}…` : cluster.group.label;
    const labelY = cluster.cy - cluster.radius - 9;
    pieces.push(`<text x="${cluster.cx.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" fill="${external ? colors.contributed : colors.fg}" font-size="10" font-weight="700">${esc(title)}</text>`);
    pieces.push(`<text x="${cluster.cx.toFixed(1)}" y="${(labelY + 11).toFixed(1)}" text-anchor="middle" fill="${colors.muted}" font-size="8.3">${cluster.members.length} repo${cluster.members.length === 1 ? "" : "s"}</text>`);
  }
  const occupied = [];
  for (const item of nodes) {
    const { repo, x, y, radius } = item;
    const status = repositoryStatus(repo);
    const color = colors[status];
    const opacity = repositoryOpacity(repo, { archived: 0.70, fork: 0.82, contributed: 0.96 });
    pieces.push(`<g><title>${esc(repo.label)} · ${status}</title><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${color}" opacity="${opacity}"${shouldDecorateArchived(repo) ? ` stroke="${color}" stroke-width="1.1" stroke-dasharray="2 2"` : ""}/>`);
    if ((repo.stars ?? 0) > 0 || nodes.length <= 36 || isContributedRepository(repo)) {
      const label = repo.label.length > 18 ? `${repo.label.slice(0, 17)}…` : repo.label;
      const fontSize = 8.8;
      const w = labelWidth(label, fontSize);
      const top = y + radius + 4;
      const box = { left: x - w / 2, right: x + w / 2, top, bottom: top + 13 };
      if (box.left >= 8 && box.right <= width - 8 && box.bottom <= height - 28 && !occupied.some((other) => overlaps(box, other))) {
        occupied.push(box);
        pieces.push(`<text x="${x.toFixed(1)}" y="${(top + 9).toFixed(1)}" text-anchor="middle" fill="${colors.fg}" font-size="${fontSize}" paint-order="stroke" stroke="${colors.bg}" stroke-width="1.8">${esc(label)}</text>`);
      }
    }
    pieces.push(`</g>`);
  }
  const legend = statusLegendItems(colors).map(([color, label], index) => {
    const x = 18 + index * 94;
    return `<circle cx="${x + 4}" cy="${height - 17}" r="4" fill="${color}"/><text x="${x + 13}" y="${height - 13.5}" fill="${colors.muted}" font-size="9.5">${label}</text>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Cluster map of ${esc(graph.owner)} public GitHub repositories">\n<rect width="100%" height="100%" rx="16" fill="${colors.bg}"/>\n<g>${pieces.join("")}</g><g>${legend}</g><text x="${width - 18}" y="${height - 13.5}" text-anchor="end" fill="${colors.muted}" font-size="9.5">Cluster / Bubble · ${graph.repositoryCount} owned${graph.contributedRepositoryCount ? ` + ${graph.contributedRepositoryCount} contributed` : ""}</text>\n</svg>`;
}
