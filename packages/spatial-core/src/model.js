function cleanString(value, max = 240) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function finiteOrUndefined(value) {
  return Number.isFinite(value) ? Number(value) : undefined;
}

export function normalizeSpatialNode(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = cleanString(raw.id, 220);
  const label = cleanString(raw.label, 220);
  if (!id || !label) return null;

  const node = {
    id,
    label,
    kind: cleanString(raw.kind, 80) || "item",
  };

  const parentId = cleanString(raw.parentId, 220);
  if (parentId && parentId !== id) node.parentId = parentId;
  const status = cleanString(raw.status, 80);
  if (status) node.status = status;
  const weight = finiteOrUndefined(raw.weight);
  if (weight !== undefined && weight >= 0) node.weight = weight;

  if (raw.positionHint && typeof raw.positionHint === "object") {
    const x = finiteOrUndefined(raw.positionHint.x);
    const y = finiteOrUndefined(raw.positionHint.y);
    if (x !== undefined && y !== undefined) node.positionHint = { x, y };
  }

  if (raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)) {
    node.metadata = { ...raw.metadata };
  }
  return node;
}

export function normalizeSpatialEdge(raw, validIds) {
  if (!raw || typeof raw !== "object") return null;
  const source = cleanString(raw.source, 220);
  const target = cleanString(raw.target, 220);
  if (!source || !target || source === target || !validIds.has(source) || !validIds.has(target)) return null;

  const edge = {
    source,
    target,
    kind: cleanString(raw.kind, 80) || "structural",
  };
  const weight = finiteOrUndefined(raw.weight);
  if (weight !== undefined && weight >= 0) edge.weight = weight;
  if (raw.directed === true) edge.directed = true;
  if (raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)) edge.metadata = { ...raw.metadata };
  return edge;
}

export function normalizeSpatialGraph(raw, options = {}) {
  const maxNodes = Math.max(1, Math.floor(options.maxNodes ?? 5000));
  const maxStructuralEdges = Math.max(0, Math.floor(options.maxStructuralEdges ?? 10000));
  const maxRelationEdges = Math.max(0, Math.floor(options.maxRelationEdges ?? 5000));
  const nodes = [];
  const byId = new Map();

  for (const rawNode of Array.isArray(raw?.nodes) ? raw.nodes.slice(0, maxNodes) : []) {
    const node = normalizeSpatialNode(rawNode);
    if (!node || byId.has(node.id)) continue;
    byId.set(node.id, node);
    nodes.push(node);
  }

  const validIds = new Set(byId.keys());
  for (const node of nodes) {
    if (node.parentId && !validIds.has(node.parentId)) delete node.parentId;
  }

  const normalizeEdges = (rawEdges, cap, defaultKind) => {
    const edges = [];
    const seen = new Set();
    for (const rawEdge of Array.isArray(rawEdges) ? rawEdges.slice(0, cap * 2 || 0) : []) {
      const edge = normalizeSpatialEdge({ kind: defaultKind, ...rawEdge }, validIds);
      if (!edge) continue;
      const key = `${edge.source}\u0000${edge.target}\u0000${edge.kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(edge);
      if (edges.length >= cap) break;
    }
    return edges;
  };

  return {
    version: 1,
    nodes,
    structuralEdges: normalizeEdges(raw?.structuralEdges, maxStructuralEdges, "structural"),
    relationEdges: normalizeEdges(raw?.relationEdges, maxRelationEdges, "relation"),
  };
}
