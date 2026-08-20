import { deterministicScatter, hashText } from "./math.js";

export const DEFAULT_FORCE_SETTINGS = Object.freeze({
  center: 0.0026,
  repel: 9200,
  link: 0.022,
  linkDistance: 138,
  damping: 0.855,
  cooling: 0.986,
});

function hintedPosition(raw, fallback) {
  const x = raw?.positionHint?.x;
  const y = raw?.positionHint?.y;
  return Number.isFinite(x) && Number.isFinite(y) ? { x: Number(x), y: Number(y) } : fallback;
}

export function createForceNodes(rawNodes, options = {}) {
  const nodes = Array.isArray(rawNodes) ? rawNodes : [];
  return nodes.map((raw, index) => {
    const fallback = deterministicScatter(raw?.id ?? index, index, nodes.length, options.scatter);
    const position = hintedPosition(raw, fallback);
    return { ...raw, x: position.x, y: position.y, vx: 0, vy: 0 };
  });
}

export function linkForceEdges(rawEdges, nodes) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return (Array.isArray(rawEdges) ? rawEdges : [])
    .map((edge) => ({ ...edge, sourceNode: byId.get(edge.source), targetNode: byId.get(edge.target) }))
    .filter((edge) => edge.sourceNode && edge.targetNode);
}

export function stepForceLayout(nodes, linkedEdges, alpha, options = {}) {
  if (!Array.isArray(nodes) || !nodes.length || !Number.isFinite(alpha) || alpha < 0.001) return false;
  const settings = { ...DEFAULT_FORCE_SETTINGS, ...(options.settings ?? {}) };
  const draggingId = options.draggingId ?? null;
  const radius = typeof options.radius === "function" ? options.radius : () => 10;

  for (let first = 0; first < nodes.length; first += 1) {
    const a = nodes[first];
    for (let second = first + 1; second < nodes.length; second += 1) {
      const b = nodes[second];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let distanceSquared = dx * dx + dy * dy;
      if (distanceSquared < 1) {
        const angle = (hashText(`${a.id}:${b.id}:obsidian-force`) % 6283) / 1000;
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        distanceSquared = 1;
      }
      const distance = Math.sqrt(distanceSquared);
      const minimum = radius(a) + radius(b) + 18;
      const effectiveSquared = Math.max(distanceSquared, minimum * minimum * 0.28);
      const force = settings.repel * alpha / effectiveSquared;
      const fx = dx / distance * force;
      const fy = dy / distance * force;
      if (a.id !== draggingId) {
        a.vx -= fx;
        a.vy -= fy;
      }
      if (b.id !== draggingId) {
        b.vx += fx;
        b.vy += fy;
      }
    }
  }

  for (const edge of Array.isArray(linkedEdges) ? linkedEdges : []) {
    const a = edge.sourceNode;
    const b = edge.targetNode;
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const amount = (distance - settings.linkDistance) * settings.link * alpha;
    const fx = dx / distance * amount;
    const fy = dy / distance * amount;
    if (a.id !== draggingId) {
      a.vx += fx;
      a.vy += fy;
    }
    if (b.id !== draggingId) {
      b.vx -= fx;
      b.vy -= fy;
    }
  }

  for (const node of nodes) {
    if (node.id === draggingId) {
      node.vx = 0;
      node.vy = 0;
      continue;
    }
    node.vx += -node.x * settings.center * alpha;
    node.vy += -node.y * settings.center * alpha;
    node.vx *= settings.damping;
    node.vy *= settings.damping;
    node.x += node.vx;
    node.y += node.vy;
  }
  return true;
}

export function settleForceLayout(rawNodes, rawEdges, options = {}) {
  const nodes = createForceNodes(rawNodes, options);
  const edges = linkForceEdges(rawEdges, nodes);
  const steps = Math.max(0, Math.floor(options.steps ?? 120));
  const cooling = Number.isFinite(options.cooling) ? options.cooling : (options.settings?.cooling ?? DEFAULT_FORCE_SETTINGS.cooling);
  let alpha = Number.isFinite(options.alpha) ? options.alpha : 1;
  for (let index = 0; index < steps; index += 1) {
    stepForceLayout(nodes, edges, alpha, options);
    alpha *= cooling;
  }
  for (const node of nodes) {
    node.vx = 0;
    node.vy = 0;
  }
  return nodes;
}
