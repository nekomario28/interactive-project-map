import { TAU, background, clamp, groupMembers, hash, legend, nodeMarkup, palette, svgDocument } from "./galaxy-svg-common.mjs";
import { isContributedRepository } from "./static-contributed.mjs";

const CONTRIBUTED_PER_LANE = 8;

function ownedRepositoryPoints(groups, repositories, cx, cy, minSize) {
  const points = [];
  const count = Math.max(1, groups.length);
  const sector = TAU / count;
  const groupRadius = minSize * 0.20;
  const firstLane = minSize * 0.31;
  const laneGap = Math.max(42, minSize * 0.095);

  groups.forEach((group, groupIndex) => {
    const base = -Math.PI / 2 + sector * groupIndex;
    points.push({ node: group, x: cx + Math.cos(base) * groupRadius, y: cy + Math.sin(base) * groupRadius, group: true });
    const members = groupMembers(group, repositories)
      .filter((repo) => !isContributedRepository(repo))
      .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0) || String(a.label).localeCompare(String(b.label)));
    const spread = Math.min(1.05, sector * 0.70);
    let cursor = 0;
    let lane = 0;
    while (cursor < members.length) {
      const radius = firstLane + lane * laneGap;
      const capacity = Math.max(1, Math.floor(Math.max(0.18, spread) / 0.17));
      const take = Math.min(capacity, members.length - cursor);
      for (let index = 0; index < take; index += 1) {
        const repo = members[cursor + index];
        const offset = take <= 1 ? 0 : (index / (take - 1) - 0.5) * spread;
        const jitter = ((hash(`${repo.id}:classic-angle`) % 1000) / 1000 - 0.5) * 0.035;
        const angle = base + offset + jitter + lane * 0.04;
        points.push({ node: repo, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, repository: true });
      }
      cursor += take;
      lane += 1;
    }
  });
  return points;
}

function contributedPoints(repositories, cx, cy, minSize) {
  const contributed = repositories
    .filter(isContributedRepository)
    .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0) || String(a.id).localeCompare(String(b.id)));
  const outerRadius = minSize * 0.455;
  const laneGap = Math.max(30, minSize * 0.072);
  return contributed.map((repo, index) => {
    const lane = Math.floor(index / CONTRIBUTED_PER_LANE);
    const inLane = index % CONTRIBUTED_PER_LANE;
    const laneCount = Math.min(CONTRIBUTED_PER_LANE, contributed.length - lane * CONTRIBUTED_PER_LANE);
    const seed = (hash(`${repo.id}:classic-contributed-phase`) % 10000) / 10000;
    const angle = -Math.PI / 2 + TAU * (inLane + seed * 0.25) / Math.max(1, laneCount);
    const radius = Math.max(minSize * 0.30, outerRadius - lane * laneGap);
    return { node: repo, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, contributed: true };
  });
}

export function renderGalaxyClassicSvg(graph, theme, width, height) {
  const colors = palette(theme);
  const cx = width / 2;
  const cy = height / 2 - 8;
  const minSize = Math.min(width, height);
  const groups = graph.nodes.filter((node) => node.type === "group").sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const repositories = graph.nodes.filter((node) => node.type === "repository");
  const owner = graph.nodes.find((node) => node.type === "owner");
  const owned = ownedRepositoryPoints(groups, repositories, cx, cy, minSize);
  const external = contributedPoints(repositories, cx, cy, minSize);

  const groupGuides = owned.filter((point) => point.group).map((point) => {
    const radius = Math.max(32, minSize * 0.085);
    return `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${colors.group}" opacity="0.025"/>`;
  }).join("");

  const ownedMarkup = owned.map((point) => {
    const marker = point.repository ? ' data-galaxy-orbit="repository"' : "";
    return `<g${marker}>${nodeMarkup(point.node, point.x, point.y, colors, { label: true })}</g>`;
  }).join("");
  const externalMarkup = external.map((point) => `<g data-galaxy-orbit="contributed">${nodeMarkup(point.node, point.x, point.y, colors, { label: true })}</g>`).join("");
  const nucleus = owner ? `<g><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="45" fill="${colors.owner}" opacity="0.03"/>${nodeMarkup(owner, cx, cy, colors)}</g>` : "";

  return svgDocument({
    owner: graph.owner,
    width,
    height,
    preset: "classic",
    ariaLabel: "Galaxy-style",
    backgroundMarkup: background(graph.owner, width, height, colors, 100),
    graphMarkup: `<g data-galaxy-motion="classic-static">${groupGuides}${nucleus}${ownedMarkup}<g data-galaxy-external="true">${externalMarkup}</g></g>`,
    legendMarkup: legend(colors, width, height, "Galaxy Classic"),
  });
}
