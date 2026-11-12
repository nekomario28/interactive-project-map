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
  const fetched = options.prepared?.fetched ?? await fetchContributions(username, token, options.fetchOptions ?? {});
  const selected = options.prepared?.selected ?? selectContributedRepositories(fetched.repositories, graph.repositoryCount, options.rankingOptions ?? {});
  const repositories = selected.repositories.map((repository) => ({
    ...repository,
    classification: classifyRepository(classificationInput(repository)),
  }));
  const output = attachContributedRepositories(graph, repositories, fetched.window, {
    ...selected.diagnostics,
    truncatedRepositories: fetched.diagnostics?.truncatedRepositories ?? 0,
  });
  for (const node of output.nodes) {
    if (node.relation !== "contributed") continue;
    const forkUrl = options.linkedForks?.get(String(node.label).toLowerCase());
    if (forkUrl) node.forkUrl = forkUrl;
  }
  return { graph: output, fetched, selected };
}

const GITHUB_API = "https://api.github.com";
const REPO_SEGMENT = /^[A-Za-z0-9._-]{1,100}$/;
const USER_SEGMENT = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

// Only a verified upstream identity may collapse a user's fork into Contributed.
// Name equality is merely a bounded lookup hint and is never sufficient.
export async function collapseVerifiedContributionForks(repositories, selected, username, token, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const upstreamByName = new Map();
  for (const contribution of selected ?? []) {
    if (!USER_SEGMENT.test(contribution.owner ?? "") || !REPO_SEGMENT.test(contribution.name ?? "")) continue;
    const key = contribution.name.toLowerCase();
    if (!upstreamByName.has(key)) upstreamByName.set(key, new Set());
    upstreamByName.get(key).add(contribution.nameWithOwner.toLowerCase());
  }
  const suppressed = new Set();
  const linkedForks = new Map();
  for (const repository of repositories ?? []) {
    if (!repository?.fork || !REPO_SEGMENT.test(repository.name ?? "")) continue;
    const candidates = upstreamByName.get(repository.name.toLowerCase());
    if (!candidates?.size) continue;
    let source = repository.source?.full_name;
    let parent = repository.parent?.full_name;
    if (!source && !parent) {
      try {
        const response = await fetchImpl(`${GITHUB_API}/repos/${encodeURIComponent(username)}/${encodeURIComponent(repository.name)}`, {
          headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
            ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (!response.ok) continue;
        const data = await response.json();
        if (data.fork !== true) continue;
        source = data.source?.full_name;
        parent = data.parent?.full_name;
      } catch { continue; }
    }
    const matched = [source, parent].find((name) => typeof name === "string" && candidates.has(name.toLowerCase()));
    if (!matched) continue;
    suppressed.add(repository.name.toLowerCase());
    linkedForks.set(matched.toLowerCase(), `https://github.com/${encodeURIComponent(username)}/${encodeURIComponent(repository.name)}`);
  }
  return {
    repositories: (repositories ?? []).filter((repo) => !suppressed.has(String(repo.name).toLowerCase())),
    linkedForks,
    suppressedForkCount: suppressed.size,
  };
}
