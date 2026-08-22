import { selectContributedRepositories } from "./contributed-ranking.mjs";
import { attachContributedRepositories } from "./contributed-graph.mjs";
import { fetchPublicExternalContributions } from "./external-contributions.mjs";
import { classifyRepository } from "./semantic.mjs";

function classificationInput(repository) {
  return {
    id: 0,
    name: repository.name,
    html_url: repository.url,
    description: repository.description || null,
    language: repository.language ?? null,
    topics: repository.topics ?? [],
    stargazers_count: repository.stars ?? 0,
    forks_count: repository.forks ?? 0,
    fork: repository.fork === true,
    archived: repository.archived === true,
    created_at: repository.createdAt || repository.updatedAt || "",
    updated_at: repository.updatedAt || repository.createdAt || "",
  };
}

export async function attachSelectedContributions(graph, username, token, options = {}) {
  if (!graph || typeof graph.repositoryCount !== "number") throw new Error("Contributed generation requires the built owned graph");
  const fetchContributions = options.fetchContributions ?? fetchPublicExternalContributions;
  const fetched = await fetchContributions(username, token, options.fetchOptions ?? {});
  const selected = selectContributedRepositories(fetched.repositories, graph.repositoryCount, options.rankingOptions ?? {});
  const repositories = selected.repositories.map((repository) => ({
    ...repository,
    classification: classifyRepository(classificationInput(repository)),
  }));
  const output = attachContributedRepositories(graph, repositories, fetched.window, {
    ...selected.diagnostics,
    truncatedRepositories: fetched.diagnostics?.truncatedRepositories ?? 0,
  });
  return { graph: output, fetched, selected };
}
