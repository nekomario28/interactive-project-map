const API = "https://api.github.com";
const MAX_PAGES = 5;
export const README_RAW_BYTE_LIMIT = 32 * 1024;
export const README_TEXT_CHAR_LIMIT = 12 * 1024;
export const README_FETCH_CONCURRENCY = 4;

function githubHeaders(token, accept) {
  const headers = {
    Accept: accept,
    "User-Agent": "interactive-project-map-pages",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function boundedOption(value, fallback) {
  if (!Number.isFinite(value) || Number(value) <= 0) return fallback;
  return Math.max(1, Math.floor(Number(value)));
}

function truncateCodePoints(value, maxChars) {
  let count = 0;
  let end = 0;
  for (const char of value) {
    if (count >= maxChars) break;
    end += char.length;
    count += 1;
  }
  return value.slice(0, end);
}

export function cleanReadmeExcerpt(raw, maxChars = README_TEXT_CHAR_LIMIT) {
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

async function readBoundedUtf8(response, maxBytes) {
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

  return text;
}

async function fetchReadmeOutcome(username, repoName, token, options) {
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
    return { stop: false };
  }
}

export async function enrichReposWithReadmes(username, repos, token, options = {}) {
  if (!repos.length) return [];
  const enriched = repos.map((repo) => ({ ...repo }));
  const fetchImpl = options.fetchImpl ?? fetch;
  const rawByteLimit = boundedOption(options.rawByteLimit, README_RAW_BYTE_LIMIT);
  const textCharLimit = boundedOption(options.textCharLimit, README_TEXT_CHAR_LIMIT);
  const concurrency = Math.min(enriched.length, boundedOption(options.concurrency, README_FETCH_CONCURRENCY));
  let cursor = 0;
  let stop = false;

  async function worker() {
    while (!stop) {
      const index = cursor;
      cursor += 1;
      if (index >= enriched.length) return;
      if (enriched[index].readmeExcerpt) continue;
      const outcome = await fetchReadmeOutcome(username, enriched[index].name, token, {
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

export async function fetchPublicRepos(username, token, maxRepos, options = {}) {
  const repos = [];
  const includeForks = options.includeForks ?? true;
  const includeArchived = options.includeArchived ?? true;
  const headers = githubHeaders(token, "application/vnd.github+json");

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

  const selected = repos.slice(0, maxRepos);
  if (options.enrichReadmes === false) return selected;
  return enrichReposWithReadmes(username, selected, token);
}
