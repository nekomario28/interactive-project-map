import { normalizeSpatialGraph } from "../model.js";

function galaxyStatus(node) {
  if (node?.type !== "repository") return node?.type || "item";
  if (node.archived === true) return "archived";
  return node.fork === true ? "fork" : "original";
}

function repositoryWeight(node) {
  const stars = Number.isFinite(node?.stars) ? Math.max(0, node.stars) : 0;
  return 1 + Math.log2(stars + 1);
}

export function adaptGalaxyGraph(graph, options = {}) {
  const rawNodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const rawEdges = Array.isArray(graph?.edges) ? graph.edges : [];
  const parentByChild = new Map();

  for (const edge of rawEdges) {
    if (!edge || typeof edge !== "object") continue;
    if (edge.type === "ownership" || edge.type === "membership") parentByChild.set(edge.target, edge.source);
  }

  const nodes = rawNodes.map((node) => ({
    id: node.id,
    label: node.label,
    kind: node.type,
    parentId: parentByChild.get(node.id),
    status: galaxyStatus(node),
    weight: node.type === "repository" ? repositoryWeight(node) : Math.max(1, Number(node.repositoryCount) || 1),
    metadata: {
      url: node.url,
      description: node.description,
      language: node.language,
      topics: node.topics,
      stars: node.stars,
      forks: node.forks,
      fork: node.fork,
      archived: node.archived,
      updatedAt: node.updatedAt,
      groupId: node.groupId,
      groupLabel: node.groupLabel,
      classification: node.classification,
      taxonomyAssignment: node.taxonomyAssignment,
    },
  }));

  const structuralEdges = rawEdges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    kind: edge.type || "structural",
    directed: true,
  }));

  const relationEdges = (Array.isArray(graph?.semanticEdges) ? graph.semanticEdges : []).map((edge) => ({
    source: edge.source,
    target: edge.target,
    kind: edge.type || "semantic",
    weight: edge.score,
    metadata: { score: edge.score },
  }));

  return normalizeSpatialGraph({ nodes, structuralEdges, relationEdges }, options);
}
