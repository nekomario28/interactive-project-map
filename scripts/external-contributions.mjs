const GRAPHQL_API = "https://api.github.com/graphql";
export const EXTERNAL_CONTRIBUTION_WINDOW_DAYS = 365;
export const EXTERNAL_CONTRIBUTION_MAX_REPOSITORIES = 100;
const CONTRIBUTIONS_PER_REPOSITORY = 100;

const QUERY = `
  query ProjectMapExternalContributions($login: String!, $from: DateTime!, $to: DateTime!, $maxRepositories: Int!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        commitContributionsByRepository(maxRepositories: $maxRepositories) {
          repository {
            nameWithOwner name isPrivate isFork isArchived url description
            owner { login }
            primaryLanguage { name }
            repositoryTopics(first: 20) { nodes { topic { name } } }
            stargazerCount forkCount createdAt updatedAt
          }
          contributions(first: ${CONTRIBUTIONS_PER_REPOSITORY}) {
            pageInfo { hasNextPage }
            nodes { commitCount isRestricted }
          }
        }
        pullRequestContributionsByRepository(maxRepositories: $maxRepositories) {
          repository {
            nameWithOwner name isPrivate isFork isArchived url description
            owner { login }
            primaryLanguage { name }
            repositoryTopics(first: 20) { nodes { topic { name } } }
            stargazerCount forkCount createdAt updatedAt
          }
          contributions(first: ${CONTRIBUTIONS_PER_REPOSITORY}) {
            pageInfo { hasNextPage }
            nodes { isRestricted pullRequest { mergedAt } }
          }
        }
      }
    }
  }
`;

function boundedMaxRepositories(value) {
  if (!Number.isFinite(value)) return EXTERNAL_CONTRIBUTION_MAX_REPOSITORIES;
  return Math.max(1, Math.min(EXTERNAL_CONTRIBUTION_MAX_REPOSITORIES, Math.floor(Number(value))));
}

export function externalContributionWindow(nowMs = Date.now()) {
  const toDate = new Date(nowMs);
  if (!Number.isFinite(toDate.getTime())) throw new Error("Invalid external contribution clock");
  const fromDate = new Date(toDate.getTime() - EXTERNAL_CONTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return { from: fromDate.toISOString(), to: toDate.toISOString() };
}

function safeRepository(raw, login) {
  if (!raw || typeof raw !== "object" || raw.isPrivate === true) return null;
  const owner = raw.owner?.login;
  const name = raw.name;
  const nameWithOwner = raw.nameWithOwner;
  if (typeof owner !== "string" || typeof name !== "string" || typeof nameWithOwner !== "string") return null;
  if (owner.toLowerCase() === login.toLowerCase()) return null;
  if (typeof raw.url !== "string" || !raw.url.startsWith("https://github.com/")) return null;
  const topics = Array.isArray(raw.repositoryTopics?.nodes)
    ? raw.repositoryTopics.nodes.map((node) => node?.topic?.name).filter((topic) => typeof topic === "string").slice(0, 20)
    : [];
  return {
    nameWithOwner,
    owner,
    name,
    url: raw.url,
    description: typeof raw.description === "string" ? raw.description : "",
    language: typeof raw.primaryLanguage?.name === "string" ? raw.primaryLanguage.name : null,
    topics,
    stars: Number.isFinite(raw.stargazerCount) ? Math.max(0, Math.floor(raw.stargazerCount)) : 0,
    forks: Number.isFinite(raw.forkCount) ? Math.max(0, Math.floor(raw.forkCount)) : 0,
    fork: raw.isFork === true,
    archived: raw.isArchived === true,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

function visibleNodes(connection) {
  return Array.isArray(connection?.nodes) ? connection.nodes.filter((node) => node && node.isRestricted !== true) : [];
}

function ensureRecord(byRepo, repository) {
  const key = repository.nameWithOwner.toLowerCase();
  let record = byRepo.get(key);
  if (!record) {
    record = {
      ...repository,
      commits: 0,
      pullRequests: 0,
      mergedPullRequests: 0,
      commitsTruncated: false,
      pullRequestsTruncated: false,
    };
    byRepo.set(key, record);
  }
  return record;
}

export async function fetchPublicExternalContributions(username, token, options = {}) {
  const login = String(username || "").trim();
  if (!login) throw new Error("GitHub username is required for external contributions");
  if (!token) throw new Error("GitHub token is required for external contributions");
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxRepositories = boundedMaxRepositories(options.maxRepositories);
  const window = externalContributionWindow(options.nowMs);
  const response = await fetchImpl(GRAPHQL_API, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "interactive-project-map-external-contributions",
    },
    body: JSON.stringify({ query: QUERY, variables: { login, from: window.from, to: window.to, maxRepositories } }),
  });
  let payload;
  try { payload = await response.json(); } catch { throw new Error("GitHub GraphQL returned an invalid external contribution response"); }
  if (response.status === 403 || response.status === 429) throw new Error("GitHub API rate limit reached while fetching external contributions");
  if (!response.ok || payload?.errors?.length) throw new Error(`GitHub GraphQL external contribution query failed (${response.status})`);
  const collection = payload?.data?.user?.contributionsCollection;
  if (!collection) throw new Error("GitHub user not found while fetching external contributions");

  const byRepo = new Map();
  for (const row of collection.commitContributionsByRepository ?? []) {
    const repository = safeRepository(row?.repository, login);
    if (!repository) continue;
    const record = ensureRecord(byRepo, repository);
    for (const node of visibleNodes(row?.contributions)) {
      if (Number.isFinite(node.commitCount) && node.commitCount > 0) record.commits += Math.floor(node.commitCount);
    }
    record.commitsTruncated ||= row?.contributions?.pageInfo?.hasNextPage === true;
  }
  for (const row of collection.pullRequestContributionsByRepository ?? []) {
    const repository = safeRepository(row?.repository, login);
    if (!repository) continue;
    const record = ensureRecord(byRepo, repository);
    const nodes = visibleNodes(row?.contributions).filter((node) => node.pullRequest);
    record.pullRequests += nodes.length;
    record.mergedPullRequests += nodes.filter((node) => typeof node.pullRequest.mergedAt === "string" && node.pullRequest.mergedAt).length;
    record.pullRequestsTruncated ||= row?.contributions?.pageInfo?.hasNextPage === true;
  }

  const repositories = [...byRepo.values()]
    .filter((repo) => repo.commits > 0 || repo.pullRequests > 0)
    .sort((a, b) => b.mergedPullRequests - a.mergedPullRequests || b.commits - a.commits || b.pullRequests - a.pullRequests || a.nameWithOwner.localeCompare(b.nameWithOwner));
  return {
    window,
    repositories,
    diagnostics: {
      maxRepositories,
      returnedRepositories: repositories.length,
      truncatedRepositories: repositories.filter((repo) => repo.commitsTruncated || repo.pullRequestsTruncated).length,
    },
  };
}
