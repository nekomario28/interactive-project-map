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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isContributed(node: GalaxyNode): boolean {
  return node.type === "repository" && node.relation === "contributed";
}

function nodeRadius(node: GalaxyNode): number {
  if (node.type === "owner") return 24;
  if (node.type === "group") {
    const count = Math.max(1, node.repositoryCount ?? 1);
    return clamp(6.5 + Math.sqrt(count) * 0.9, 7, 11.5);
  }
  return clamp(4.8 + Math.log2((node.stars ?? 0) + 1) * 1.35, 4.8, 11);
}

function displayLabel(node: GalaxyNode): string {
  const raw = String(node.label || "");
  return raw.length <= 24 ? raw : `${raw.slice(0, 22)}…`;
}

function statusPalette(theme: Theme) {
  const dark = theme === "dark";
  return {
    bg: dark ? "#070a12" : "#fbfcff",
    bg2: dark ? "#0d1528" : "#eef4fc",
    fg: dark ? "#e8edf7" : "#172033",
    muted: dark ? "#9aa7bd" : "#667085",
    edge: dark ? "#344054" : "#cfd6e3",
    owner: dark ? "#64d2ff" : "#1677a5",
    group: dark ? "#6aa7ff" : "#376fbd",
    original: dark ? "#57d17a" : "#208847",
    fork: dark ? "#b59aff" : "#7357bd",
    archived: dark ? "#d9847b" : "#a34d45",
    contributed: dark ? "#E69F00" : "#A85D00",
    relation: dark ? "#f4b65f" : "#a46618",
  };
}

function fillForNode(node: GalaxyNode, theme: Theme, colors: ReturnType<typeof statusPalette>): string {
  if (node.type === "owner") return colors.owner;
  if (node.type === "group") return colors.group;
  if (isContributed(node)) return colors.contributed;
  if (node.archived) return colors.archived;
  if (node.fork) return colors.fork;
  return node.language ? colorFor(node.language, theme) : colors.original;
}

function layout(graph: GalaxyGraph, width: number, height: number): Point[] {
  const cx = width / 2;
  const cy = height / 2 - 6;
  const minSize = Math.min(width, height);
  const groups = graph.nodes.filter((n) => n.type === "group");
  const repos = graph.nodes.filter((n) => n.type === "repository");
  const points: Point[] = [];
  const owner = graph.nodes.find((n) => n.type === "owner");
  if (owner) points.push({ x: cx, y: cy, node: owner });

  const groupRadius = minSize * 0.25;
  const repoBaseRadius = minSize * 0.37;
  const laneGap = Math.max(28, minSize * 0.065);
  const groupCount = Math.max(groups.length, 1);
  const sector = (Math.PI * 2) / groupCount;

  groups.forEach((group, index) => {
    const angle = -Math.PI / 2 + sector * index;
    points.push({
      x: cx + Math.cos(angle) * groupRadius,
      y: cy + Math.sin(angle) * groupRadius,
      node: group,
    });

    const key = group.id.replace(/^group:/, "");
    const members = repos
      .filter((repo) => !isContributed(repo) && (repo.groupId === key || group.id === `group:${repo.groupId}`))
      .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0) || a.label.localeCompare(b.label));
    const spread = Math.min(0.72, Math.max(0.18, sector * 0.64));
    const perLane = Math.max(2, Math.floor(spread / 0.16));

    members.forEach((repo, memberIndex) => {
      const lane = Math.floor(memberIndex / perLane);
      const inLane = memberIndex % perLane;
      const laneCount = Math.min(perLane, members.length - lane * perLane);
      const offset = laneCount <= 1 ? 0 : (inLane / (laneCount - 1) - 0.5) * spread;
      const jitter = ((hash(repo.id) % 1000) / 1000 - 0.5) * 0.04;
      const radialJitter = ((hash(`${repo.id}:r`) % 1000) / 1000 - 0.5) * minSize * 0.035;
      const r = repoBaseRadius + lane * laneGap + radialJitter;
      const a = angle + offset + jitter;
      points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, node: repo });
    });
  });

  const assignedIds = new Set(points.map((p) => p.node.id));
  const unassignedOwned = repos.filter((repo) => !assignedIds.has(repo.id) && !isContributed(repo));
  unassignedOwned.forEach((repo, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(1, unassignedOwned.length);
    const r = repoBaseRadius + (index % 2) * (laneGap * 0.65);
    points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, node: repo });
  });

  const contributed = repos
    .filter((repo) => !assignedIds.has(repo.id) && isContributed(repo))
    .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0) || a.label.localeCompare(b.label));
  if (contributed.length) {
    const outerRadius = minSize * 0.44;
    const byExtOwner = new Map<string, GalaxyNode[]>();
    for (const repo of contributed) {
      const extOwner = String(repo.repositoryOwner || repo.label.split("/")[0] || "external").toLowerCase();
      const bucket = byExtOwner.get(extOwner) ?? [];
      bucket.push(repo);
      byExtOwner.set(extOwner, bucket);
    }
    const clusters = [...byExtOwner.entries()];
    clusters.forEach(([extOwner, members], clusterIdx) => {
      const baseAngle = -Math.PI / 2 + (Math.PI * 2 * clusterIdx) / Math.max(1, clusters.length)
        + ((hash(`ext:${extOwner}`) % 1000) / 1000 - 0.5) * 0.22;
      members.forEach((repo, mIdx) => {
        const localSpread = Math.min(0.32, members.length * 0.08);
        const offset = members.length <= 1 ? 0 : (mIdx / (members.length - 1) - 0.5) * localSpread;
        const r = outerRadius + ((hash(`${repo.id}:ext-r`) % 1000) / 1000 - 0.5) * 18;
        const a = baseAngle + offset;
        points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, node: repo });
      });
    });
  }

  return points;
}

