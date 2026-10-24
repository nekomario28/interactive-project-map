import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify, parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const run = promisify(execFile);
const USERNAME_RE = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;
const SHA_RE = /^[a-f\d]{40}$/;
const START = "<!-- public-users:start -->";
const END = "<!-- public-users:end -->";
const SEARCH_QUERIES = [
  '"nekomario28.github.io/interactive-project-map" filename:README.md',
  '"nekomario28/interactive-project-map" path:.github/workflows',
];

const RETRY_STATUS_RE = /\(HTTP (429|50[0234])\)/;
const MAX_CENSUS_DELAY_MS = 120_000;
const CODE_SEARCH_GAP_MS = 7_000;
const CENSUS_JITTER_MS = 1_000;

function clampUnit(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number));
}

function headerDelayMs(retryAfter, rateLimitReset, now) {
  if (retryAfter != null && String(retryAfter).trim() !== "") {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const date = Date.parse(String(retryAfter));
    if (Number.isFinite(date)) return Math.max(0, date - now);
  }
  if (rateLimitReset != null && String(rateLimitReset).trim() !== "") {
    const epochSeconds = Number(rateLimitReset);
    if (Number.isFinite(epochSeconds)) return Math.max(0, epochSeconds * 1000 - now);
  }
  return null;
}

export function censusRetryDelay(attempt, {
  retryAfter,
  rateLimitReset,
  now = Date.now(),
  random = () => 0,
  maxDelayMs = MAX_CENSUS_DELAY_MS,
} = {}) {
  const hinted = headerDelayMs(retryAfter, rateLimitReset, now);
  const base = hinted == null ? Math.min(2 ** attempt * 1_000, maxDelayMs) : hinted;
  const jitter = Math.floor(clampUnit(random()) * CENSUS_JITTER_MS);
  return Math.min(Math.max(0, base) + jitter, maxDelayMs);
}

export function codeSearchGapMs(random = Math.random) {
  return CODE_SEARCH_GAP_MS + Math.floor(clampUnit(random()) * CENSUS_JITTER_MS);
}

export function formatCensusHttpError(endpoint, status) {
  if (String(status) === "429") {
    return `GitHub request stayed rate-limited (HTTP 429) for ${endpoint} after bounded retries. The public-user count was not updated.`;
  }
  return `GitHub request failed${status ? ` (HTTP ${status})` : ""} for ${endpoint}. Check gh authentication, rate limits and connectivity.`;
}

export async function retryCensusRequest(request, {
  // Seven attempts. Without a server hint the waits are 1+2+4+8+16+32=63s, past the measured code_search window.
  // A Retry-After or x-ratelimit-reset hint replaces that step and is still capped at 120s.
  attempts = 7,
  maxDelayMs = MAX_CENSUS_DELAY_MS,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  random = Math.random,
} = {}) {
  for (let attempt = 0; ; attempt += 1) {
    let error;
    try {
      return await request();
    } catch (failure) {
      error = failure;
    }
    const stderr = String(error?.stderr ?? "");
    const transient = RETRY_STATUS_RE.test(stderr) || /timed out|ECONNRESET|ETIMEDOUT|socket hang up/i.test(String(error?.message ?? ""));
    if (!transient || attempt + 1 >= attempts) throw error;
    const status = Number(error?.status) || Number(/\((?:HTTP )?(\d{3})\)/.exec(stderr)?.[1]);
    const headers = error?.headers;
    await sleep(censusRetryDelay(attempt, {
      retryAfter: headers?.get?.("retry-after"),
      rateLimitReset: status === 429 ? headers?.get?.("x-ratelimit-reset") : undefined,
      now: now(),
      random,
      maxDelayMs,
    }));
  }
}

