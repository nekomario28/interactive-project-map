import { renderGalaxySvg } from "./svg.mjs";
import { TAU, background, clamp, displayLabel, esc, groupMembers, hash, legend, nodeMarkup, palette, svgDocument } from "./galaxy-svg-common.mjs";

const ANIMATED_LIMIT = 80;
const REPRESENTATIVE_LIMIT = 2;
const STATIC_LABEL_STROKE_WIDTH = 1.4;
const CONTRIBUTED_PER_LANE = 6;
const REPO_LABEL_FONT_SIZE = 9.2;
const EXTERNAL_LABEL_FONT_SIZE = 8.8;

function systemsDisplayLabel(node, maxChars = 28) {
  const label = String(node?.label || "");
  if (maxChars < 4 || label.length <= maxChars) return label;
  return `${label.slice(0, maxChars - 1)}…`;
}

function estimateTextBox(x, y, text, fontSize, anchor = "middle") {
  const width = Math.max(8, String(text || "").length * fontSize * 0.58 + 4);
  const left = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x - 2;
  return {
    left,
    right: left + width,
    top: y - fontSize * 0.88,
    bottom: y + fontSize * 0.28,
  };
}

function boxesOverlap(a, b, padding = 3) {
  return !(a.right + padding < b.left || b.right + padding < a.left || a.bottom + padding < b.top || b.bottom + padding < a.top);
}

function radialLabelOffset(angle, distance = 12) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const anchor = dx > 0.3 ? "start" : dx < -0.3 ? "end" : "middle";
  return { x: dx * distance, y: dy * distance + 3, anchor };
}

function placeLocalLabel(worldX, worldY, basePhase, text, fontSize, occupied, bounds, padding = 3) {
  const candidateAngles = [basePhase, basePhase + Math.PI, basePhase + Math.PI / 2, basePhase - Math.PI / 2];
  for (const angle of candidateAngles) {
    const offset = radialLabelOffset(angle, 12);
    const box = estimateTextBox(worldX + offset.x, worldY + offset.y, text, fontSize, offset.anchor);
    if (box.left < bounds.left || box.right > bounds.right || box.top < bounds.top || box.bottom > bounds.bottom) continue;
    if (occupied.some((other) => boxesOverlap(box, other, padding))) continue;
    occupied.push(box);
    return { ...offset, text };
  }
  return null;
}

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

function categoryMarkup(group, colors, showLabel = true) {
  return `<g data-static-category="${esc(group.id)}">${nodeMarkup(group, 0, 0, colors, { label: showLabel, labelStrokeWidth: STATIC_LABEL_STROKE_WIDTH })}</g>`;
}

function placedLabelMarkup(placement, colors, fontSize = REPO_LABEL_FONT_SIZE) {
  if (!placement) return "";
  return `<text x="${placement.x.toFixed(1)}" y="${placement.y.toFixed(1)}" text-anchor="${placement.anchor}" fill="${colors.fg}" font-size="${fontSize}" font-weight="500" paint-order="stroke" stroke="${colors.bg}" stroke-width="${STATIC_LABEL_STROKE_WIDTH}" stroke-linejoin="round">${esc(placement.text)}</text>`;
}

function externalLabelMarkup(repo, colors, maxChars = 24) {
  return `<text x="14" y="3.2" text-anchor="start" fill="${colors.fg}" font-size="${EXTERNAL_LABEL_FONT_SIZE}" font-weight="500" paint-order="stroke" stroke="${colors.bg}" stroke-width="${STATIC_LABEL_STROKE_WIDTH}" stroke-linejoin="round">${esc(systemsDisplayLabel(repo, maxChars))}</text>`;
}

