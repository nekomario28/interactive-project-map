import type { GalaxyGraph, GalaxyNode } from "./types";

type Theme = "dark" | "light";

type Point = { x: number; y: number; node: GalaxyNode };

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char] ?? char));
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function colorFor(text: string, theme: Theme): string {
  const hue = hash(text) % 360;
  const sat = theme === "dark" ? 72 : 62;
  const light = theme === "dark" ? 66 : 42;
  return `hsl(${hue} ${sat}% ${light}%)`;
}

function layout(graph: GalaxyGraph, width: number, height: number): Point[] {
  const cx = width / 2;
  const cy = height / 2;
  const groups = graph.nodes.filter((n) => n.type === "group");
  const repos = graph.nodes.filter((n) => n.type === "repository");
  const points: Point[] = [];
  const owner = graph.nodes.find((n) => n.type === "owner");
  if (owner) points.push({ x: cx, y: cy, node: owner });

  const groupRadius = Math.min(width, height) * 0.28;
  const repoBaseRadius = Math.min(width, height) * 0.39;

  groups.forEach((group, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(groups.length, 1);
    points.push({
      x: cx + Math.cos(angle) * groupRadius,
      y: cy + Math.sin(angle) * groupRadius,
      node: group,
    });

    const members = repos.filter((repo) => repo.groupId && group.id === `group:${repo.groupId}`);
    members.forEach((repo, memberIndex) => {
      const spread = Math.min(0.7, 0.16 + members.length * 0.035);
      const offset = members.length <= 1 ? 0 : ((memberIndex / (members.length - 1)) - 0.5) * spread;
      const jitter = ((hash(repo.id) % 1000) / 1000 - 0.5) * 0.08;
      const radialJitter = ((hash(`${repo.id}:r`) % 1000) / 1000 - 0.5) * Math.min(width, height) * 0.08;
      const r = repoBaseRadius + radialJitter;
      const a = angle + offset + jitter;
      points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, node: repo });
    });
  });

  return points;
}

function repositoryLabels(graph: GalaxyGraph, width: number, height: number): Set<string> {
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const labelBudget = Math.max(12, Math.min(48, Math.floor((width * height) / 9000)));
  if (repos.length <= labelBudget) return new Set(repos.map((repo) => repo.id));

  return new Set(
    [...repos]
      .sort((a, b) =>
        (b.stars ?? 0) - (a.stars ?? 0)
        || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
        || a.label.localeCompare(b.label))
      .slice(0, labelBudget)
      .map((repo) => repo.id),
  );
}

export function renderGalaxySvg(graph: GalaxyGraph, theme: Theme, width: number, height: number): string {
  const dark = theme === "dark";
  const bg = dark ? "#070a12" : "#fbfcff";
  const fg = dark ? "#e8edf7" : "#172033";
  const muted = dark ? "#9aa7bd" : "#667085";
  const edge = dark ? "#344054" : "#cfd6e3";
  const points = layout(graph, width, height);
  const byId = new Map(points.map((p) => [p.node.id, p]));
  const labelledRepos = repositoryLabels(graph, width, height);

  const starSeed = hash(graph.owner);
  const stars = Array.from({ length: 80 }, (_, i) => {
    const x = (hash(`${starSeed}:x:${i}`) % width);
    const y = (hash(`${starSeed}:y:${i}`) % height);
    const r = 0.4 + (hash(`${starSeed}:r:${i}`) % 12) / 10;
    const opacity = 0.12 + (hash(`${starSeed}:o:${i}`) % 45) / 100;
    return `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${fg}" opacity="${opacity.toFixed(2)}"/>`;
  }).join("");

  const lines = graph.edges.map((e) => {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!s || !t) return "";
    return `<line x1="${s.x.toFixed(1)}" y1="${s.y.toFixed(1)}" x2="${t.x.toFixed(1)}" y2="${t.y.toFixed(1)}" stroke="${edge}" stroke-width="1" opacity="0.65"/>`;
  }).join("");

  const nodes = points.map(({ x, y, node }) => {
    if (node.type === "owner") {
      return `<g><circle cx="${x}" cy="${y}" r="27" fill="${colorFor(node.label, theme)}" opacity="0.98"/><circle cx="${x}" cy="${y}" r="34" fill="none" stroke="${colorFor(node.label, theme)}" opacity="0.24"/><text x="${x}" y="${y + 47}" text-anchor="middle" fill="${fg}" font-size="16" font-weight="700">${esc(node.label)}</text></g>`;
    }
    if (node.type === "group") {
      return `<g><circle cx="${x}" cy="${y}" r="7" fill="${colorFor(node.label, theme)}"/><text x="${x}" y="${y - 13}" text-anchor="middle" fill="${muted}" font-size="11" font-weight="600">${esc(node.label)}</text></g>`;
    }
    const r = Math.min(10, 4.5 + Math.log2((node.stars ?? 0) + 1) * 1.4);
    const fill = colorFor(node.language || node.groupLabel || node.label, theme);
    const label = node.label.length > 22 ? `${node.label.slice(0, 20)}…` : node.label;
    const text = labelledRepos.has(node.id)
      ? `<text x="${x}" y="${y + r + 12}" text-anchor="middle" fill="${fg}" font-size="10">${esc(label)}</text>`
      : "";
    return `<g><title>${esc(node.label)}</title><circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${fill}" opacity="${node.fork ? 0.72 : 0.95}"/>${text}</g>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Galaxy map of ${esc(graph.owner)} public GitHub repositories">
  <rect width="100%" height="100%" rx="16" fill="${bg}"/>
  <g>${stars}</g>
  <g>${lines}</g>
  <g>${nodes}</g>
  <text x="18" y="${height - 17}" fill="${muted}" font-size="10">${graph.repositoryCount} public projects · generated ${esc(graph.generatedAt.slice(0, 10))}</text>
</svg>`;
}
