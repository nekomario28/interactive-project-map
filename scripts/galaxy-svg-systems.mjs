import { renderGalaxySvg } from "./svg.mjs";
import { TAU, background, clamp, displayLabel, esc, groupMembers, hash, legend, nodeMarkup, palette, svgDocument } from "./galaxy-svg-common.mjs";

const ANIMATED_LIMIT = 80;
const REPRESENTATIVE_LIMIT = 2;
const STATIC_LABEL_STROKE_WIDTH = 1.4;

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

function externalLabelMarkup(repo, colors) {
  return `<text x="14" y="3.2" text-anchor="start" fill="${colors.fg}" font-size="8.8" font-weight="500" paint-order="stroke" stroke="${colors.bg}" stroke-width="${STATIC_LABEL_STROKE_WIDTH}" stroke-linejoin="round">${esc(displayLabel(repo))}</text>`;
}

function contributedRailLayout(repositories, width, height) {
  const contributed = [...repositories]
    .filter((node) => node?.type === "repository" && node?.relation === "contributed")
    .sort(compareLayoutOrder);
  if (!contributed.length) {
    return { assignments: [], railWidth: 0, railLeft: width, fadeLeft: width, top: 0, bottom: 0 };
  }

  const railWidth = clamp(width * 0.24, 152, 190);
  const railLeft = width - railWidth;
  const fadeLeft = railLeft - Math.min(30, railWidth * 0.18);
  const top = Math.max(54, Math.min(60, height * 0.18));
  const bottom = Math.max(top, height - 44);
  const span = Math.max(1, bottom - top);
  const anchorX = railLeft + Math.min(25, railWidth * 0.15);
  const denominator = Math.max(1, contributed.length - 1);
  const assignments = contributed.map((repo, index) => ({
    repo,
    x: anchorX,
    y: contributed.length === 1 ? top + span / 2 : top + span * index / denominator,
  }));
  return { assignments, railWidth, railLeft, fadeLeft, top, bottom };
}

function contributedRailBackdrop(colors, width, height, layout) {
  if (!layout.assignments.length) return "";
  const fadeWidth = width - layout.fadeLeft;
  const dividerX = layout.railLeft + 1;
  return [
    '<defs><linearGradient id="galaxy-systems-external-fade" x1="0" y1="0" x2="1" y2="0">',
    `<stop offset="0%" stop-color="${colors.bg}" stop-opacity="0"/>`,
    `<stop offset="18%" stop-color="${colors.bg}" stop-opacity="0.72"/>`,
    `<stop offset="34%" stop-color="${colors.bg}" stop-opacity="0.94"/>`,
    `<stop offset="100%" stop-color="${colors.bg}" stop-opacity="0.985"/>`,
    "</linearGradient></defs>",
    `<rect data-galaxy-external-backdrop="true" x="${layout.fadeLeft.toFixed(1)}" y="0" width="${fadeWidth.toFixed(1)}" height="${(height - 30).toFixed(1)}" fill="url(#galaxy-systems-external-fade)"/>`,
    `<line x1="${dividerX.toFixed(1)}" y1="44" x2="${dividerX.toFixed(1)}" y2="${(height - 40).toFixed(1)}" stroke="${colors.contributed}" stroke-width="0.8" opacity="0.22"/>`,
    `<text x="${(layout.railLeft + 16).toFixed(1)}" y="25" fill="${colors.contributed}" font-size="10.2" font-weight="650">Contributed</text>`,
    `<text x="${(layout.railLeft + 16).toFixed(1)}" y="38" fill="${colors.muted}" font-size="8.2">external repositories</text>`,
  ].join("");
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
  const minSize = Math.min(width, height);
  const groups = graph.nodes.filter((node) => node.type === "group").sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const ownedRepos = repos.filter((node) => node.relation !== "contributed");
  const owner = graph.nodes.find((node) => node.type === "owner");
  const externalLayout = contributedRailLayout(repos, width, height);
  const cx = externalLayout.assignments.length
    ? (width - externalLayout.railWidth * 0.52) / 2
    : width / 2;
  const cy = height / 2 - 8;
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

  const contributed = externalLayout.assignments.map((target) => (
    `<g data-galaxy-orbit="contributed" data-galaxy-placement="external-rail" transform="translate(${target.x.toFixed(2)} ${target.y.toFixed(2)})">${nodeMarkup(target.repo, 0, 0, colors, { label: false })}${externalLabelMarkup(target.repo, colors)}</g>`
  )).join("");

  const nucleus = owner ? `<g transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)})"><circle cx="0" cy="0" r="42" fill="${colors.owner}" opacity="0.025"/>${nodeMarkup(owner, 0, 0, colors)}</g>` : "";
  const ownedGraphMarkup = `<g data-galaxy-motion="systems">${nucleus}${systems}</g>`;
  const externalMarkup = externalLayout.assignments.length
    ? `${contributedRailBackdrop(colors, width, height, externalLayout)}<g data-galaxy-external="true" data-galaxy-external-layout="rail">${contributed}</g>`
    : "";
  return svgDocument({
    owner: graph.owner,
    width,
    height,
    preset: "systems",
    ariaLabel: "Galaxy Systems",
    backgroundMarkup: background(graph.owner, width, height, colors, 100),
    graphMarkup: `${ownedGraphMarkup}${externalMarkup}`,
    legendMarkup: legend(colors, width, height, "Galaxy Systems"),
  });
}
