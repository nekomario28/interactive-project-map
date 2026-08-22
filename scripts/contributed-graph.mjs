function nonNegativeInteger(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(Number(value))) : 0;
}

function validIso(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function contributedRepositoryId(nameWithOwner) {
  return `repository:${String(nameWithOwner).toLowerCase()}`;
}

export function attachContributedRepositories(graph, repositories, window, diagnostics = {}) {
  if (!graph || typeof graph !== "object" || typeof graph.owner !== "string") throw new Error("Contributed graph requires an owner");
  if (!window || !validIso(window.from) || !validIso(window.to) || Date.parse(window.from) > Date.parse(window.to)) throw new Error("Invalid Contributed contribution window");
  const ownerId = `user:${graph.owner}`;
  if (!(graph.nodes ?? []).some((node) => node?.id === ownerId && node.type === "owner")) throw new Error("Contributed graph owner node is missing");

  const existingIds = new Set((graph.nodes ?? []).map((node) => node?.id).filter(Boolean));
  const nodes = [...(graph.nodes ?? [])];
  const edges = [...(graph.edges ?? [])];
  let attached = 0;

  for (const repository of Array.isArray(repositories) ? repositories : []) {
    if (!repository || typeof repository.nameWithOwner !== "string" || typeof repository.owner !== "string" || typeof repository.name !== "string") continue;
    if (repository.owner.toLowerCase() === graph.owner.toLowerCase()) continue;
    const id = contributedRepositoryId(repository.nameWithOwner);
    if (existingIds.has(id)) continue;
    const expectedFullName = `${repository.owner}/${repository.name}`;
    if (repository.nameWithOwner.toLowerCase() !== expectedFullName.toLowerCase()) continue;
    if (typeof repository.url !== "string" || repository.url.toLowerCase() !== `https://github.com/${expectedFullName}`.toLowerCase()) continue;

    const contribution = {
      commits: nonNegativeInteger(repository.commits),
      pullRequests: nonNegativeInteger(repository.pullRequests),
      mergedPullRequests: nonNegativeInteger(repository.mergedPullRequests),
      commitsTruncated: repository.commitsTruncated === true,
      pullRequestsTruncated: repository.pullRequestsTruncated === true,
    };
    if (contribution.commits === 0 && contribution.pullRequests === 0) continue;
    contribution.mergedPullRequests = Math.min(contribution.pullRequests, contribution.mergedPullRequests);

    nodes.push({
      id,
      label: repository.nameWithOwner,
      type: "repository",
      relation: "contributed",
      repositoryOwner: repository.owner,
      repositoryName: repository.name,
      url: repository.url,
      description: typeof repository.description === "string" ? repository.description : "",
      language: typeof repository.language === "string" ? repository.language : null,
      topics: Array.isArray(repository.topics) ? repository.topics.filter((topic) => typeof topic === "string").slice(0, 20) : [],
      stars: nonNegativeInteger(repository.stars),
      forks: nonNegativeInteger(repository.forks),
      fork: repository.fork === true,
      archived: repository.archived === true,
      createdAt: validIso(repository.createdAt) ? repository.createdAt : undefined,
      updatedAt: validIso(repository.updatedAt) ? repository.updatedAt : undefined,
      contribution,
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
