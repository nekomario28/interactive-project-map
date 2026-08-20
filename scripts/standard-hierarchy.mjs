import { STANDARD_TAXONOMY_ID } from "./standard-taxonomy.mjs";

export const STANDARD_UNCATEGORIZED_GROUP = Object.freeze({ id: "uncategorized", label: "Uncategorized" });

export function usesStandardTaxonomy(graph) {
  return graph?.taxonomy?.source?.providerId === "standard" && graph?.taxonomy?.source?.model === STANDARD_TAXONOMY_ID;
}

function repoSort(a, b) {
  return (Number(b.stars) || 0) - (Number(a.stars) || 0)
    || String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
    || String(a.label || "").localeCompare(String(b.label || ""));
}

export function promoteStandardHierarchy(graph) {
  if (!usesStandardTaxonomy(graph)) return graph;
  const owner = graph.nodes?.find((node) => node?.type === "owner");
  if (!owner) return graph;

  const categories = new Map((graph.taxonomy?.categories ?? []).map((category) => [category.id, category]));
  const groups = new Map();
  for (const node of graph.nodes ?? []) {
    if (node?.type !== "repository") continue;
    const assigned = node.taxonomyAssignment && categories.get(node.taxonomyAssignment.categoryId);
    const groupId = assigned?.id ?? STANDARD_UNCATEGORIZED_GROUP.id;
    const groupLabel = assigned?.label ?? STANDARD_UNCATEGORIZED_GROUP.label;
    const existing = groups.get(groupId) ?? { label: groupLabel, repos: [] };
    existing.repos.push({ ...node, groupId, groupLabel });
    groups.set(groupId, existing);
  }

  const sorted = [...groups.entries()].sort((a, b) => b[1].repos.length - a[1].repos.length || a[1].label.localeCompare(b[1].label) || a[0].localeCompare(b[0]));
  const nodes = [{ ...owner }];
  const edges = [];
  for (const [groupId, group] of sorted) {
    const groupNodeId = `group:${groupId}`;
    nodes.push({ id: groupNodeId, label: group.label, type: "group", repositoryCount: group.repos.length });
    edges.push({ source: owner.id, target: groupNodeId, type: "ownership" });
    for (const repo of [...group.repos].sort(repoSort)) {
      nodes.push(repo);
      edges.push({ source: groupNodeId, target: repo.id, type: "membership" });
    }
  }

  return { ...graph, groupCount: sorted.length, nodes, edges };
}