function splitIncludedHttp(stdout) {
  const text = Buffer.isBuffer(stdout) ? stdout.toString("utf8") : String(stdout ?? "");
  if (!text.startsWith("HTTP/")) return { status: null, headers: new Map(), body: text };
  const separator = text.includes("\r\n\r\n") ? "\r\n\r\n" : "\n\n";
  const splitAt = text.indexOf(separator);
  if (splitAt < 0) return { status: null, headers: new Map(), body: text };
  const lines = text.slice(0, splitAt).split(/\r?\n/);
  const status = Number(/^HTTP\/\d+(?:\.\d+)?\s+(\d{3})/.exec(lines[0] || "")?.[1]);
  const headers = new Map();
  for (const line of lines.slice(1)) {
    const index = line.indexOf(":");
    if (index > 0) headers.set(line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim());
  }
  return { status: Number.isFinite(status) ? status : null, headers, body: text.slice(splitAt + separator.length) };
}

let nextCodeSearchAt = 0;

async function githubApi(endpoint, accept = "application/vnd.github+json") {
  if (endpoint.startsWith("search/code?")) {
    const wait = Math.max(0, nextCodeSearchAt - Date.now());
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    nextCodeSearchAt = Date.now() + codeSearchGapMs();
  }
  let stdout;
  try {
    ({ stdout } = await retryCensusRequest(() => run("gh", ["api", "--hostname", "github.com", "-i", "-H", `Accept: ${accept}`, endpoint], {
      timeout: 30_000, maxBuffer: 2 * 1024 * 1024,
    }).catch((error) => {
      const parsed = splitIncludedHttp(error.stdout);
      error.headers = parsed.headers;
      if (parsed.status) error.status = parsed.status;
      throw error;
    })));
  } catch (error) {
    if (/\(HTTP 404\)/.test(String(error.stderr || ""))) return null;
    const status = error.status || /\(HTTP (\d{3})\)/.exec(String(error.stderr || ""))?.[1];
    throw new Error(formatCensusHttpError(endpoint, status), { cause: error });
  }
  const message = splitIncludedHttp(stdout);
  if (message.status && message.status >= 400) throw new Error(formatCensusHttpError(endpoint, message.status));
  return accept === "application/vnd.github.html+json" ? message.body : JSON.parse(message.body);
}

function decodeFile(file) {
  if (!file || file.type !== "file" || file.encoding !== "base64" || typeof file.content !== "string" || file.size > 1024 * 1024) return null;
  const bytes = Buffer.from(file.content, "base64");
  if (bytes.length !== file.size) return null;
  return bytes.toString("utf8");
}

function profileLogin(repo) {
  const login = repo?.owner?.login;
  return USERNAME_RE.test(login || "") && repo.owner.type === "User" && repo.private === false
    && repo.name?.toLowerCase() === login.toLowerCase() ? login : null;
}