function contributedRailLayout(repositories, width, height) {
  const contributed = [...repositories]
    .filter((node) => node?.type === "repository" && node?.relation === "contributed")
    .sort(compareLayoutOrder);
  if (!contributed.length) {
    return { assignments: [], railWidth: 0, railLeft: width, fadeLeft: width, top: 0, bottom: 0, maxChars: 24 };
  }

  const narrow = width < 560;
  const railWidth = narrow
    ? clamp(width * 0.36, 108, 152)
    : clamp(width * 0.24, 152, 190);
  const railLeft = width - railWidth;
  const fadeLeft = railLeft - Math.min(30, railWidth * 0.18);
  const top = Math.max(54, Math.min(60, height * 0.18));
  const bottom = Math.max(top, height - 44);
  const span = Math.max(1, bottom - top);
  const anchorX = railLeft + Math.min(25, railWidth * 0.15);
  const availablePx = Math.max(44, width - (anchorX + 14) - 8);
  const maxChars = Math.min(24, Math.max(8, Math.floor(availablePx / (EXTERNAL_LABEL_FONT_SIZE * 0.6))));
  const minRowGap = narrow ? 20 : 18;
  const maxLabeledRows = Math.max(1, Math.floor(span / minRowGap) + 1);
  const denominator = Math.max(1, contributed.length - 1);
  const assignments = contributed.map((repo, index) => ({
    repo,
    x: anchorX,
    y: contributed.length === 1 ? top + span / 2 : top + span * index / denominator,
    showLabel: index < maxLabeledRows,
  }));
  return { assignments, railWidth, railLeft, fadeLeft, top, bottom, maxChars };
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

function denseFallback(graph, theme, width, height, frameOptions) {
  const denseGraph = { ...graph, repositoryCount: Math.max(81, graph.nodes.filter((node) => node.type === "repository").length) };
  return renderGalaxySvg(denseGraph, theme, width, height, "galaxy", frameOptions)
    .replace('role="img" aria-label="Galaxy-style map', 'role="img" data-galaxy-preset="systems-dense" aria-label="Galaxy-style map')
    .replace('>project map</text>', '>Galaxy Systems</text>');
}

export function renderGalaxySystemsSvg(graph, theme, width, height, frameOptions, options = {}) {
  const contributedLayout = options.contributedLayout ?? "rail";
  if (contributedLayout !== "rail" && contributedLayout !== "halo") throw new RangeError("Invalid SVG Contributed layout: expected halo or rail");
  const repositoryCount = graph.nodes.filter((node) => node.type === "repository").length;
  if (repositoryCount > ANIMATED_LIMIT) return denseFallback(graph, theme, width, height, frameOptions);

  const colors = palette(theme);
  const minSize = Math.min(width, height);
  const groups = graph.nodes.filter((node) => node.type === "group").sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const ownedRepos = repos.filter((node) => node.relation !== "contributed");
  const owner = graph.nodes.find((node) => node.type === "owner");
  const externalLayout = contributedLayout === "rail" ? contributedRailLayout(repos, width, height) : null;
  const ownedWidth = externalLayout?.assignments.length ? externalLayout.fadeLeft : width;
  const ownedMinSize = Math.min(ownedWidth, height);
  const cx = ownedWidth / 2;
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
    ? ownedMinSize * 0.22
    : clamp(Math.max(ownedMinSize * 0.31, spacingRadius), ownedMinSize * 0.31, ownedMinSize * 0.43);

  const haloContributedTargets = contributedLayout === "halo"
    ? contributedAssignments(repos, minSize, categoryRadius, maxSystemRadius)
    : [];

  const labelBounds = {
    left: 6,
    right: externalLayout?.assignments.length ? externalLayout.fadeLeft - 6 : width - 6,
    top: 6,
    bottom: height - 30,
  };
  const haloBounds = { left: 6, right: width - 6, top: 6, bottom: height - 30 };
  const occupied = [];

  if (owner) {
    const ownerRadius = owner.profileStats ? 18 * (1 + Math.min(0.4, 0.06 * Math.log2(1 + owner.profileStats.ownedStars))) : 18;
    occupied.push(estimateTextBox(cx, cy + ownerRadius + 12, displayLabel(owner), 13.5, "middle"));
    if (owner.profileStats) {
      const summary = `F${owner.profileStats.followers ?? "—"} · R${owner.profileStats.originalRepositories} · C${owner.profileStats.contributedRepositories}`;
      occupied.push(estimateTextBox(cx, cy + ownerRadius + 27, summary, 8.4, "middle"));
    }
  }

  if (externalLayout?.assignments.length) {
    occupied.push({
      left: externalLayout.fadeLeft - 2,
      right: width,
      top: 0,
      bottom: height - 26,
    });
  }

  const systemMeta = prepared.map((system, groupIndex) => {
    const baseAngle = -Math.PI / 2 + TAU * groupIndex / count;
    const gx = cx + Math.cos(baseAngle) * categoryRadius;
    const gy = cy + Math.sin(baseAngle) * categoryRadius;
    const categoryBox = estimateTextBox(gx, gy + 7.5 + 12, displayLabel(system.group), 10.5, "middle");
    const categoryOverlap = occupied.some((other) => boxesOverlap(categoryBox, other, 2));
    const showCategoryLabel = !categoryOverlap;
    if (showCategoryLabel) occupied.push(categoryBox);
    return { system, baseAngle, gx, gy, showCategoryLabel };
  });

  const repoMaxChars = width <= 420 ? 15 : 20;
  const maxVisibleRepoLabels = width <= 360 ? 4 : width <= 480 ? 6 : prepared.length * REPRESENTATIVE_LIMIT;
  const maxVisibleHaloLabels = width <= 360 ? 3 : width <= 480 ? 5 : 8;

  const haloPlacements = new Map();
  let placedHaloLabels = 0;
  for (const target of haloContributedTargets) {
    if (placedHaloLabels >= maxVisibleHaloLabels) break;
    const wx = cx + Math.cos(target.phase) * target.radius;
    const wy = cy + Math.sin(target.phase) * target.radius;
    const labelText = systemsDisplayLabel(target.repo, repoMaxChars);
    const placement = placeLocalLabel(wx, wy, target.phase, labelText, REPO_LABEL_FONT_SIZE, occupied, haloBounds, 3);
    if (placement) {
      haloPlacements.set(target.repo.id, placement);
      placedHaloLabels += 1;
    }
  }

  const candidateReps = [];
  for (const meta of systemMeta) {
    for (const target of meta.system.assignments) {
      if (!meta.system.representativeIds.has(target.repo.id)) continue;
      candidateReps.push({ meta, target });
    }
  }
  candidateReps.sort((a, b) => compareRepresentativePriority(a.target.repo, b.target.repo));

  const repoPlacements = new Map();
  let placedRepoLabels = 0;
  for (const { meta, target } of candidateReps) {
    if (placedRepoLabels >= maxVisibleRepoLabels) break;
    const wx = meta.gx + Math.cos(target.phase) * target.radius;
    const wy = meta.gy + Math.sin(target.phase) * target.radius;
    const labelText = systemsDisplayLabel(target.repo, repoMaxChars);
    const placement = placeLocalLabel(wx, wy, target.phase, labelText, REPO_LABEL_FONT_SIZE, occupied, labelBounds, 3);
    if (placement) {
      repoPlacements.set(target.repo.id, placement);
      placedRepoLabels += 1;
    }
  }

function repoMetadataAttr(repo) {
  return typeof repo?.url === "string" && repo.url.startsWith("https://github.com/")
    ? ` data-repo-url="${esc(repo.url)}"`
    : "";
}

  const systems = systemMeta.map(({ system, baseAngle, gx, gy, showCategoryLabel }) => {
    const categoryMotion = circleValues(categoryRadius, baseAngle, 1, cx, cy);
    const rings = [...new Set(system.assignments.map((target) => target.radius))].sort((a, b) => a - b)
      .map((radius) => `<circle cx="0" cy="0" r="${radius.toFixed(1)}" fill="none" stroke="${colors.group}" stroke-width="0.7" opacity="0.14"/>`).join("");
    const reposMarkup = system.assignments.map((target) => {
      const localX = Math.cos(target.phase) * target.radius;
      const localY = Math.sin(target.phase) * target.radius;
      const motion = circleValues(target.radius, target.phase, target.direction);
      const placement = repoPlacements.get(target.repo.id) ?? null;
      const representative = Boolean(placement);
      const labelMarkup = placedLabelMarkup(placement, colors, REPO_LABEL_FONT_SIZE);
      return `<g data-galaxy-orbit="repository" data-static-representative="${representative}" transform="translate(${localX.toFixed(2)} ${localY.toFixed(2)})"${repoMetadataAttr(target.repo)}>${nodeMarkup(target.repo, 0, 0, colors, { label: false })}${labelMarkup}<animateTransform attributeName="transform" type="translate" values="${motion}" dur="${target.duration}s" repeatCount="indefinite"/></g>`;
    }).join("");
    return `<g data-galaxy-system="${system.group.id}" transform="translate(${gx.toFixed(2)} ${gy.toFixed(2)})"><circle cx="0" cy="0" r="${(maxSystemRadius + 15).toFixed(1)}" fill="${colors.group}" opacity="0.025"/>${rings}${categoryMarkup(system.group, colors, showCategoryLabel)}${reposMarkup}<animateTransform attributeName="transform" type="translate" values="${categoryMotion}" dur="1800s" repeatCount="indefinite"/></g>`;
  }).join("");

  const contributed = contributedLayout === "halo"
    ? haloContributedTargets.map((target) => {
      const x = cx + Math.cos(target.phase) * target.radius;
      const y = cy + Math.sin(target.phase) * target.radius;
      const motion = circleValues(target.radius, target.phase, target.direction, cx, cy);
      const labelMarkup = placedLabelMarkup(haloPlacements.get(target.repo.id) ?? null, colors, REPO_LABEL_FONT_SIZE);
      return `<g data-galaxy-orbit="contributed" data-galaxy-placement="external-halo-orbit" data-galaxy-lane="${target.lane}" data-galaxy-radius="${target.radius.toFixed(1)}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})"${repoMetadataAttr(target.repo)}>${nodeMarkup(target.repo, 0, 0, colors, { label: false })}${labelMarkup}<animateTransform attributeName="transform" type="translate" values="${motion}" dur="${target.duration}s" repeatCount="indefinite"/></g>`;
    }).join("")
    : externalLayout.assignments.map((target) => (
      `<g data-galaxy-orbit="contributed" data-galaxy-placement="external-rail" transform="translate(${target.x.toFixed(2)} ${target.y.toFixed(2)})"${repoMetadataAttr(target.repo)}>${nodeMarkup(target.repo, 0, 0, colors, { label: false })}${target.showLabel ? externalLabelMarkup(target.repo, colors, externalLayout.maxChars) : ""}</g>`
    )).join("");

  const nucleus = owner ? `<g transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)})"><circle cx="0" cy="0" r="42" fill="${colors.owner}" opacity="0.025"/>${nodeMarkup(owner, 0, 0, colors)}</g>` : "";
  const ownedGraphMarkup = `<g data-galaxy-motion="systems">${nucleus}${systems}</g>`;
  const externalMarkup = contributedLayout === "halo"
    ? `<g data-galaxy-external="true" data-galaxy-external-layout="halo">${contributed}</g>`
    : externalLayout.assignments.length
      ? `${contributedRailBackdrop(colors, width, height, externalLayout)}<g data-galaxy-external="true" data-galaxy-external-layout="rail">${contributed}</g>`
      : "";
  return svgDocument({
    owner: graph.owner,
    width,
    height,
    frameOptions,
    preset: "systems",
    ariaLabel: "Galaxy Systems",
    backgroundMarkup: (frameHeight) => background(graph.owner, width, frameHeight, colors, 100),
    graphMarkup: contributedLayout === "halo"
      ? `<g data-galaxy-motion="systems">${nucleus}${systems}${externalMarkup}</g>`
      : `${ownedGraphMarkup}${externalMarkup}`,
    legendMarkup: (frameHeight) => legend(colors, width, frameHeight, "Galaxy Systems"),
  });
}
