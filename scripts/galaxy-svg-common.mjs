import { TAU, clamp, hashText } from "../packages/spatial-core/src/index.js";

export { TAU, clamp };

export function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}

export function hash(text) {
  return hashText(text);
}

export function displayLabel(node) {
  const label = String(node?.label || "");
  return label.length <= 28 ? label : `${label.slice(0, 27)}…`;
}

export function palette(theme) {
  const dark = theme === "dark";
  return dark
    ? { bg: "#070a12", bg2: "#0b1120", fg: "#e8edf7", muted: "#9aa7bd", edge: "#344054", owner: "#64d2ff", group: "#6aa7ff", original: "#57d17a", fork: "#b59aff", archived: "#d9847b", relation: "#f4b65f" }
    : { bg: "#fbfcff", bg2: "#f2f6fc", fg: "#172033", muted: "#667085", edge: "#cfd6e3", owner: "#1677a5", group: "#376fbd", original: "#208847", fork: "#7357bd", archived: "#a34d45", relation: "#a46618" };
}

export function statusOf(node) {
  if (node.type !== "repository") return node.type;
  if (node.archived) return "archived";
  return node.fork ? "fork" : "original";
}

export function nodeRadius(node) {
  if (node.type === "owner") return 18;
  if (node.type === "group") return 7.5;
  return clamp(4.8 + Math.log2((node.stars ?? 0) + 1) * 1.25, 4.8, 10.5);
}

export function groupMembers(group, repos) {
  const key = String(group.id).replace(/^group:/, "");
  return repos.filter((repo) => repo.groupId === key || group.id === `group:${repo.groupId}`);
}

export function background(owner, width, height, colors, particleCount = 90) {
  const stars = Array.from({ length: particleCount }, (_, index) => {
    const x = hash(`${owner}:star:x:${index}`) % width;
    const y = hash(`${owner}:star:y:${index}`) % height;
    const radius = 0.35 + (hash(`${owner}:star:r:${index}`) % 10) / 10;
    const opacity = 0.09 + (hash(`${owner}:star:o:${index}`) % 38) / 100;
    return `<circle cx="${x}" cy="${y}" r="${radius.toFixed(1)}" fill="${colors.fg}" opacity="${opacity.toFixed(2)}"/>`;
  }).join("");
  return `<defs><radialGradient id="galaxy-family-bg" cx="50%" cy="46%" r="72%"><stop offset="0%" stop-color="${colors.bg2}"/><stop offset="100%" stop-color="${colors.bg}"/></radialGradient></defs><rect width="100%" height="100%" rx="16" fill="url(#galaxy-family-bg)"/><g>${stars}</g>`;
}

export function legend(colors, width, height, label) {
  const items = [[colors.original, "Original"], [colors.fork, "Fork"], [colors.archived, "Archived"]];
  let x = 18;
  const status = items.map(([color, text]) => {
    const chunk = `<circle cx="${x + 4}" cy="${height - 16}" r="4" fill="${color}"/><text x="${x + 13}" y="${height - 12.5}" fill="${colors.muted}" font-size="9.5">${text}</text>`;
    x += 17 + text.length * 5.8 + 15;
    return chunk;
  }).join("");
  return `${status}<text x="${width - 18}" y="${height - 12.5}" text-anchor="end" fill="${colors.muted}" font-size="9.5">${esc(label)}</text>`;
}

export function nodeMarkup(node, x, y, colors, options = {}) {
  const radius = options.radius ?? nodeRadius(node);
  const fill = colors[statusOf(node)] || colors.original;
  const opacity = node.archived ? 0.72 : 0.96;
  const labelStrokeWidth = options.labelStrokeWidth ?? 2.3;
  const label = options.label === false ? "" : `<text x="${x}" y="${y + radius + (options.labelOffset ?? 12)}" text-anchor="middle" fill="${node.type === "group" ? colors.muted : colors.fg}" font-size="${node.type === "owner" ? 13.5 : node.type === "group" ? 10.5 : 9.2}" font-weight="${node.type === "owner" ? 700 : node.type === "group" ? 650 : 500}" paint-order="stroke" stroke="${colors.bg}" stroke-width="${labelStrokeWidth}" stroke-linejoin="round">${esc(displayLabel(node))}</text>`;
  const archived = node.type === "repository" && node.archived ? `<circle cx="${x}" cy="${y}" r="${radius + 3.3}" fill="none" stroke="${colors.archived}" stroke-width="1.1" stroke-dasharray="3 3"/>` : "";
  return `<g><title>${esc(node.label)}</title><circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" opacity="${opacity}"/>${archived}${label}</g>`;
}

export function motionValuesCircle(radius, startAngle, samples = 12) {
  const values = [];
  for (let index = 0; index <= samples; index += 1) {
    const angle = startAngle + TAU * index / samples;
    values.push(`${(Math.cos(angle) * radius).toFixed(2)} ${(Math.sin(angle) * radius).toFixed(2)}`);
  }
  return values.join(";");
}

export function motionValuesEllipse(rx, ry, startAngle, orientation = 0, samples = 12) {
  const values = [];
  const cosOrientation = Math.cos(orientation);
  const sinOrientation = Math.sin(orientation);
  for (let index = 0; index <= samples; index += 1) {
    const angle = startAngle + TAU * index / samples;
    const localX = Math.cos(angle) * rx;
    const localY = Math.sin(angle) * ry;
    const x = localX * cosOrientation - localY * sinOrientation;
    const y = localX * sinOrientation + localY * cosOrientation;
    values.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return values.join(";");
}

export function svgDocument({ owner, width, height, ariaLabel, backgroundMarkup, graphMarkup, legendMarkup, preset }) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" data-galaxy-preset="${esc(preset)}" aria-label="${esc(ariaLabel)} map of ${esc(owner)} public GitHub repositories">\n  ${backgroundMarkup}\n  ${graphMarkup}\n  <g>${legendMarkup}</g>\n</svg>`;
}
