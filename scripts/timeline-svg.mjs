function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function statusOf(repo) { return repo.archived ? "archived" : repo.fork ? "fork" : "original"; }
function palette(theme) {
  return theme === "light"
    ? { bg: "#fbfcff", fg: "#172033", muted: "#667085", grid: "#d7deea", group: "#376fbd", original: "#208847", fork: "#7357bd", archived: "#a34d45" }
    : { bg: "#070a12", fg: "#e8edf7", muted: "#9aa7bd", grid: "#283449", group: "#6aa7ff", original: "#57d17a", fork: "#b59aff", archived: "#d9847b" };
}
function dateMs(repo) {
  const value = repo.createdAt || repo.updatedAt;
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : 0;
}
function groupMembers(group, repos) {
  const key = String(group.id).replace(/^group:/, "");
  return repos.filter((repo) => repo.groupId === key || group.id === `group:${repo.groupId}`);
}
function yearTicks(min, max) {
  const start = new Date(min); const end = new Date(max);
  const years = [];
  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year += 1) years.push(Date.UTC(year, 0, 1));
  return years;
}
function labelWidth(text, fontSize = 9.5) { return clamp(10 + String(text).length * fontSize * 0.57, 38, 150); }
function overlaps(a, b, padding = 3) { return !(a.right + padding < b.left || b.right + padding < a.left || a.bottom + padding < b.top || b.bottom + padding < a.top); }

export function renderTimelineSvg(graph, theme, width, height) {
  const colors = palette(theme);
  const groups = graph.nodes.filter((node) => node.type === "group");
  const repos = graph.nodes.filter((node) => node.type === "repository").filter((repo) => dateMs(repo) > 0);
  const now = Date.now();
  const minDate = repos.length ? Math.min(...repos.map(dateMs)) : now - 365 * 86400000;
  const maxDateRaw = repos.length ? Math.max(...repos.map(dateMs)) : now;
  const span = Math.max(30 * 86400000, maxDateRaw - minDate);
  const min = minDate - span * 0.025;
  const max = maxDateRaw + span * 0.04;
  const left = 126; const right = width - 22; const top = 30; const bottom = height - 48;
  const laneHeight = Math.max(34, (bottom - top) / Math.max(1, groups.length));
  const xFor = (time) => left + ((time - min) / Math.max(1, max - min)) * (right - left);
  const yForGroup = (index) => top + laneHeight * (index + 0.5);
  const pieces = [];

  for (const tick of yearTicks(min, max)) {
    if (tick < min || tick > max) continue;
    const x = xFor(tick);
    pieces.push(`<line x1="${x.toFixed(1)}" y1="${top}" x2="${x.toFixed(1)}" y2="${bottom}" stroke="${colors.grid}" stroke-width="1"/><text x="${(x + 4).toFixed(1)}" y="${top - 8}" fill="${colors.muted}" font-size="9.5">${new Date(tick).getUTCFullYear()}</text>`);
  }

  const occupied = [];
  groups.forEach((group, groupIndex) => {
    const y = yForGroup(groupIndex);
    pieces.push(`<line x1="${left}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}" stroke="${colors.grid}" stroke-width="1" opacity="0.7"/><text x="${left - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" fill="${colors.muted}" font-size="9.5" font-weight="600">${esc(group.label.length > 20 ? `${group.label.slice(0, 19)}…` : group.label)}</text>`);
    const members = groupMembers(group, repos).sort((a, b) => dateMs(a) - dateMs(b));
    members.forEach((repo, repoIndex) => {
      const x = xFor(dateMs(repo));
      const jitter = ((repoIndex % 3) - 1) * 7;
      const cy = y + jitter;
      const color = colors[statusOf(repo)];
      pieces.push(`<g><title>${esc(repo.label)} · ${esc((repo.createdAt || repo.updatedAt || "").slice(0, 10))}</title><circle cx="${x.toFixed(1)}" cy="${cy.toFixed(1)}" r="${repo.archived ? 4.2 : 4.6}" fill="${color}" opacity="${repo.archived ? "0.72" : repo.fork ? "0.82" : "0.96"}"${repo.archived ? ` stroke="${color}" stroke-width="1.2" stroke-dasharray="2 2"` : ""}/>`);
      const important = (repo.stars ?? 0) > 0 || members.length <= 8;
      if (important) {
        const label = repo.label.length > 18 ? `${repo.label.slice(0, 17)}…` : repo.label;
        const w = labelWidth(label);
        const box = { left: x - w / 2, right: x + w / 2, top: cy + 7, bottom: cy + 20 };
        if (box.left >= left && box.right <= right && box.bottom <= bottom + 20 && !occupied.some((other) => overlaps(box, other, 3))) {
          occupied.push(box);
          pieces.push(`<text x="${x.toFixed(1)}" y="${(cy + 16).toFixed(1)}" text-anchor="middle" fill="${colors.fg}" font-size="9">${esc(label)}</text>`);
        }
      }
      pieces.push(`</g>`);
    });
  });

  const legend = [[colors.original, "Original"], [colors.fork, "Fork"], [colors.archived, "Archived"]].map(([color, label], index) => {
    const x = 18 + index * 88;
    return `<circle cx="${x + 4}" cy="${height - 17}" r="4" fill="${color}"/><text x="${x + 13}" y="${height - 13.5}" fill="${colors.muted}" font-size="9.5">${label}</text>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Timeline of ${esc(graph.owner)} public GitHub repositories">\n<rect width="100%" height="100%" rx="16" fill="${colors.bg}"/>\n<text x="18" y="20" fill="${colors.fg}" font-size="12" font-weight="700">Project creation timeline</text>\n<g>${pieces.join("")}</g><g>${legend}</g><text x="${width - 18}" y="${height - 13.5}" text-anchor="end" fill="${colors.muted}" font-size="9.5">Timeline · ${graph.repositoryCount} projects</text>\n</svg>`;
}
