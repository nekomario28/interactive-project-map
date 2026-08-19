import { renderGalaxySvg } from "./svg.mjs";
import { TAU, background, groupMembers, hash, legend, nodeMarkup, palette, svgDocument } from "./galaxy-svg-common.mjs";

const ANIMATED_LIMIT = 80;

function translationValues(radius, startAngle, direction = 1, centerX = 0, centerY = 0, samples = 16) {
  const values = [];
  for (let index = 0; index <= samples; index += 1) {
    const angle = startAngle + direction * TAU * index / samples;
    values.push(`${(centerX + Math.cos(angle) * radius).toFixed(2)} ${(centerY + Math.sin(angle) * radius).toFixed(2)}`);
  }
  return values.join(";");
}

function ellipseValues(rx, ry, startAngle, direction = 1, orientation = 0, samples = 16) {
  const values = [];
  const cosOrientation = Math.cos(orientation);
  const sinOrientation = Math.sin(orientation);
  for (let index = 0; index <= samples; index += 1) {
    const angle = startAngle + direction * TAU * index / samples;
    const localX = Math.cos(angle) * rx;
    const localY = Math.sin(angle) * ry;
    values.push(`${(localX * cosOrientation - localY * sinOrientation).toFixed(2)} ${(localX * sinOrientation + localY * cosOrientation).toFixed(2)}`);
  }
  return values.join(";");
}

function assignments(group, members) {
  const result = [];
  let cursor = 0;
  let lane = 0;
  const seed = ((hash(`${group.id}:hybrid-svg-phase`) % 10000) / 10000) * TAU;
  const direction = (hash(`${group.id}:hybrid-svg-direction`) & 1) === 0 ? 1 : -1;
  while (cursor < members.length) {
    const rx = 25 + lane * 25;
    const ry = rx * 0.68;
    const capacity = Math.max(5, Math.floor((TAU * rx) / 40));
    const take = Math.min(capacity, members.length - cursor);
    for (let index = 0; index < take; index += 1) {
      result.push({
        repo: members[cursor + index],
        lane,
        rx,
        ry,
        phase: seed + TAU * index / Math.max(1, take) + lane * 0.25,
        direction,
        duration: 480 + lane * 240,
      });
    }
    cursor += take;
    lane += 1;
  }
  return result;
}

function denseFallback(graph, theme, width, height) {
  const denseGraph = { ...graph, repositoryCount: Math.max(81, graph.repositoryCount || 0) };
  return renderGalaxySvg(denseGraph, theme, width, height, "galaxy")
    .replace('aria-label="Galaxy-style map', 'data-galaxy-preset="hybrid-dense" aria-label="Galaxy Hybrid dense fallback map')
    .replace('>project map</text>', '>Galaxy Hybrid</text>');
}

