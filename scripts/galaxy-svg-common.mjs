import { TAU, clamp, hashText } from "../packages/spatial-core/src/index.js";
import {
  CONTRIBUTED_DARK,
  CONTRIBUTED_LIGHT,
  repositoryOpacity,
  repositoryStatus,
  shouldDecorateArchived,
  statusLegendItems,
} from "./static-contributed.mjs";

export { TAU, clamp, CONTRIBUTED_DARK, CONTRIBUTED_LIGHT };

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
    ? { bg: "#070a12", bg2: "#0b1120", fg: "#e8edf7", muted: "#9aa7bd", edge: "#344054", owner: "#64d2ff", group: "#6aa7ff", original: "#57d17a", fork: "#b59aff", archived: "#d9847b", contributed: CONTRIBUTED_DARK, relation: "#f4b65f" }
    : { bg: "#fbfcff", bg2: "#f2f6fc", fg: "#172033", muted: "#667085", edge: "#cfd6e3", owner: "#1677a5", group: "#376fbd", original: "#208847", fork: "#7357bd", archived: "#a34d45", contributed: CONTRIBUTED_LIGHT, relation: "#a46618" };
}

export function statusOf(node) {
  return repositoryStatus(node);
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

function unit(seed) {
  return (seed >>> 0) / 0xffffffff;
}

function seededRange(key, minimum, maximum) {
  return minimum + (maximum - minimum) * unit(hash(key));
}

function profileGalaxyAssociation(owner, index, count, cx, cy, categoryRadius, scale, colors) {
  const base = -Math.PI / 2 + TAU * index / Math.max(1, count);
  const x = cx + Math.cos(base) * categoryRadius;
  const y = cy + Math.sin(base) * categoryRadius;
  const tangentDegrees = (base + Math.PI / 2) * 180 / Math.PI;
  const major = (72 + seededRange(`${owner}:profile-association:${index}:major`, -5, 9)) * scale;
  const minor = (30 + seededRange(`${owner}:profile-association:${index}:minor`, -3, 6)) * scale;
  const lobes = Array.from({ length: 4 }, (_, lobeIndex) => {
    const along = seededRange(`${owner}:profile-association:${index}:${lobeIndex}:along`, -0.34, 0.34) * major;
    const across = seededRange(`${owner}:profile-association:${index}:${lobeIndex}:across`, -0.36, 0.36) * minor;
    const rx = major * seededRange(`${owner}:profile-association:${index}:${lobeIndex}:rx`, 0.42, 0.66);
    const ry = minor * seededRange(`${owner}:profile-association:${index}:${lobeIndex}:ry`, 0.50, 0.82);
    const tilt = seededRange(`${owner}:profile-association:${index}:${lobeIndex}:tilt`, -12, 12);
    return `<ellipse cx="${along.toFixed(1)}" cy="${across.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" transform="rotate(${tilt.toFixed(1)} ${along.toFixed(1)} ${across.toFixed(1)})" fill="url(#profile-galaxy-association)"/>`;
  }).join("");
  const stars = Array.from({ length: 7 }, (_, starIndex) => {
    let sx = seededRange(`${owner}:profile-association:${index}:star:${starIndex}:x`, -0.56, 0.56) * major;
    let sy = seededRange(`${owner}:profile-association:${index}:star:${starIndex}:y`, -0.58, 0.58) * minor;
    const normalized = Math.hypot(sx / major, sy / minor);
    if (normalized > 0.90) {
      const shrink = 0.90 / normalized;
      sx *= shrink;
      sy *= shrink;
    }
    const radius = seededRange(`${owner}:profile-association:${index}:star:${starIndex}:r`, 0.45, 0.95) * scale;
    const opacity = seededRange(`${owner}:profile-association:${index}:star:${starIndex}:o`, 0.09, 0.17);
    return `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${radius.toFixed(2)}" fill="${colors.fg}" opacity="${opacity.toFixed(3)}"/>`;
  }).join("");
  return `<g data-profile-stellar-association="${index}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${tangentDegrees.toFixed(1)})">${lobes}${stars}</g>`;
}

export function background(owner, width, height, colors, particleCount = 92, options = {}) {
  // Donor: nekomario28/nekomario28@ead72debca2a16608ebc5b799993c0234ea10cab
  // render_project_map.py + enhance_project_map_preview.py. The background shares
  // the galaxy's center/category axes rather than being unrelated screen-space noise.
  // Keep the donor's rings, stars, associations and nucleus, but omit the central
  // spiral-arm strokes so the background does not read as curved bars from the owner.
  const scale = Math.min(width / 760, height / 560);
  const cx = Number.isFinite(options.cx) ? options.cx : width / 2;
  const cy = Number.isFinite(options.cy) ? options.cy : height / 2 - 8;
  const groupCount = Math.max(1, Number.isFinite(options.groupCount) ? Math.floor(options.groupCount) : 4);
  const yFlatten = 0.63;
  const stars = Array.from({ length: particleCount }, (_, index) => {
    const base = -Math.PI / 2 + TAU * (index % groupCount) / groupCount;
    const radius = 70 * scale + Math.sqrt(unit(hash(`${owner}:profile-star:radius:${index}`))) * 242 * scale;
    const angle = base + ((radius / scale - 128) / 148) * 0.38 + seededRange(`${owner}:profile-star:angle:${index}`, -0.34, 0.34);
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius * yFlatten;
    const starRadius = [0.45, 0.60, 0.75, 0.95][hash(`${owner}:profile-star:size:${index}`) % 4] * scale;
    const opacity = seededRange(`${owner}:profile-star:opacity:${index}`, 0.10, 0.30);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${starRadius.toFixed(2)}" fill="${colors.fg}" opacity="${opacity.toFixed(3)}"/>`;
  }).join("");
  const rings = [132, 194, 256].map((radius) => (
    `<ellipse data-profile-galaxy-ring="${radius}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(radius * scale).toFixed(1)}" ry="${(radius * yFlatten * scale).toFixed(1)}" fill="none" stroke="${colors.muted}" stroke-width="0.55" opacity="0.075"/>`
  )).join("");
  const categoryRadius = Number.isFinite(options.categoryRadius) ? options.categoryRadius : 155 * scale;
  const associations = Array.from({ length: groupCount }, (_, index) => (
    profileGalaxyAssociation(owner, index, groupCount, cx, cy, categoryRadius, scale, colors)
  )).join("");
  return [
    '<defs>',
    `<radialGradient id="galaxy-family-bg" cx="50%" cy="46%" r="72%"><stop offset="0%" stop-color="${colors.bg2}"/><stop offset="100%" stop-color="${colors.bg}"/></radialGradient>`,
    `<radialGradient id="profile-galaxy-nucleus" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${colors.owner}" stop-opacity="0.20"/><stop offset="45%" stop-color="${colors.owner}" stop-opacity="0.045"/><stop offset="100%" stop-color="${colors.owner}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="profile-galaxy-association" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${colors.group}" stop-opacity="0.043"/><stop offset="42%" stop-color="${colors.group}" stop-opacity="0.025"/><stop offset="78%" stop-color="${colors.owner}" stop-opacity="0.008"/><stop offset="100%" stop-color="${colors.group}" stop-opacity="0"/></radialGradient>`,
    '</defs>',
    `<rect width="100%" height="100%" rx="16" fill="url(#galaxy-family-bg)"/>`,
    `<g data-profile-galaxy-background="ead72debca2a16608ebc5b799993c0234ea10cab">${stars}${rings}${associations}<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(92 * scale).toFixed(1)}" fill="url(#profile-galaxy-nucleus)"/></g>`,
  ].join("");
}

export function legend(colors, width, height, label) {
  let x = 18;
  const status = statusLegendItems(colors).map(([color, text]) => {
    const chunk = `<circle cx="${x + 4}" cy="${height - 16}" r="4" fill="${color}"/><text x="${x + 13}" y="${height - 12.5}" fill="${colors.muted}" font-size="9.5">${text}</text>`;
    x += 17 + text.length * 5.8 + 15;
    return chunk;
  }).join("");
  return `${status}<text x="${width - 18}" y="${height - 12.5}" text-anchor="end" fill="${colors.muted}" font-size="9.5">${esc(label)}</text>`;
}

export function nodeMarkup(node, x, y, colors, options = {}) {
  const radius = options.radius ?? nodeRadius(node);
  const status = statusOf(node);
  const fill = colors[status] || colors.original;
  const opacity = node.type === "repository" ? repositoryOpacity(node, { archived: 0.72, contributed: 0.96 }) : 0.96;
  const labelStrokeWidth = options.labelStrokeWidth ?? 2.3;
  const label = options.label === false ? "" : `<text x="${x}" y="${y + radius + (options.labelOffset ?? 12)}" text-anchor="middle" fill="${node.type === "group" ? colors.muted : colors.fg}" font-size="${node.type === "owner" ? 13.5 : node.type === "group" ? 10.5 : 9.2}" font-weight="${node.type === "owner" ? 700 : node.type === "group" ? 650 : 500}" paint-order="stroke" stroke="${colors.bg}" stroke-width="${labelStrokeWidth}" stroke-linejoin="round">${esc(displayLabel(node))}</text>`;
  const archived = shouldDecorateArchived(node) ? `<circle cx="${x}" cy="${y}" r="${radius + 3.3}" fill="none" stroke="${colors.archived}" stroke-width="1.1" stroke-dasharray="3 3"/>` : "";
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
