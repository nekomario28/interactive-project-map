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

export function censusRetryDelay(attempt) {
  return Math.min(2 ** attempt * 1_000, MAX_CENSUS_DELAY_MS);
}

export async function retryCensusRequest(request, {
  attempts = 4,
  maxDelayMs = MAX_CENSUS_DELAY_MS,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  for (let attempt = 0; ; attempt += 1) {
    let error;
    try {
      return await request();
    } catch (failure) {
      error = failure;
    }
    const stderr = error?.stderr ?? "";
    const transient = RETRY_STATUS_RE.test(stderr) || /timed out|ECONNRESET|ETIMEDOUT|socket hang up/i.test(String(error?.message ?? ""));
    if (!transient || attempt + 1 >= attempts) throw error;
    await sleep(Math.min(censusRetryDelay(attempt), maxDelayMs));
  }
}

async function githubApi(endpoint, accept = "application/vnd.github+json") {
  let stdout;
  try {
    ({ stdout } = await retryCensusRequest(() => run("gh", ["api", "--hostname", "github.com", "-H", `Accept: ${accept}`, endpoint], {
      timeout: 30_000, maxBuffer: 2 * 1024 * 1024,
    })));
  } catch (error) {
    if (/\(HTTP 404\)/.test(error.stderr || "")) return null;
    const status = /\(HTTP (\d{3})\)/.exec(error.stderr || "")?.[1];
    throw new Error(`GitHub request failed${status ? ` (HTTP ${status})` : ""} for ${endpoint}. Check gh authentication, rate limits and connectivity.`, { cause: error });
  }
  return accept === "application/vnd.github.html+json" ? stdout : JSON.parse(stdout);
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