function spiralDust(colors, cx, cy, minSize, armCount) {
  const dots = [];
  for (let index = 0; index < 110; index += 1) {
    const arm = index % armCount;
    const t = index / 109;
    const radius = minSize * (0.10 + t * 0.34) + ((hash(`hybrid-svg:dust:r:${index}`) % 17) - 8);
    const angle = -Math.PI / 2 + arm * TAU / armCount + t * 1.72 + ((hash(`hybrid-svg:dust:a:${index}`) % 1000) / 1000 - 0.5) * 0.24;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const opacity = 0.035 + (hash(`hybrid-svg:dust:o:${index}`) % 80) / 1000;
    dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="0.8" fill="${colors.group}" opacity="${opacity.toFixed(3)}"/>`);
  }
  return `<g data-hybrid-dust="true">${dots.join("")}<animateTransform attributeName="transform" type="rotate" from="0 ${cx.toFixed(1)} ${cy.toFixed(1)}" to="360 ${cx.toFixed(1)} ${cy.toFixed(1)}" dur="2400s" repeatCount="indefinite"/></g>`;
}

export function renderGalaxyHybridSvg(graph, theme, width, height) {
  const repositoryCount = graph.repositoryCount ?? graph.nodes.filter((node) => node.type === "repository").length;
  if (repositoryCount > ANIMATED_LIMIT) return denseFallback(graph, theme, width, height);

  const colors = palette(theme);
  const cx = width / 2;
  const cy = height / 2 - 8;
  const minSize = Math.min(width, height);
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const rawGroups = graph.nodes.filter((node) => node.type === "group");
  const owner = graph.nodes.find((node) => node.type === "owner");
  const prepared = rawGroups.map((group) => ({
    group,
    members: groupMembers(group, repos).sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0) || a.label.localeCompare(b.label)),
  })).sort((a, b) => b.members.length - a.members.length || String(a.group.id).localeCompare(String(b.group.id)));
  for (const system of prepared) system.assignments = assignments(system.group, system.members);

  const count = Math.max(1, prepared.length);
  const armCount = count <= 3 ? 1 : count <= 8 ? 2 : 3;
  const tierCount = Math.max(1, Math.ceil(count / armCount));
  const minRadius = minSize * 0.20;
  const maxRadius = minSize * 0.39;
  const showAllLabels = repositoryCount <= 48;

  const systems = prepared.map((system, index) => {
    const armIndex = index % armCount;
    const tier = Math.floor(index / armCount);
    const t = tierCount <= 1 ? 0.35 : tier / Math.max(1, tierCount - 1);
    const globalRadius = minRadius + (maxRadius - minRadius) * t;
    const baseAngle = -Math.PI / 2 + armIndex * TAU / armCount + tier * 0.62;
    const gx = cx + Math.cos(baseAngle) * globalRadius;
    const gy = cy + Math.sin(baseAngle) * globalRadius;
    const categoryMotion = translationValues(globalRadius, baseAngle, 1, cx, cy);
    const orientation = baseAngle + Math.PI / 2;
    const maxRx = Math.max(25, ...system.assignments.map((target) => target.rx));
    const maxRy = Math.max(17, ...system.assignments.map((target) => target.ry));
    const laneGuides = [...new Map(system.assignments.map((target) => [target.lane, target])).values()]
      .map((target) => `<ellipse cx="0" cy="0" rx="${target.rx.toFixed(1)}" ry="${target.ry.toFixed(1)}" transform="rotate(${(orientation * 180 / Math.PI).toFixed(1)})" fill="none" stroke="${colors.group}" stroke-width="0.65" opacity="0.11"/>`).join("");
    const repoMarkup = system.assignments.map((target, repoIndex) => {
      const localX = Math.cos(target.phase) * target.rx;
      const localY = Math.sin(target.phase) * target.ry;
      const cos = Math.cos(orientation);
      const sin = Math.sin(orientation);
      const x = localX * cos - localY * sin;
      const y = localX * sin + localY * cos;
      const motion = ellipseValues(target.rx, target.ry, target.phase, target.direction, orientation);
      const showLabel = showAllLabels || repoIndex < 3 || (target.repo.stars ?? 0) > 0;
      return `<g data-galaxy-orbit="repository" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})">${nodeMarkup(target.repo, 0, 0, colors, { label: showLabel })}<animateTransform attributeName="transform" type="translate" values="${motion}" dur="${target.duration}s" repeatCount="indefinite"/></g>`;
    }).join("");
    return `<g data-hybrid-system="${system.group.id}" transform="translate(${gx.toFixed(2)} ${gy.toFixed(2)})"><ellipse cx="0" cy="0" rx="${(maxRx + 14).toFixed(1)}" ry="${(maxRy + 14).toFixed(1)}" transform="rotate(${(orientation * 180 / Math.PI).toFixed(1)})" fill="${colors.group}" opacity="0.022"/>${laneGuides}${nodeMarkup(system.group, 0, 0, colors)}${repoMarkup}<animateTransform attributeName="transform" type="translate" values="${categoryMotion}" dur="2400s" repeatCount="indefinite"/></g>`;
  }).join("");

  const nucleus = owner ? `<g transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)})"><circle cx="0" cy="0" r="46" fill="${colors.owner}" opacity="0.03"/>${nodeMarkup(owner, 0, 0, colors)}</g>` : "";
  const graphMarkup = `<g data-galaxy-motion="hybrid">${spiralDust(colors, cx, cy, minSize, armCount)}${nucleus}${systems}</g>`;
  return svgDocument({
    owner: graph.owner,
    width,
    height,
    preset: "hybrid",
    ariaLabel: "Galaxy Hybrid",
    backgroundMarkup: background(graph.owner, width, height, colors, 115),
    graphMarkup,
    legendMarkup: legend(colors, width, height, "Galaxy Hybrid"),
  });
}