type LabelBox = { x: number; y: number; left: number; right: number; top: number; bottom: number; fontSize: number };

function overlaps(a: LabelBox, b: LabelBox, pad = 3): boolean {
  return !(a.right + pad < b.left || b.right + pad < a.left || a.bottom + pad < b.top || b.bottom + pad < a.top);
}

function placeLabels(points: Point[], width: number, height: number): Map<string, LabelBox> {
  const ordered = [...points].sort((a, b) => {
    const score = (n: GalaxyNode) =>
      n.type === "owner" ? 10000 : n.type === "group" ? 9000 : isContributed(n) ? 7500 + (n.stars ?? 0) : (n.stars ?? 0) * 10 + (n.fork ? 0 : 5) - (n.archived ? 4 : 0);
    return score(b.node) - score(a.node) || a.node.label.localeCompare(b.node.label);
  });

  const occupied: LabelBox[] = [];
  const result = new Map<string, LabelBox>();
  const labelBudget = Math.max(16, Math.min(54, Math.floor((width * height) / 7800)));
  let repoLabels = 0;

  for (const { x, y, node } of ordered) {
    if (node.type === "repository" && repoLabels >= labelBudget) continue;
    const fontSize = node.type === "owner" ? 14.5 : node.type === "group" ? 10.8 : 9.5;
    const text = displayLabel(node);
    const w = clamp(12 + text.length * fontSize * 0.58, 40, 185);
    const h = fontSize + 5;
    const r = nodeRadius(node);
    const candidates = [
      { x, y: y + r + 11, top: y + r + 2 },
      { x, y: y - r - 6, top: y - r - h - 2 },
      { x: x + r + 8 + w / 2, y: y + 3, top: y - h / 2 },
      { x: x - r - 8 - w / 2, y: y + 3, top: y - h / 2 },
    ];

    let chosen: LabelBox | null = null;
    for (const c of candidates) {
      const box: LabelBox = { x: c.x, y: c.y, left: c.x - w / 2, right: c.x + w / 2, top: c.top, bottom: c.top + h, fontSize };
      if (box.left < 8 || box.right > width - 8 || box.top < 8 || box.bottom > height - 28) continue;
      if (!occupied.some((other) => overlaps(box, other, node.type === "repository" ? 3 : 5))) {
        chosen = box;
        break;
      }
    }

    if (chosen || node.type === "owner" || node.type === "group") {
      const fallback: LabelBox = chosen ?? {
        x,
        y: clamp(y + r + 11, 14, height - 30),
        left: x - w / 2,
        right: x + w / 2,
        top: y + r + 2,
        bottom: y + r + 2 + h,
        fontSize,
      };
      result.set(node.id, fallback);
      occupied.push(fallback);
      if (node.type === "repository") repoLabels += 1;
    }
  }

  return result;
}

