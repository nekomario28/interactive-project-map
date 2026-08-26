import { ProjectMapViewModel } from "./index.js";

export function createProjectMapLocalGraphApi(dependencies = {}) {
  const MAX_DEPTH = 3;

  function normalizeDepth(value) {
    return Math.max(1, Math.min(MAX_DEPTH, Math.round(Number(value) || 1)));
  }

  function relationEdges(graph) {
    const repositoryIds = new Set(
      (Array.isArray(graph?.nodes) ? graph.nodes : [])
        .filter((node) => node?.type === "repository")
        .map((node) => node.id),
    );
    const result = [];
    for (const edge of Array.isArray(graph?.edges) ? graph.edges : []) {
      if (!["relation", "semantic"].includes(edge?.type)) continue;
      if (repositoryIds.has(edge.source) && repositoryIds.has(edge.target)) result.push(edge);
    }
    for (const edge of Array.isArray(graph?.semanticEdges) ? graph.semanticEdges : []) {
      if (repositoryIds.has(edge?.source) && repositoryIds.has(edge?.target)) result.push(edge);
    }
    return result;
  }

  function project(graph, focusRootValue, depthValue = 1, statusValues) {
    const projectByStatuses = dependencies.projectByStatuses;
    if (typeof projectByStatuses !== "function" || !graph || !Array.isArray(graph.nodes)) return null;

    const scoped = projectByStatuses(graph, statusValues);
    if (!scoped) return null;

    const focusRoot = String(focusRootValue || "").slice(0, 180);
    if (!focusRoot) return scoped;

    const repositories = scoped.nodes.filter((node) => node?.type === "repository");
    const allowed = new Set(repositories.map((node) => node.id));
    if (!allowed.has(focusRoot)) return null;

    const adjacency = new Map([...allowed].map((id) => [id, new Set()]));
    for (const edge of relationEdges(scoped)) {
      if (!allowed.has(edge.source) || !allowed.has(edge.target)) continue;
      adjacency.get(edge.source).add(edge.target);
      adjacency.get(edge.target).add(edge.source);
    }

    const depth = normalizeDepth(depthValue);
    const repositoryIds = new Set([focusRoot]);
    const queue = [{ id: focusRoot, depth: 0 }];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      if (current.depth >= depth) continue;
      for (const neighbor of adjacency.get(current.id) || []) {
        if (repositoryIds.has(neighbor)) continue;
        repositoryIds.add(neighbor);
        queue.push({ id: neighbor, depth: current.depth + 1 });
      }
    }

    const groupIds = new Set();
    for (const repository of repositories) {
      if (!repositoryIds.has(repository.id) || !repository.groupId) continue;
      const id = String(repository.groupId);
      groupIds.add(id.startsWith("group:") ? id : `group:${id}`);
    }
    for (const edge of Array.isArray(scoped.edges) ? scoped.edges : []) {
      if (edge?.type === "membership" && repositoryIds.has(edge.target)) groupIds.add(edge.source);
    }

    const nodeIds = new Set();
    const nodes = scoped.nodes.filter((node) => {
      const keep = node?.type === "owner"
        || (node?.type === "group" && groupIds.has(node.id))
        || (node?.type === "repository" && repositoryIds.has(node.id));
      if (keep) nodeIds.add(node.id);
      return keep;
    });
    const edges = (Array.isArray(scoped.edges) ? scoped.edges : [])
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
    const semanticEdges = (Array.isArray(scoped.semanticEdges) ? scoped.semanticEdges : [])
      .filter((edge) => repositoryIds.has(edge.source) && repositoryIds.has(edge.target));

    return {
      ...scoped,
      nodes,
      edges,
      semanticEdges,
      repositoryCount: repositoryIds.size,
      groupCount: groupIds.size,
      contributedRepositoryCount: nodes.filter(
        (node) => node?.type === "repository" && node.relation === "contributed",
      ).length,
    };
  }

  return Object.freeze({
    version: 1,
    maxDepth: MAX_DEPTH,
    normalizeDepth,
    relationEdges,
    project,
  });
}

export const ProjectMapLocalGraph = createProjectMapLocalGraphApi({
  projectByStatuses: ProjectMapViewModel.projectByStatuses,
});
