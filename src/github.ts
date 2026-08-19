import type { Env, GitHubRepo } from "./types";

const API = "https://api.github.com";
const MAX_PAGES = 5;
export const README_RAW_BYTE_LIMIT = 32 * 1024;
export const README_TEXT_CHAR_LIMIT = 12 * 1024;
export const README_FETCH_CONCURRENCY = 4;

export interface RepoFetchOptions {
  includeForks?: boolean;
  includeArchived?: boolean;
  enrichReadmes?: boolean;
}

export interface ReadmeEnrichmentOptions {
  fetchImpl?: typeof fetch;
  rawByteLimit?: number;
  textCharLimit?: number;
  concurrency?: number;
}

type ReadmeFetchOutcome = {
  excerpt?: string;
  stop: boolean;
};

function githubHeaders(token: string | undefined, accept: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: accept,
    "User-Agent": "github-project-galaxy-api",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function boundedOption(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || Number(value) <= 0) return fallback;
  return Math.max(1, Math.floor(Number(value)));
}

function truncateCodePoints(value: string, maxChars: number): string {
  let count = 0;
  let end = 0;
  for (const char of value) {
    if (count >= maxChars) break;
    end += char.length;
    count += 1;
  }
  return value.slice(0, end);
}

export function cleanReadmeExcerpt(raw: string, maxChars = README_TEXT_CHAR_LIMIT): string {
  const limit = boundedOption(maxChars, README_TEXT_CHAR_LIMIT);
  let text = String(raw || "").normalize("NFKC").replace(/\r\n?/g, "\n");

  text = text
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/!\[[^\]]*\]\([^\n)]*\)/g, " ")
    .replace(/!\[[^\]]*\]\[[^\]]*\]/g, " ")
    .replace(/^\s*\[[^\]]+\]:\s*https?:\/\/\S+.*$/gim, " ")
    .replace(/\[([^\]]+)\]\([^\n)]*\)/g, "$1")
    .replace(/<img\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi, " ")
    .replace(/^\s*(?:#{1,6}\s*|>+\s*|[-*+]\s+|\d+[.)]\s+)/gm, "")
    .replace(/[`*_~]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return truncateCodePoints(text, limit);
}

async function readBoundedUtf8(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  let truncated = false;

  try {
    while (bytes < maxBytes) {
      const { done, value } = await reader.read();
      if (done) {
        text += decoder.decode();
        return text;
      }
      const remaining = maxBytes - bytes;
      const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      bytes += chunk.byteLength;
      text += decoder.decode(chunk, { stream: true });
      if (chunk.byteLength < value.byteLength || bytes >= maxBytes) {
        truncated = true;
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
  } finally {
    if (!truncated) await reader.cancel().catch(() => undefined);
  }

  // When truncated, intentionally do not flush TextDecoder: an incomplete trailing
  // UTF-8 sequence is discarded rather than replaced with U+FFFD.
  return text;
}

async function fetchReadmeOutcome(
  username: string,
  repoName: string,
  token: string | undefined,
  options: Required<Pick<ReadmeEnrichmentOptions, "rawByteLimit" | "textCharLimit">> & { fetchImpl: typeof fetch },
): Promise<ReadmeFetchOutcome> {
  const url = `${API}/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}/readme`;
  try {
    const response = await options.fetchImpl(url, {
      headers: githubHeaders(token, "application/vnd.github.raw+json"),
    });
    if (response.status === 403 || response.status === 429) return { stop: true };
    if (!response.ok) return { stop: false };
    const raw = await readBoundedUtf8(response, options.rawByteLimit);
    const excerpt = cleanReadmeExcerpt(raw, options.textCharLimit);
    return excerpt ? { excerpt, stop: false } : { stop: false };
  } catch {
    // README enrichment is supporting evidence; it must never fail graph generation.
    return { stop: false };
  }
}

export async function enrichReposWithReadmes(
  username: string,
  repos: GitHubRepo[],
  env: Env,
  options: ReadmeEnrichmentOptions = {},
): Promise<GitHubRepo[]> {
  if (!repos.length) return [];
  const enriched = repos.map((repo) => ({ ...repo }));
  const fetchImpl = options.fetchImpl ?? fetch;
  const rawByteLimit = boundedOption(options.rawByteLimit, README_RAW_BYTE_LIMIT);
  const textCharLimit = boundedOption(options.textCharLimit, README_TEXT_CHAR_LIMIT);
  const concurrency = Math.min(
    enriched.length,
    boundedOption(options.concurrency, README_FETCH_CONCURRENCY),
  );
  let cursor = 0;
  let stop = false;

  async function worker(): Promise<void> {
    while (!stop) {
      const index = cursor;
      cursor += 1;
      if (index >= enriched.length) return;
      if (enriched[index].readmeExcerpt) continue;
      const outcome = await fetchReadmeOutcome(username, enriched[index].name, env.GITHUB_TOKEN, {
        fetchImpl,
        rawByteLimit,
        textCharLimit,
      });
      if (outcome.excerpt) enriched[index].readmeExcerpt = outcome.excerpt;
      if (outcome.stop) stop = true;
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return enriched;
}

export async function fetchPublicRepos(
  username: string,
  env: Env,
  maxRepos: number,
  options: RepoFetchOptions = {},
): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  const includeForks = options.includeForks ?? true;
  const includeArchived = options.includeArchived ?? true;
  const headers = githubHeaders(env.GITHUB_TOKEN, "application/vnd.github+json");

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
    for (const repo of batch) {
      if (!includeForks && repo.fork) continue;
      if (!includeArchived && repo.archived) continue;
      repos.push(repo);
      if (repos.length >= maxRepos) break;
    }
    if (batch.length < 100) break;
  }

  const selected = repos.slice(0, maxRepos);
  if (options.enrichReadmes === false) return selected;
  return enrichReposWithReadmes(username, selected, env);
}
