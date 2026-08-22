export const CONTRIBUTED_MAX_REPOSITORIES = 12;
export const CONTRIBUTED_MIN_CAP = 4;

function nonNegativeInteger(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(Number(value))) : 0;
}

export function contributedRepositoryCap(ownedRepositoryCount) {
  const owned = nonNegativeInteger(ownedRepositoryCount);
  return Math.min(CONTRIBUTED_MAX_REPOSITORIES, Math.max(CONTRIBUTED_MIN_CAP, Math.ceil(owned / 2)));
}

export function compareContributedRepositories(left, right) {
  const merged = nonNegativeInteger(right?.mergedPullRequests) - nonNegativeInteger(left?.mergedPullRequests);
  if (merged) return merged;
  const commits = nonNegativeInteger(right?.commits) - nonNegativeInteger(left?.commits);
  if (commits) return commits;
  const pullRequests = nonNegativeInteger(right?.pullRequests) - nonNegativeInteger(left?.pullRequests);
  if (pullRequests) return pullRequests;
  return String(left?.nameWithOwner || "").localeCompare(String(right?.nameWithOwner || ""));
}

export function selectContributedRepositories(repositories, ownedRepositoryCount, options = {}) {
  const byRepository = new Map();
  for (const repository of Array.isArray(repositories) ? repositories : []) {
    if (!repository || typeof repository.nameWithOwner !== "string" || !repository.nameWithOwner.includes("/")) continue;
    const commits = nonNegativeInteger(repository.commits);
    const pullRequests = nonNegativeInteger(repository.pullRequests);
    const mergedPullRequests = nonNegativeInteger(repository.mergedPullRequests);
    if (commits === 0 && pullRequests === 0) continue;
    const normalized = { ...repository, commits, pullRequests, mergedPullRequests };
    const key = repository.nameWithOwner.toLowerCase();
    const existing = byRepository.get(key);
    if (!existing || compareContributedRepositories(normalized, existing) < 0) byRepository.set(key, normalized);
  }

  const defaultCap = contributedRepositoryCap(ownedRepositoryCount);
  const requestedCap = options.cap == null ? defaultCap : nonNegativeInteger(options.cap);
  const cap = Math.min(CONTRIBUTED_MAX_REPOSITORIES, requestedCap);
  const ranked = [...byRepository.values()].sort(compareContributedRepositories);
  const selected = ranked.slice(0, cap);
  return {
    repositories: selected,
    diagnostics: {
      ownedRepositoryCount: nonNegativeInteger(ownedRepositoryCount),
      candidateRepositories: ranked.length,
      selectedRepositories: selected.length,
      omittedRepositories: Math.max(0, ranked.length - selected.length),
      cap,
      policy: "merged-prs>commits>prs>name; no activity threshold",
    },
  };
}