export function renderGalaxySvg(graph: GalaxyGraph, theme: Theme, width: number, height: number): string {
  const colors = statusPalette(theme);
  const cx = width / 2;
  const cy = height / 2 - 6;
  const minSize = Math.min(width, height);
  const points = layout(graph, width, height);
  const byId = new Map(points.map((p) => [p.node.id, p]));
  const labels = placeLabels(points, width, height);

  const starSeed = hash(graph.owner);
  const stars = Array.from({ length: 95 }, (_, i) => {
    const x = hash(`${starSeed}:x:${i}`) % width;
    const y = hash(`${starSeed}:y:${i}`) % height;
    const r = 0.35 + (hash(`${starSeed}:r:${i}`) % 11) / 10;
    const opacity = 0.1 + (hash(`${starSeed}:o:${i}`) % 42) / 100;
    return `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${colors.fg}" opacity="${opacity.toFixed(2)}"/>`;
  }).join("");

  const groupOrbitR = (minSize * 0.25).toFixed(1);
  const repoOrbitR = (minSize * 0.37).toFixed(1);
  const guides = `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${groupOrbitR}" fill="none" stroke="${colors.group}" stroke-width="0.8" stroke-dasharray="3 5" opacity="0.2"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${repoOrbitR}" fill="none" stroke="${colors.edge}" stroke-width="0.7" opacity="0.18"/>`;

  const lines = graph.edges
    .filter((e) => e.type !== "contribution")
    .map((e) => {
      const s = byId.get(e.source);
      const t = byId.get(e.target);
      if (!s || !t) return "";
      const isRel = String(e.type) === "relation";
      const mx = (s.x + t.x) / 2;
      const my = (s.y + t.y) / 2;
      const qx = mx * 0.88 + cx * 0.12;
      const qy = my * 0.88 + cy * 0.12;
      return `<path d="M${s.x.toFixed(1)},${s.y.toFixed(1)} Q${qx.toFixed(1)},${qy.toFixed(1)} ${t.x.toFixed(1)},${t.y.toFixed(1)}" fill="none" stroke="${isRel ? colors.relation : colors.edge}" stroke-width="${isRel ? 1.3 : 0.95}" opacity="${isRel ? 0.68 : 0.44}"${isRel ? ' stroke-dasharray="4 4"' : ""}/>`;
    })
    .join("");

  const nodes = points
    .map(({ x, y, node }) => {
      const r = nodeRadius(node);
      const fill = fillForNode(node, theme, colors);
      const placement = labels.get(node.id);
      const text = placement
        ? `<text x="${placement.x.toFixed(1)}" y="${placement.y.toFixed(1)}" text-anchor="middle" fill="${node.type === "group" ? colors.muted : colors.fg}" font-size="${placement.fontSize}" font-weight="${node.type === "owner" ? 700 : node.type === "group" ? 650 : 500}" paint-order="stroke" stroke="${colors.bg}" stroke-width="2.4" stroke-linejoin="round">${esc(displayLabel(node))}</text>`
        : "";

      if (node.type === "owner") {
        return `<g><title>${esc(node.label)}</title><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r + 7).toFixed(1)}" fill="none" stroke="${fill}" stroke-width="1.1" opacity="0.3"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" opacity="0.98"/>${text}</g>`;
      }
      if (node.type === "group") {
        return `<g><title>${esc(node.label)}</title><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" opacity="0.96"/>${text}</g>`;
      }
      const opacity = isContributed(node) ? 0.96 : node.archived ? 0.72 : node.fork ? 0.82 : 0.95;
      const archivedRing = node.archived && !isContributed(node)
        ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r + 3.2).toFixed(1)}" fill="none" stroke="${colors.archived}" stroke-width="1.1" stroke-dasharray="3 3" opacity="0.88"/>`
        : "";
      return `<g><title>${esc(node.label)}</title><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" opacity="${opacity.toFixed(2)}"/>${archivedRing}${text}</g>`;
    })
    .join("");

  const contributedCount = graph.contributedRepositoryCount ?? graph.nodes.filter(isContributed).length;
  const summary = `${graph.repositoryCount} public projects${contributedCount ? ` + ${contributedCount} contributed` : ""} · generated ${esc(graph.generatedAt.slice(0, 10))}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" role="img" aria-label="Galaxy map of ${esc(graph.owner)} public GitHub repositories">
  <defs>
    <radialGradient id="galaxy-worker-bg" cx="50%" cy="46%" r="72%">
      <stop offset="0%" stop-color="${colors.bg2}"/>
      <stop offset="100%" stop-color="${colors.bg}"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" rx="16" fill="url(#galaxy-worker-bg)"/>
  <g>${stars}</g>
  <g>${guides}</g>
  <g>${lines}</g>
  <g>${nodes}</g>
  <text x="18" y="${height - 15}" fill="${colors.muted}" font-size="10">${summary}</text>
</svg>`;
}

