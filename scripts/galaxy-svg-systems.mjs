import { renderGalaxySvg } from "./svg.mjs";
import { TAU, background, clamp, displayLabel, esc, groupMembers, hash, legend, nodeMarkup, palette, svgDocument } from "./galaxy-svg-common.mjs";

const ANIMATED_LIMIT = 80;
const REPRESENTATIVE_LIMIT = 2;
const STATIC_LABEL_STROKE_WIDTH = 1.4;
const CONTRIBUTED_PER_LANE = 6;

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
    const radius = 42 + lane * 30;
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
  return `<g data-static-category="${esc(group.id)}">${nodeMarkup(group, 0, 0, colors, { labelStrokeWidth: STATIC_LABEL_STROKE_WIDTH })}</g>`;
}

function representativeLabelMarkup(repo, phase, colors) {
  const dx = Math.cos(phase);
  const dy = Math.sin(phase);
  const distance = 12;
  const x = dx * distance;
  const y = dy * distance + 3;
  const anchor = dx > 0.3 ? "start" : dx < -0.3 ? "end" : "middle";
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" fill="${colors.fg}" font-size="9.2" font-weight="500" paint-order="stroke" stroke="${colors.bg}" stroke-width="${STATIC_LABEL_STROKE_WIDTH}" stroke-linejoin="round">${esc(displayLabel(repo))}</text>`;
}

function contributedAssignments(repositories, minSize, categoryRadius, maxSystemRadius) {
  const contributed = [...repositories]
    .filter((node) => node?.type === "repository" && node?.relation === "contributed")
    .sort(compareLayoutOrder);
  if (!contributed.length) return [];

  // Keep Contributed in the same Galaxy world without placing it inside owned
  // taxonomy space. The first halo clears the swept owned envelope and every
  // later lane expands outward.
  const baseRadius = Math.max(minSize * 0.39, categoryRadius + maxSystemRadius + 34);
  const laneSpacing = Math.max(34, minSize * 0.075);
  return contributed.map((repo, index) => {
    const lane = Math.floor(index / CONTRIBUTED_PER_LANE);
    const inLane = index % CONTRIBUTED_PER_LANE;
    const laneCount = Math.min(CONTRIBUTED_PER_LANE, contributed.length - lane * CONTRIBUTED_PER_LANE);
    const seed = (hash(`${repo.id}:contributed-systems-svg-phase`) % 10000) / 10000;
    const phase = -Math.PI / 2 + TAU * (inLane + seed * 0.28) / Math.max(1, laneCount);
    const radius = baseRadius + lane * laneSpacing;
    const direction = (hash(`${repo.id}:contributed-systems-svg-direction`) & 1) === 0 ? 1 : -1;
    return { repo, lane, phase, radius, direction, duration: 920 + lane * 180 };
  });
}

function denseFallback(graph, theme, width, height) {
  const denseGraph = { ...graph, repositoryCount: Math.max(81, graph.nodes.filter((node) => node.type === "repository").length) };
  return renderGalaxySvg(denseGraph, theme, width, height, "galaxy")
    .replace('role="img" aria-label="Galaxy-style map', 'role="img" data-galaxy-preset="systems-dense" aria-label="Galaxy-style map')
    .replace('>project map</text>', '>Galaxy Systems</text>');
}

export function renderGalaxySystemsSvg(graph, theme, width, height) {
  const repositoryCount = graph.nodes.filter((node) => node.type === "repository").length;
  if (repositoryCount > ANIMATED_LIMIT) return denseFallback(graph, theme, width, height);

  const colors = palette(theme);
  const cx = width / 2;
  const cy = height / 2 - 8;
  const minSize = Math.min(width, height);
  const groups = graph.nodes.filter((node) => node.type === "group").sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const ownedRepos = repos.filter((node) => node.relation !== "contributed");
  const owner = graph.nodes.find((node) => node.type === "owner");
  const count = Math.max(1, groups.length);
  const prepared = groups.map((group) => ({
    group,
    members: groupMembers(group, ownedRepos).sort(compareLayoutOrder),
  }));
  for (const system of prepared) {
    system.assignments = assignments(system.group, system.members);
    const representatives = [...system.members].sort(compareRepresentativePriority).slice(0, REPRESENTATIVE_LIMIT);
    system.representativeIds = new Set(representatives.map((repo) => repo.id));
  }
  const maxSystemRadius = Math.max(42, ...prepared.flatMap((system) => system.assignments.map((target) => target.radius)));
  const spacingRadius = ((maxSystemRadius * 2 + 34) * count) / TAU;
  const categoryRadius = count === 1
    ? minSize * 0.22
    : clamp(Math.max(minSize * 0.31, spacingRadius), minSize * 0.31, minSize * 0.43);

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
      const labelMarkup = representative ? representativeLabelMarkup(target.repo, target.phase, colors) : "";
      return `<g data-galaxy-orbit="repository" data-static-representative="${representative}" transform="translate(${localX.toFixed(2)} ${localY.toFixed(2)})">${nodeMarkup(target.repo, 0, 0, colors, { label: false })}${labelMarkup}<animateTransform attributeName="transform" type="translate" values="${motion}" dur="${target.duration}s" repeatCount="indefinite"/></g>`;
    }).join("");
    return `<g data-galaxy-system="${system.group.id}" transform="translate(${gx.toFixed(2)} ${gy.toFixed(2)})"><circle cx="0" cy="0" r="${(maxSystemRadius + 15).toFixed(1)}" fill="${colors.group}" opacity="0.025"/>${rings}${categoryMarkup(system.group, colors)}${reposMarkup}<animateTransform attributeName="transform" type="translate" values="${categoryMotion}" dur="1800s" repeatCount="indefinite"/></g>`;
  }).join("");

  const contributedTargets = contributedAssignments(repos, minSize, categoryRadius, maxSystemRadius);
  const contributed = contributedTargets.map((target) => {
    const x = cx + Math.cos(target.phase) * target.radius;
    const y = cy + Math.sin(target.phase) * target.radius;
    const motion = circleValues(target.radius, target.phase, target.direction, cx, cy);
    return `<g data-galaxy-orbit="contributed" data-galaxy-placement="external-halo-orbit" data-galaxy-lane="${target.lane}" data-galaxy-radius="${target.radius.toFixed(1)}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})">${nodeMarkup(target.repo, 0, 0, colors, { label: false })}${representativeLabelMarkup(target.repo, target.phase, colors)}<animateTransform attributeName="transform" type="translate" values="${motion}" dur="${target.duration}s" repeatCount="indefinite"/></g>`;
  }).join("");

  const nucleus = owner ? `<g transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)})"><circle cx="0" cy="0" r="42" fill="${colors.owner}" opacity="0.025"/>${nodeMarkup(owner, 0, 0, colors)}</g>` : "";
  const graphMarkup = `<g data-galaxy-motion="systems">${nucleus}${systems}<g data-galaxy-external="true" data-galaxy-external-layout="halo">${contributed}</g></g>`;
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
