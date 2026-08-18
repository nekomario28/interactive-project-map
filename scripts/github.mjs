const API = "https://api.github.com";
const MAX_PAGES = 5;

export async function fetchPublicRepos(username, token, maxRepos, options = {}) {
  const repos = [];
  const includeForks = options.includeForks ?? true;
  const includeArchived = options.includeArchived ?? true;
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "interactive-project-map-pages",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  for (let page = 1; page <= MAX_PAGES && repos.length < maxRepos; page += 1) {
    const url = `${API}/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated&direction=desc&per_page=100&page=${page}`;
    const response = await fetch(url, { headers });
    if (response.status === 404) throw new Error(`GitHub user not found: ${username}`);
    if (response.status === 403 || response.status === 429) {
      throw new Error("GitHub API rate limit reached. Configure PROJECT_MAP_GITHUB_TOKEN if needed.");
    }
    if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
    const batch = await response.json();
    for (const repo of batch) {
      if (!includeForks && repo.fork) continue;
      if (!includeArchived && repo.archived) continue;
      repos.push(repo);
      if (repos.length >= maxRepos) break;
    }
    if (batch.length < 100) break;
  }

  return repos.slice(0, maxRepos);
}
