import { renderGalaxySvg } from "./svg.mjs";
import { TAU, background, clamp, displayLabel, esc, groupMembers, hash, legend, nodeMarkup, palette, svgDocument } from "./galaxy-svg-common.mjs";

const ANIMATED_LIMIT = 80;
const REPRESENTATIVE_LIMIT = 2;

function circleValues(radius, startAngle, direction = 1, centerX = 0, centerY = 0, samples = 16) {
  const values = [];
  for (let index = 0; index <= samples; index += 1) {
    const angle = startAngle + direction * TAU * index / samples;
    values.push(`${(centerX + Math.cos(angle) * radius).toFixed(2)} ${(centerY + Math.sin(angle) * radius).toFixed(2)}`);
  }
  return values.join(";");
}

function assignments(group, members) {
  const result = [];
  let cursor = 0;
  let lane = 0;
  const seed = ((hash(`${group.id}:systems-svg-phase`) % 10000) / 10000) * TAU;
  const direction = (hash(`${group.id}:systems-svg-direction`) & 1) === 0 ? 1 : -1;
  while (cursor < members.length) {
    const radius = 24 + lane * 23;
    const capacity = Math.max(5, Math.floor((TAU * radius) / 38));
    const take = Math.min(capacity, members.length - cursor);
    for (let index = 0; index < take; index += 1) {
      result.push({
        repo: members[cursor + index],
        lane,
        radius,
        phase: seed + TAU * index / Math.max(1, take) + lane * 0.29,
        direction,
        duration: 360 + lane * 180,
      });
    }
    cursor += take;
    lane += 1;
  }
  return result;
}

function compareLayoutOrder(a, b) {
  return (b.stars ?? 0) - (a.stars ?? 0) || String(a.label).localeCompare(String(b.label));
}

function compareRepresentativePriority(a, b) {
  return (b.stars ?? 0) - (a.stars ?? 0)
    || Number(a.fork === true) - Number(b.fork === true)
    || String(a.label).localeCompare(String(b.label));
}

function categoryMarkup(group, colors) {
  const label = esc(displayLabel(group));
  return `<g data-static-category="${esc(group.id)}"><title>${esc(group.label)}</title><circle cx="0" cy="0" r="13" fill="none" stroke="${colors.group}" stroke-width="0.8" opacity="0.18"/><circle cx="0" cy="0" r="8.5" fill="${colors.group}" opacity="0.98"/><text x="0" y="-15" text-anchor="middle" fill="${colors.fg}" font-size="11.4" font-weight="700" paint-order="stroke" stroke="${colors.bg}" stroke-width="2.6" stroke-linejoin="round">${label}</text></g>`;
}

function denseFallback(graph, theme, width, height) {
  const denseGraph = { ...graph, repositoryCount: Math.max(81, graph.repositoryCount || 0) };
  return renderGalaxySvg(denseGraph, theme, width, height, "galaxy")
    .replace('role="img" aria-label="Galaxy-style map', 'role="img" data-galaxy-preset="systems-dense" aria-label="Galaxy-style map')
    .replace('>project map</text>', '>Galaxy Systems</text>');
}

export function renderGalaxySystemsSvg(graph, theme, width, height) {
  const repositoryCount = graph.repositoryCount ?? graph.nodes.filter((node) => node.type === "repository").length;
  if (repositoryCount > ANIMATED_LIMIT) return denseFallback(graph, theme, width, height);

  const colors = palette(theme);
  const cx = width / 2;
  const cy = height / 2 - 8;
  const minSize = Math.min(width, height);
  const groups = graph.nodes.filter((node) => node.type === "group").sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const owner = graph.nodes.find((node) => node.type === "owner");
  const count = Math.max(1, groups.length);
  const prepared = groups.map((group) => ({
    group,
    members: groupMembers(group, repos).sort(compareLayoutOrder),
  }));
  for (const system of prepared) {
    system.assignments = assignments(system.group, system.members);
    const representatives = [...system.members].sort(compareRepresentativePriority).slice(0, REPRESENTATIVE_LIMIT);
    system.representativeIds = new Set(representatives.map((repo) => repo.id));
  }
  const maxSystemRadius = Math.max(24, ...prepared.flatMap((system) => system.assignments.map((target) => target.radius)));
  const spacingRadius = ((maxSystemRadius * 2 + 34) * count) / TAU;
  const categoryRadius = count === 1 ? minSize * 0.22 : clamp(Math.max(minSize * 0.25, spacingRadius), minSize * 0.25, minSize * 0.40);

  const systems = prepared.map((system, groupIndex) => {
    const baseAngle = -Math.PI / 2 + TAU * groupIndex / count;
    const gx = cx + Math.cos(baseAngle) * categoryRadius;
    const gy = cy + Math.sin(baseAngle) * categoryRadius;
    const categoryMotion = circleValues(categoryRadius, baseAngle, 1, cx, cy);
    const rings = [...new Set(system.assignments.map((target) => target.radius))].sort((a, b) => a - b)
      .map((radius) => `<circle cx="0" cy="0" r="${radius.toFixed(1)}" fill="none" stroke="${colors.group}" stroke-width="0.7" opacity="0.14"/>`).join("");
    const reposMarkup = system.assignments.map((target) => {
      const localX = Math.cos(target.phase) * target.radius;
      const localY = Math.sin(target.phase) * target.radius;
      const motion = circleValues(target.radius, target.phase, target.direction);
      const representative = system.representativeIds.has(target.repo.id);
      return `<g data-galaxy-orbit="repository" data-static-representative="${representative}" transform="translate(${localX.toFixed(2)} ${localY.toFixed(2)})">${nodeMarkup(target.repo, 0, 0, colors, { label: representative })}<animateTransform attributeName="transform" type="translate" values="${motion}" dur="${target.duration}s" repeatCount="indefinite"/></g>`;
    }).join("");
    return `<g data-galaxy-system="${system.group.id}" transform="translate(${gx.toFixed(2)} ${gy.toFixed(2)})"><circle cx="0" cy="0" r="${(maxSystemRadius + 15).toFixed(1)}" fill="${colors.group}" opacity="0.025"/>${rings}${categoryMarkup(system.group, colors)}${reposMarkup}<animateTransform attributeName="transform" type="translate" values="${categoryMotion}" dur="1800s" repeatCount="indefinite"/></g>`;
  }).join("");

  const nucleus = owner ? `<g transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)})"><circle cx="0" cy="0" r="42" fill="${colors.owner}" opacity="0.025"/>${nodeMarkup(owner, 0, 0, colors)}</g>` : "";
  const graphMarkup = `<g data-galaxy-motion="systems">${nucleus}${systems}</g>`;
  return svgDocument({
    owner: graph.owner,
    width,
    height,
    preset: "systems",
    ariaLabel: "Galaxy Systems",
    backgroundMarkup: background(graph.owner, width, height, colors, 100),
    graphMarkup,
    legendMarkup: legend(colors, width, height, "Galaxy Systems"),
  });
}
