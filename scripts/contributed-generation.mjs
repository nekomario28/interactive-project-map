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

// Only a GitHub-verified parent/source identity may collapse a personal Fork.
// Matching names merely prioritize lookups; renamed Forks must also be considered.
// The maximum number of supplemental API requests is fixed to protect Actions quotas.
const MAX_FORK_LINEAGE_LOOKUPS = 24;

function verifiedRepositoryIdentity(value) {
  if (typeof value !== "string") return null;
  const parts = value.split("/");
  if (parts.length !== 2 || !USER_SEGMENT.test(parts[0]) || !REPO_SEGMENT.test(parts[1])) return null;
  return value.toLowerCase();
}

export async function collapseVerifiedContributionForks(repositories, selected, username, token, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const upstreams = new Set();
  const upstreamNames = new Set();
  for (const contribution of selected ?? []) {
    if (!USER_SEGMENT.test(contribution.owner ?? "") || !REPO_SEGMENT.test(contribution.name ?? "")) continue;
    const identity = verifiedRepositoryIdentity(contribution.nameWithOwner);
    if (identity !== `${contribution.owner}/${contribution.name}`.toLowerCase()) continue;
    upstreams.add(identity);
    upstreamNames.add(contribution.name.toLowerCase());
  }
  const suppressed = new Set();
  const linkedForks = new Map();
  if (!USER_SEGMENT.test(username ?? "") || !upstreams.size) {
    return { repositories: repositories ?? [], linkedForks, suppressedForkCount: 0, lineageLookups: 0 };
  }

  const maxLookups = Number.isInteger(options.maxLookups)
    ? Math.max(0, Math.min(MAX_FORK_LINEAGE_LOOKUPS, options.maxLookups))
    : MAX_FORK_LINEAGE_LOOKUPS;
  const lineageCache = options.lineageCache ?? new Map();
  const forks = (repositories ?? [])
    .filter((repository) => repository?.fork === true && REPO_SEGMENT.test(repository.name ?? ""))
    .sort((a, b) => Number(upstreamNames.has(b.name.toLowerCase())) - Number(upstreamNames.has(a.name.toLowerCase()))
      || a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  let lineageLookups = 0;

  for (const repository of forks) {
    let lineage = { source: repository.source?.full_name, parent: repository.parent?.full_name };
    if (!lineage.source && !lineage.parent) {
      const cacheKey = `${username}/${repository.name}`.toLowerCase();
      if (lineageCache.has(cacheKey)) {
        lineage = lineageCache.get(cacheKey);
      } else {
        if (lineageLookups >= maxLookups) continue; // Preserve the unverified Fork.
        lineageLookups += 1;
        try {
          const response = await fetchImpl(`${GITHUB_API}/repos/${encodeURIComponent(username)}/${encodeURIComponent(repository.name)}`, {
            headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
              ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          });
          if (!response.ok) continue;
          const data = await response.json();
          if (data?.fork !== true) continue;
          // Reject a response for a different repository if full_name is supplied.
          if (data.full_name && verifiedRepositoryIdentity(data.full_name) !== cacheKey) continue;
          lineage = { source: data.source?.full_name, parent: data.parent?.full_name };
          lineageCache.set(cacheKey, lineage);
        } catch { continue; }
      }
    }
    const matched = [lineage.source, lineage.parent]
      .map(verifiedRepositoryIdentity)
      .find((identity) => identity && upstreams.has(identity));
    if (!matched) continue;
    suppressed.add(repository.name.toLowerCase());
    if (!linkedForks.has(matched)) {
      linkedForks.set(matched, `https://github.com/${encodeURIComponent(username)}/${encodeURIComponent(repository.name)}`);
    }
  }
  return {
    repositories: (repositories ?? []).filter((repo) => !suppressed.has(String(repo.name).toLowerCase())),
    linkedForks,
    suppressedForkCount: suppressed.size,
    lineageLookups,
  };
}
