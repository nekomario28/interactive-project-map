import { CLASSIFICATION_VERSION, classifyRepository, normalizeSearch } from "./semantic.mjs";

export { classifyRepository, normalizeSearch } from "./semantic.mjs";

function isProfileRepository(username, repo) {
  return String(repo?.name || "").toLowerCase() === String(username || "").toLowerCase();
}

export function buildGraph(username, repos, includeForks, includeArchived) {
  const filtered = repos.filter((repo) => !isProfileRepository(username, repo) && (includeForks || !repo.fork) && (includeArchived || !repo.archived));
  const groups = new Map();
  for (const repo of filtered) {
    const classification = classifyRepository(repo);
    const existing = groups.get(classification.categoryId) ?? { label: classification.categoryLabel, repos: [] };
    existing.repos.push({ repo, classification });
    groups.set(classification.categoryId, existing);
  }
  const sortedGroups = [...groups.entries()].sort((a, b) => b[1].repos.length - a[1].repos.length || a[1].label.localeCompare(b[1].label));
  const nodes = [{ id: `user:${username}`, label: username, type: "owner", url: `https://github.com/${encodeURIComponent(username)}` }];
  const edges = [];
  for (const [groupId, group] of sortedGroups) {
    const groupNodeId = `group:${groupId}`;
    nodes.push({ id: groupNodeId, label: group.label, type: "group", repositoryCount: group.repos.length });
    edges.push({ source: `user:${username}`, target: groupNodeId, type: "ownership" });
    group.repos.sort((a, b) => b.repo.stargazers_count - a.repo.stargazers_count || b.repo.updated_at.localeCompare(a.repo.updated_at)).forEach(({ repo, classification }) => {
      const repoNodeId = `repository:${repo.name}`;
      nodes.push({
        id: repoNodeId, label: repo.name, type: "repository", url: repo.html_url,
        description: repo.description ?? "", language: repo.language, topics: repo.topics ?? [],
        stars: repo.stargazers_count, forks: repo.forks_count, fork: repo.fork, archived: repo.archived,
        createdAt: repo.created_at ?? repo.updated_at,
        updatedAt: repo.updated_at,
        groupId, groupLabel: group.label,
        classification,
      });
      edges.push({ source: groupNodeId, target: repoNodeId, type: "membership" });
    });
  }
  return {
    owner: username,
    generatedAt: new Date().toISOString(),
    repositoryCount: filtered.length,
    groupCount: sortedGroups.length,
    nodes,
    edges,
    classificationVersion: CLASSIFICATION_VERSION,
  };
}
