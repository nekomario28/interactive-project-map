function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}
function statusOf(repo) { return repo.archived ? "archived" : repo.fork ? "fork" : "original"; }
function palette(theme) {
  return theme === "light"
    ? { bg: "#fbfcff", fg: "#172033", muted: "#667085", grid: "#d3dae6", heat: "#376fbd", original: "#208847", fork: "#7357bd", archived: "#a34d45" }
    : { bg: "#070a12", fg: "#e8edf7", muted: "#9aa7bd", grid: "#2a374b", heat: "#6aa7ff", original: "#57d17a", fork: "#b59aff", archived: "#d9847b" };
}
const LANGUAGE_LABELS = new Map([["Rich Text Format", "RTF"], ["Jupyter Notebook", "Jupyter"], ["Visual Basic .NET", "VB.NET"]]);
function languageLabel(language) {
  const alias = LANGUAGE_LABELS.get(language);
  if (alias) return alias;
  return language.length > 12 ? `${language.slice(0, 11)}…` : language;
}
function languageColumns(repos, maxColumns = 7) {
  const counts = new Map();
  for (const repo of repos) counts.set(repo.language || "Other", (counts.get(repo.language || "Other") || 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = sorted.slice(0, maxColumns).map(([language]) => language);
  if (sorted.length > maxColumns) top.push("Other+");
  return top;
}
function cellLanguage(repo, columns) {
  const language = repo.language || "Other";
  return columns.includes(language) ? language : columns.includes("Other+") ? "Other+" : language;
}
function aggregate(graph) {
  const groups = graph.nodes.filter((node) => node.type === "group");
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const columns = languageColumns(repos);
  const rows = groups.map((group) => {
    const key = String(group.id).replace(/^group:/, "");
    const members = repos.filter((repo) => repo.groupId === key || group.id === `group:${repo.groupId}`);
    const cells = columns.map((language) => {
      const cellRepos = members.filter((repo) => cellLanguage(repo, columns) === language);
      const counts = { original: 0, fork: 0, archived: 0 };
      for (const repo of cellRepos) counts[statusOf(repo)] += 1;
      return { language, repos: cellRepos, counts, total: cellRepos.length };
    });
    return { group, cells };
  });
  return { rows, columns, max: Math.max(1, ...rows.flatMap((row) => row.cells.map((cell) => cell.total))) };
}

export function renderMatrixSvg(graph, theme, width, height) {
  const colors = palette(theme);
  const { rows, columns, max } = aggregate(graph);
  const left = Math.min(154, Math.max(104, width * 0.19));
  const top = 52;
  const right = 18;
  const bottom = 42;
  const gridWidth = Math.max(1, width - left - right);
  const gridHeight = Math.max(1, height - top - bottom);
  const cellWidth = gridWidth / Math.max(1, columns.length);
  const cellHeight = gridHeight / Math.max(1, rows.length);
  const pieces = [];

  columns.forEach((language, index) => {
    const x = left + cellWidth * (index + 0.5);
    pieces.push(`<text x="${x.toFixed(1)}" y="${top - 13}" text-anchor="middle" fill="${colors.muted}" font-size="9.5" font-weight="600">${esc(languageLabel(language))}</text>`);
  });

  rows.forEach((row, rowIndex) => {
    const y = top + cellHeight * rowIndex;
    const rowLabel = row.group.label.length > 22 ? `${row.group.label.slice(0, 21)}…` : row.group.label;
    pieces.push(`<text x="${left - 8}" y="${(y + cellHeight / 2 + 3).toFixed(1)}" text-anchor="end" fill="${colors.muted}" font-size="9.5" font-weight="600">${esc(rowLabel)}</text>`);
    row.cells.forEach((cell, columnIndex) => {
      const x = left + cellWidth * columnIndex;
      const intensity = cell.total === 0 ? 0.025 : 0.14 + 0.68 * Math.sqrt(cell.total / max);
      const title = `${row.group.label} × ${cell.language}: ${cell.total} repositories · ${cell.counts.original} original · ${cell.counts.fork} fork · ${cell.counts.archived} archived`;
      pieces.push(`<g><title>${esc(title)}</title><rect x="${(x + 1.5).toFixed(1)}" y="${(y + 1.5).toFixed(1)}" width="${Math.max(0, cellWidth - 3).toFixed(1)}" height="${Math.max(0, cellHeight - 3).toFixed(1)}" rx="4" fill="${colors.heat}" opacity="${intensity.toFixed(2)}" stroke="${colors.grid}" stroke-width="0.8"/>`);
      if (cell.total > 0) {
        const barX = x + 5;
        const barY = y + cellHeight - 7;
        const barWidth = Math.max(4, cellWidth - 10);
        let cursor = barX;
        for (const status of ["original", "fork", "archived"]) {
          const segment = barWidth * cell.counts[status] / cell.total;
          if (segment > 0) pieces.push(`<rect x="${cursor.toFixed(1)}" y="${barY.toFixed(1)}" width="${segment.toFixed(1)}" height="3" fill="${colors[status]}"/>`);
          cursor += segment;
        }
        if (cellWidth >= 35 && cellHeight >= 25) pieces.push(`<text x="${(x + cellWidth / 2).toFixed(1)}" y="${(y + cellHeight / 2 + 3).toFixed(1)}" text-anchor="middle" fill="${colors.fg}" font-size="10" font-weight="700">${cell.total}</text>`);
      }
      pieces.push(`</g>`);
    });
  });

  const legend = [[colors.original, "Original"], [colors.fork, "Fork"], [colors.archived, "Archived"]].map(([color, label], index) => {
    const x = 18 + index * 88;
    return `<rect x="${x}" y="${height - 22}" width="8" height="8" rx="2" fill="${color}"/><text x="${x + 13}" y="${height - 14.5}" fill="${colors.muted}" font-size="9.5">${label}</text>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Category by language heatmap of ${esc(graph.owner)} public GitHub repositories">\n<rect width="100%" height="100%" rx="16" fill="${colors.bg}"/><text x="18" y="21" fill="${colors.fg}" font-size="12" font-weight="700">Category × Language</text><g>${pieces.join("")}</g><g>${legend}</g><text x="${width - 18}" y="${height - 14.5}" text-anchor="end" fill="${colors.muted}" font-size="9.5">Matrix / Heatmap · ${graph.repositoryCount} projects</text>\n</svg>`;
}
