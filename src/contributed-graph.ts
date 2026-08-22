import type { ExternalContributionDiagnostics, ExternalContributionWindow, GalaxyGraph, RepositoryClassification } from "./types.ts";

export interface ContributedRepositoryRecord {
  nameWithOwner: string;
  owner: string;
  name: string;
  url: string;
  description?: string;
  language?: string | null;
  topics?: string[];
  stars?: number;
  forks?: number;
  fork?: boolean;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
  commits: number;
  pullRequests: number;
  mergedPullRequests: number;
  commitsTruncated?: boolean;
  pullRequestsTruncated?: boolean;
  classification?: RepositoryClassification;
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function validIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function attachContributedRepositories(
  graph: GalaxyGraph,
  repositories: ContributedRepositoryRecord[],
  window: ExternalContributionWindow,
  diagnostics: Partial<Omit<ExternalContributionDiagnostics, "window" | "includedRepositories">> = {},
): GalaxyGraph {
  if (!validIso(window.from) || !validIso(window.to) || Date.parse(window.from) > Date.parse(window.to)) throw new Error("Invalid Contributed contribution window");
  const ownerId = `user:${graph.owner}`;
  if (!graph.nodes.some((node) => node.id === ownerId && node.type === "owner")) throw new Error("Contributed graph owner node is missing");
  const nodes = [...graph.nodes];
  const edges = [...graph.edges];
  const existingIds = new Set(nodes.map((node) => node.id));
  let attached = 0;

  for (const repository of repositories) {
    if (!repository || repository.owner.toLowerCase() === graph.owner.toLowerCase()) continue;
    const expectedFullName = `${repository.owner}/${repository.name}`;
    if (repository.nameWithOwner.toLowerCase() !== expectedFullName.toLowerCase()) continue;
    if (repository.url.toLowerCase() !== `https://github.com/${expectedFullName}`.toLowerCase()) continue;
    const id = `repository:${repository.nameWithOwner.toLowerCase()}`;
    if (existingIds.has(id)) continue;
    const commits = nonNegativeInteger(repository.commits);
    const pullRequests = nonNegativeInteger(repository.pullRequests);
    const mergedPullRequests = Math.min(pullRequests, nonNegativeInteger(repository.mergedPullRequests));
    if (commits === 0 && pullRequests === 0) continue;

    nodes.push({
      id,
      label: repository.nameWithOwner,
      type: "repository",
      relation: "contributed",
      repositoryOwner: repository.owner,
      repositoryName: repository.name,
      url: repository.url,
      description: repository.description ?? "",
      language: repository.language ?? null,
      topics: (repository.topics ?? []).slice(0, 20),
      stars: nonNegativeInteger(repository.stars),
      forks: nonNegativeInteger(repository.forks),
      fork: repository.fork === true,
      archived: repository.archived === true,
      ...(validIso(repository.createdAt) ? { createdAt: repository.createdAt } : {}),
      ...(validIso(repository.updatedAt) ? { updatedAt: repository.updatedAt } : {}),
      contribution: {
        commits,
        pullRequests,
        mergedPullRequests,
        commitsTruncated: repository.commitsTruncated === true,
        pullRequestsTruncated: repository.pullRequestsTruncated === true,
      },
      ...(repository.classification ? { classification: repository.classification } : {}),
    });
    edges.push({ source: ownerId, target: id, type: "contribution" });
    existingIds.add(id);
    attached += 1;
  }

  return {
    ...graph,
    nodes,
    edges,
    contributedRepositoryCount: attached,
    externalContributions: {
      window: { from: window.from, to: window.to },
      cap: nonNegativeInteger(diagnostics.cap),
      candidateRepositories: nonNegativeInteger(diagnostics.candidateRepositories),
      includedRepositories: attached,
      omittedRepositories: nonNegativeInteger(diagnostics.omittedRepositories),
      truncatedRepositories: nonNegativeInteger(diagnostics.truncatedRepositories),
    },
  };
}