function attributeValues(html, tagName, attributeName) {
  const values = [];
  for (const [tag] of html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi"))) {
    for (const [, name, doubleQuoted, singleQuoted] of tag.matchAll(/([a-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
      if (name.toLowerCase() === attributeName) { values.push(doubleQuoted ?? singleQuoted); break; }
    }
  }
  return values;
}

function profileImageRefs(html, login) {
  const linked = attributeValues(html, "a", "href").some((source) => {
    try {
      const url = new URL(source.replaceAll("&amp;", "&"));
      return url.origin === "https://nekomario28.github.io" && url.pathname.startsWith("/interactive-project-map/")
        && url.searchParams.get("username")?.toLowerCase() === login.toLowerCase();
    } catch { return false; }
  });
  if (!linked) return [];
  const refs = [];
  for (const source of attributeValues(html, "img", "src")) {
    if (/^(?:\.\/)?project-map\/galaxy\.svg(?:[?#].*)?$/.test(source)) { refs.push("HEAD"); continue; }
    try {
      const url = new URL(source);
      if (url.origin !== "https://raw.githubusercontent.com" || url.username || url.password) continue;
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length >= 5 && parts[0].toLowerCase() === login.toLowerCase() && parts[1].toLowerCase() === login.toLowerCase()
        && parts.slice(-2).join("/") === "project-map/galaxy.svg") refs.push(decodeURIComponent(parts.slice(2, -2).join("/")));
    } catch { continue; }
  }
  return [...new Set(refs)];
}

async function discoverProfiles(api) {
  const candidates = [];
  for (const query of SEARCH_QUERIES) {
    for (let page = 1; page <= 10; page += 1) {
      const result = await api(`search/code?q=${encodeURIComponent(query)}&per_page=100&page=${page}`);
      if (!result || result.incomplete_results !== false || !Number.isInteger(result.total_count) || result.total_count > 1000 || !Array.isArray(result.items)) {
        throw new Error("Public-user search was incomplete; the previous README count is preserved.");
      }
      for (const item of result.items) {
        const login = profileLogin(item.repository);
        if (login) candidates.push(login);
      }
      if (page * 100 >= result.total_count) break;
      if (!result.items.length) throw new Error("Public-user search pagination ended early.");
    }
  }
  return candidates;
}

async function verifyProfile(api, requestedLogin) {
  const repoPath = `repos/${requestedLogin}/${requestedLogin}`;
  const repo = await api(repoPath);
  const login = profileLogin(repo);
  if (!login || repo.fork || repo.archived) return { rejected: "not a public, non-fork, unarchived user profile" };
  const head = await api(`${repoPath}/commits/${encodeURIComponent(repo.default_branch)}`);
  if (!SHA_RE.test(head?.sha || "")) throw new Error(`Could not bind the current profile revision for ${login}.`);
  const ref = `?ref=${head.sha}`;
  // GitHub renders code examples and reference-style images; /readme can fall back outside the profile root.
  const html = await api(`${repoPath}/contents/README.md${ref}`, "application/vnd.github.html+json");
  const graphFile = await api(`${repoPath}/contents/project-map/graph.json${ref}`);
  const svgFile = await api(`${repoPath}/contents/project-map/galaxy.svg${ref}`);
  const graphText = decodeFile(graphFile);
  const svg = decodeFile(svgFile);
  const imageRefs = typeof html === "string" ? profileImageRefs(html, login) : [];
  if (!graphText || !svg || !imageRefs.length || imageRefs.length > 10) return { rejected: "missing profile embed or generated files" };
  let graph;
  try { graph = JSON.parse(graphText); } catch { return { rejected: "invalid graph JSON" }; }
  if (typeof graph?.owner !== "string" || graph.owner.toLowerCase() !== login.toLowerCase()
    || !Array.isArray(graph.nodes) || graph.nodes.length > 520 || !Array.isArray(graph.edges)
    || !graph.nodes.some((node) => node?.type === "owner" && typeof node.id === "string" && node.id.toLowerCase() === `user:${login.toLowerCase()}`)
    || typeof graph.generatedAt !== "string" || !Number.isFinite(Date.parse(graph.generatedAt)) || !/<svg\b/.test(svg)) {
    return { rejected: "generated artifacts do not identify this account's map" };
  }
  const blob = `https://github.com/${repo.full_name}/blob/${head.sha}`;
  let embeddedSvgUrl;
  for (const imageRef of imageRefs) {
    if (["HEAD", repo.default_branch, head.sha].includes(imageRef)) {
      embeddedSvgUrl = `${blob}/project-map/galaxy.svg`;
      break;
    }
    const imageHead = await api(`${repoPath}/commits/${encodeURIComponent(imageRef)}`);
    if (!SHA_RE.test(imageHead?.sha || "")) continue;
    const embeddedSvg = decodeFile(await api(`${repoPath}/contents/project-map/galaxy.svg?ref=${imageHead.sha}`));
    if (embeddedSvg && /<svg\b/.test(embeddedSvg)) {
      embeddedSvgUrl = `https://github.com/${repo.full_name}/blob/${imageHead.sha}/project-map/galaxy.svg`;
      break;
    }
  }
  if (!embeddedSvgUrl) return { rejected: "the profile's referenced SVG is missing or invalid" };
  return { user: {
    login, profileRepository: repo.full_name, commit: head.sha,
    readmeUrl: `${blob}/README.md`, graphUrl: `${blob}/project-map/graph.json`,
    svgUrl: `${blob}/project-map/galaxy.svg`, embeddedSvgUrl, graphGeneratedAt: graph.generatedAt,
  } };
}

function renderReadme(readme, snapshot) {
  if (readme.split(START).length !== 2 || readme.split(END).length !== 2 || readme.indexOf(END) < readme.indexOf(START)) {
    throw new Error("README must contain exactly one ordered public-users marker pair.");
  }
  if (!Number.isFinite(Date.parse(snapshot.checkedAt)) || !Array.isArray(snapshot.users)) throw new Error("Invalid public-users snapshot.");
  const seen = new Set();
  for (const user of snapshot.users) {
    if (!USERNAME_RE.test(user.login || "") || !SHA_RE.test(user.commit || "") || seen.has(user.login.toLowerCase())) throw new Error("Invalid or duplicate public user.");
    seen.add(user.login.toLowerCase());
  }
  const count = snapshot.users.length;
  const block = `${START}\n<p align="center">\n  <a href="docs/public-users.md"><strong>Public users: ${count} verified GitHub account${count === 1 ? "" : "s"}</strong></a><br />\n  <sub>Public profile installations · includes maintainers · checked ${snapshot.checkedAt.slice(0, 10)} · <a href="data/public-users.json">evidence</a></sub>\n</p>\n${END}`;
  return readme.slice(0, readme.indexOf(START)) + block + readme.slice(readme.indexOf(END) + END.length);
}

export async function updatePublicUsers({ root, api = githubApi, include = [], checkedAt = new Date().toISOString(), check = false }) {
  const snapshotPath = join(root, "data/public-users.json");
  const readmePath = join(root, "README.md");
  const readme = await readFile(readmePath, "utf8");
  let previous = null;
  try { previous = JSON.parse(await readFile(snapshotPath, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (check) {
    if (!previous || renderReadme(readme, previous) !== readme) throw new Error("README public-user count is out of sync with data/public-users.json.");
    return previous;
  }
  for (const login of include) if (!USERNAME_RE.test(login)) throw new Error(`Invalid GitHub username: ${login}`);
  // Previously verified profiles survive search-index omissions, but are always reverified.
  const candidates = new Map();
  const knownLogins = previous?.users.map((user) => user.login) ?? [];
  for (const login of [...await discoverProfiles(api), ...knownLogins, ...include]) {
    if (!USERNAME_RE.test(login)) throw new Error("Invalid candidate username.");
    if (!candidates.has(login.toLowerCase())) candidates.set(login.toLowerCase(), login);
  }
  if (candidates.size > 1000) throw new Error("Public-user candidate limit exceeded.");
  const users = [];
  const rejected = [];
  for (const login of candidates.values()) {
    const result = await verifyProfile(api, login);
    if (result.user) users.push(result.user);
    else rejected.push({ login, reason: result.rejected });
  }
  users.sort((a, b) => a.login.toLowerCase().localeCompare(b.login.toLowerCase()));
  const snapshot = { checkedAt, scope: "Verified public profile installations; a lower bound, including maintainers, not active users or total people.", searchQueries: SEARCH_QUERIES, users, rejected };
  const updated = renderReadme(readme, snapshot);
  // Finish all read-only API checks before replacing either checked-in artifact.
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  await writeFile(readmePath, updated);
  return snapshot;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { values } = parseArgs({ options: { check: { type: "boolean" }, include: { type: "string", multiple: true } } });
    if (values.check && values.include?.length) throw new Error("--include cannot be used with --check.");
    const snapshot = await updatePublicUsers({ root: fileURLToPath(new URL("../", import.meta.url)), check: values.check, include: values.include });
    console.log(`${values.check ? "Checked" : "Updated"} public users: ${snapshot.users.length} (${snapshot.users.map((user) => user.login).join(", ") || "none verified"}).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
