import type { Env, GitHubRepo } from "./types";

const API = "https://api.github.com";
const MAX_PAGES = 5;

export async function fetchPublicRepos(
  username: string,
  env: Env,
  maxRepos: number,
): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "github-project-galaxy-api",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }

  for (let page = 1; page <= MAX_PAGES && repos.length < maxRepos; page += 1) {
    const url = `${API}/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated&direction=desc&per_page=100&page=${page}`;
    const response = await fetch(url, { headers });

    if (response.status === 404) {
      throw new Error("GitHub user not found");
    }
    if (response.status === 403 || response.status === 429) {
      throw new Error("GitHub API rate limit reached. Configure GITHUB_TOKEN for production.");
    }
    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }

    const batch = (await response.json()) as GitHubRepo[];
    repos.push(...batch);
    if (batch.length < 100) break;
  }

  return repos.slice(0, maxRepos);
}
