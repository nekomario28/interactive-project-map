import { CLASSIFICATION_VERSION, classifyRepository } from "./semantic";
import type { GalaxyEdge, GalaxyGraph, GalaxyNode, GitHubRepo, RepositoryClassification } from "./types";

export { classifyRepository, normalizeSearch } from "./semantic";

function isProfileRepository(username: string, repo: GitHubRepo): boolean {
  return repo.name.toLowerCase() === username.toLowerCase();
}

type ClassifiedRepo = {
  repo: GitHubRepo;
  classification: RepositoryClassification;
};

export function buildGraph(
  username: string,
  repos: GitHubRepo[],
  includeForks: boolean,
  includeArchived: boolean,
): GalaxyGraph {
  const filtered = repos.filter((repo) => {
    if (isProfileRepository(username, repo)) return false;
    if (!includeForks && repo.fork) return false;
    if (!includeArchived && repo.archived) return false;
    return true;
  });

  const groups = new Map<string, { label: string; repos: ClassifiedRepo[] }>();
  for (const repo of filtered) {
    const classification = classifyRepository(repo);
    const existing = groups.get(classification.categoryId) ?? { label: classification.categoryLabel, repos: [] };
    existing.repos.push({ repo, classification });
    groups.set(classification.categoryId, existing);
  }

  const sortedGroups = [...groups.entries()].sort((a, b) => {
    const countDiff = b[1].repos.length - a[1].repos.length;
    return countDiff || a[1].label.localeCompare(b[1].label);
  });

  const nodes: GalaxyNode[] = [
    {
      id: `user:${username}`,
      label: username,
      type: "owner",
      url: `https://github.com/${encodeURIComponent(username)}`,
    },
  ];
  const edges: GalaxyEdge[] = [];

  for (const [groupId, group] of sortedGroups) {
    const groupNodeId = `group:${groupId}`;
    nodes.push({
      id: groupNodeId,
      label: group.label,
      type: "group",
      repositoryCount: group.repos.length,
    });
    edges.push({ source: `user:${username}`, target: groupNodeId, type: "ownership" });

    group.repos
      .sort((a, b) => b.repo.stargazers_count - a.repo.stargazers_count || b.repo.updated_at.localeCompare(a.repo.updated_at))
      .forEach(({ repo, classification }) => {
        const repoNodeId = `repository:${repo.name}`;
        nodes.push({
          id: repoNodeId,
          label: repo.name,
          type: "repository",
          url: repo.html_url,
          description: repo.description ?? "",
          language: repo.language,
          topics: repo.topics ?? [],
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          fork: repo.fork,
          archived: repo.archived,
          updatedAt: repo.updated_at,
          groupId,
          groupLabel: group.label,
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
