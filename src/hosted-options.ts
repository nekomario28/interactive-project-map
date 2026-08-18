const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

export interface GraphRequestOptions {
  username: string;
  maxRepos: number;
  includeForks: boolean;
  includeArchived: boolean;
}

export function normalizeUsername(value: string): string {
  const username = value.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) throw new Error("Invalid GitHub username");
  return username;
}

export function graphCacheRequest(origin: string, options: GraphRequestOptions): Request {
  const url = new URL("/__cache/graph", origin);
  url.searchParams.set("username", normalizeUsername(options.username));
  url.searchParams.set("max_repos", String(options.maxRepos));
  url.searchParams.set("forks", String(options.includeForks));
  url.searchParams.set("archived", String(options.includeArchived));
  return new Request(url.toString(), { method: "GET" });
}
