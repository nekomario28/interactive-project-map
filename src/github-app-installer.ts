import { normalizeUsername } from "./hosted-options.ts";
import { renderInstallWorkflow, staticAssetUrls, type InstallOptions } from "./install.ts";

const GITHUB_API = "https://api.github.com";
const GITHUB_API_VERSION = "2026-03-10";
const OAUTH_TOKEN_URL = "https://github.com/login/oauth/access_token";
const INSTALL_NONCE_COOKIE = "project_map_install_nonce";
const INSTALL_STATE_VERSION = 1;
const INSTALL_STATE_TTL_SECONDS = 15 * 60;
const WORKFLOW_PATH = ".github/workflows/project-map.yml";
const WORKFLOW_FILE = "project-map.yml";
export const MANAGED_WORKFLOW_MARKER = "# Managed by interactive-project-map one-click installer v1";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface GitHubAppInstallerEnv {
  GITHUB_APP_CLIENT_ID?: string;
  GITHUB_APP_CLIENT_SECRET?: string;
  GITHUB_APP_SLUG?: string;
  INSTALL_STATE_SECRET?: string;
}

export interface InstallStatePayload extends InstallOptions {
  v: 1;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}

export interface InstallCompletion {
  username: string;
  repository: string;
  workflow: "created" | "updated" | "unchanged";
  viewerUrl: string;
}

interface InstallerRuntime {
  fetchImpl?: typeof fetch;
  nowMs?: number;
  nonce?: string;
  sleep?: (milliseconds: number) => Promise<void>;
}

interface GitHubInstallation {
  id: number;
  account?: { login?: string; type?: string };
}

interface GitHubRepository {
  full_name: string;
  default_branch: string;
  private?: boolean;
  permissions?: { admin?: boolean; push?: boolean };
}

interface ExistingWorkflow {
  sha: string;
  content: string;
}

export class InstallerError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "InstallerError";
    this.status = status;
    this.code = code;
  }
}

function requireConfiguredValue(value: string | undefined, name: string): string {
  if (!value) throw new InstallerError(`${name} is not configured`, 503, "installer_not_configured");
  return value;
}

function requireStateSecret(secret: string | undefined): string {
  const value = requireConfiguredValue(secret, "INSTALL_STATE_SECRET");
  if (encoder.encode(value).byteLength < 32) {
    throw new InstallerError("INSTALL_STATE_SECRET must be at least 32 bytes", 503, "installer_not_configured");
  }
  return value;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new InstallerError("Invalid installer state", 400, "invalid_state");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    throw new InstallerError("Invalid installer state", 400, "invalid_state");
  }
}

function encodeJson(value: unknown): string {
  return bytesToBase64Url(encoder.encode(JSON.stringify(value)));
}

function decodeJson(value: string): unknown {
  try {
    return JSON.parse(decoder.decode(base64UrlToBytes(value)));
  } catch (error) {
    if (error instanceof InstallerError) throw error;
    throw new InstallerError("Invalid installer state", 400, "invalid_state");
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function signPayload(payloadPart: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payloadPart));
  return bytesToBase64Url(new Uint8Array(signature));
}

function randomNonce(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24)));
}

function validInstallOptions(payload: Record<string, unknown>): InstallOptions {
  const username = normalizeUsername(typeof payload.username === "string" ? payload.username : "");
  const theme = payload.theme === "light" ? "light" : payload.theme === "dark" ? "dark" : null;
  const maxRepos = payload.maxRepos;
  const includeForks = payload.includeForks;
  const includeArchived = payload.includeArchived;
  if (!theme || !Number.isInteger(maxRepos) || Number(maxRepos) < 1 || Number(maxRepos) > 300 || typeof includeForks !== "boolean" || typeof includeArchived !== "boolean") {
    throw new InstallerError("Invalid installer state options", 400, "invalid_state");
  }
  return { username, theme, maxRepos: Number(maxRepos), includeForks, includeArchived };
}

export async function createInstallState(options: InstallOptions, secret: string, runtime: InstallerRuntime = {}): Promise<{ state: string; nonce: string }> {
  requireStateSecret(secret);
  const nowSeconds = Math.floor((runtime.nowMs ?? Date.now()) / 1000);
  const nonce = runtime.nonce ?? randomNonce();
  if (!nonce || nonce.length > 256) throw new InstallerError("Invalid installer nonce", 400, "invalid_state");
  const payload: InstallStatePayload = {
    v: INSTALL_STATE_VERSION,
    ...options,
    nonce,
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + INSTALL_STATE_TTL_SECONDS,
  };
  const payloadPart = encodeJson(payload);
  return { state: `${payloadPart}.${await signPayload(payloadPart, secret)}`, nonce };
}

export async function verifyInstallState(state: string, secret: string, cookieNonce: string | null, runtime: InstallerRuntime = {}): Promise<InstallStatePayload> {
  requireStateSecret(secret);
  const parts = state.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new InstallerError("Invalid installer state", 400, "invalid_state");
  const [payloadPart, signaturePart] = parts;
  const verified = await crypto.subtle.verify("HMAC", await hmacKey(secret), base64UrlToBytes(signaturePart), encoder.encode(payloadPart));
  if (!verified) throw new InstallerError("Invalid installer state signature", 400, "invalid_state");

  const raw = decodeJson(payloadPart);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new InstallerError("Invalid installer state", 400, "invalid_state");
  const record = raw as Record<string, unknown>;
  const options = validInstallOptions(record);
  const v = record.v;
  const nonce = record.nonce;
  const issuedAt = record.issuedAt;
  const expiresAt = record.expiresAt;
  const nowSeconds = Math.floor((runtime.nowMs ?? Date.now()) / 1000);
  if (v !== INSTALL_STATE_VERSION || typeof nonce !== "string" || !nonce || typeof issuedAt !== "number" || typeof expiresAt !== "number") {
    throw new InstallerError("Invalid installer state", 400, "invalid_state");
  }
  if (!cookieNonce || cookieNonce !== nonce) throw new InstallerError("Installer state cookie mismatch", 400, "state_cookie_mismatch");
  if (issuedAt > nowSeconds + 60 || expiresAt < nowSeconds || expiresAt - issuedAt !== INSTALL_STATE_TTL_SECONDS) {
    throw new InstallerError("Installer state expired", 400, "expired_state");
  }
  return { v: INSTALL_STATE_VERSION, ...options, nonce, issuedAt, expiresAt };
}

function installNonceCookie(nonce: string): string {
  return `${INSTALL_NONCE_COOKIE}=${nonce}; Path=/api/install/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=${INSTALL_STATE_TTL_SECONDS}`;
}

export function clearInstallNonceCookie(): string {
  return `${INSTALL_NONCE_COOKIE}=; Path=/api/install/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
}

function validateAppSlug(slug: string): string {
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) throw new InstallerError("GITHUB_APP_SLUG is invalid", 503, "installer_not_configured");
  return slug;
}

export function isGitHubAppInstallerConfigured(env: GitHubAppInstallerEnv): boolean {
  return Boolean(env.GITHUB_APP_CLIENT_ID && env.GITHUB_APP_CLIENT_SECRET && env.GITHUB_APP_SLUG && env.INSTALL_STATE_SECRET && encoder.encode(env.INSTALL_STATE_SECRET).byteLength >= 32);
}

export async function beginGitHubAppInstall(request: Request, env: GitHubAppInstallerEnv, options: InstallOptions, runtime: InstallerRuntime = {}): Promise<Response> {
  const slug = validateAppSlug(requireConfiguredValue(env.GITHUB_APP_SLUG, "GITHUB_APP_SLUG"));
  const secret = requireStateSecret(env.INSTALL_STATE_SECRET);
  const { state, nonce } = await createInstallState(options, secret, runtime);
  const target = new URL(`https://github.com/apps/${slug}/installations/new`);
  target.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      "Set-Cookie": installNonceCookie(nonce),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

async function jsonBody(response: Response): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new InstallerError("GitHub returned an invalid response", 502, "github_invalid_response");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new InstallerError("GitHub returned an invalid response", 502, "github_invalid_response");
  return parsed as Record<string, unknown>;
}

async function exchangeOAuthCode(code: string, callbackUrl: string, env: GitHubAppInstallerEnv, fetchImpl: typeof fetch): Promise<string> {
  const clientId = requireConfiguredValue(env.GITHUB_APP_CLIENT_ID, "GITHUB_APP_CLIENT_ID");
  const clientSecret = requireConfiguredValue(env.GITHUB_APP_CLIENT_SECRET, "GITHUB_APP_CLIENT_SECRET");
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: callbackUrl });
  const response = await fetchImpl(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await jsonBody(response);
  if (!response.ok || typeof data.access_token !== "string" || !data.access_token.startsWith("ghu_")) {
    throw new InstallerError("GitHub user authorization failed", 403, "oauth_exchange_failed");
  }
  return data.access_token;
}

function githubHeaders(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": "interactive-project-map-installer",
  };
}

async function githubJson(fetchImpl: typeof fetch, token: string, url: string, init: RequestInit = {}): Promise<{ response: Response; data: Record<string, unknown> }> {
  const response = await fetchImpl(url, { ...init, headers: { ...githubHeaders(token), ...(init.headers ?? {}) } });
  const data = await jsonBody(response);
  return { response, data };
}

async function findProfileRepository(fetchImpl: typeof fetch, token: string, username: string): Promise<GitHubRepository> {
  const { response, data } = await githubJson(fetchImpl, token, `${GITHUB_API}/user/installations?per_page=100`);
  if (!response.ok || !Array.isArray(data.installations)) throw new InstallerError("Could not verify GitHub App installation", 403, "installation_lookup_failed");
  const installations = (data.installations as unknown[]).filter((value): value is GitHubInstallation => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const item = value as GitHubInstallation;
    return Number.isInteger(item.id) && item.account?.type === "User" && item.account.login?.toLowerCase() === username;
  });
  if (!installations.length) throw new InstallerError(`Install the GitHub App on the ${username} account`, 403, "profile_installation_missing");

  const wanted = `${username}/${username}`;
  for (const installation of installations) {
    for (let page = 1; page <= 10; page += 1) {
      const repositoriesResult = await githubJson(fetchImpl, token, `${GITHUB_API}/user/installations/${installation.id}/repositories?per_page=100&page=${page}`);
      if (!repositoriesResult.response.ok || !Array.isArray(repositoriesResult.data.repositories)) {
        throw new InstallerError("Could not verify repository access for the GitHub App", 403, "repository_lookup_failed");
      }
      const repositories = repositoriesResult.data.repositories as unknown[];
      for (const value of repositories) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        const repo = value as GitHubRepository;
        if (repo.full_name?.toLowerCase() !== wanted) continue;
        if (repo.private === true) throw new InstallerError(`${wanted} must be public for Project Map`, 409, "profile_repository_public_required");
        if (!repo.default_branch || !(repo.permissions?.push || repo.permissions?.admin)) {
          throw new InstallerError(`Write access to ${wanted} is required`, 403, "repository_write_required");
        }
        return repo;
      }
      if (repositories.length < 100) break;
    }
  }
  throw new InstallerError(`Select ${wanted} when installing the GitHub App`, 403, "profile_repository_missing");
}

function decodeGitHubContent(value: unknown): string {
  if (typeof value !== "string") throw new InstallerError("GitHub returned an invalid workflow file", 502, "github_invalid_response");
  try {
    const binary = atob(value.replace(/\s+/g, ""));
    return decoder.decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  } catch {
    throw new InstallerError("GitHub returned an invalid workflow file", 502, "github_invalid_response");
  }
}

function encodeGitHubContent(value: string): string {
  const bytes = encoder.encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function readExistingWorkflow(fetchImpl: typeof fetch, token: string, repository: string, branch: string): Promise<ExistingWorkflow | null> {
  const response = await fetchImpl(`${GITHUB_API}/repos/${repository}/contents/${WORKFLOW_PATH}?ref=${encodeURIComponent(branch)}`, { headers: githubHeaders(token) });
  if (response.status === 404) return null;
  const data = await jsonBody(response);
  if (!response.ok || typeof data.sha !== "string") throw new InstallerError("Could not read the existing Project Map workflow", 502, "workflow_read_failed");
  return { sha: data.sha, content: decodeGitHubContent(data.content) };
}

async function upsertManagedWorkflow(fetchImpl: typeof fetch, token: string, repository: GitHubRepository, workflow: string): Promise<InstallCompletion["workflow"]> {
  const existing = await readExistingWorkflow(fetchImpl, token, repository.full_name, repository.default_branch);
  if (existing && !existing.content.startsWith(`${MANAGED_WORKFLOW_MARKER}\n`)) {
    throw new InstallerError(`${WORKFLOW_PATH} already exists and is not managed by Project Map`, 409, "workflow_conflict");
  }
  if (existing?.content === workflow) return "unchanged";

  const body: Record<string, unknown> = {
    message: existing ? "chore: update Project Map workflow" : "chore: install Project Map workflow",
    content: encodeGitHubContent(workflow),
    branch: repository.default_branch,
  };
  if (existing) body.sha = existing.sha;
  const result = await githubJson(fetchImpl, token, `${GITHUB_API}/repos/${repository.full_name}/contents/${WORKFLOW_PATH}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!result.response.ok) {
    const accepted = result.response.headers.get("X-Accepted-GitHub-Permissions");
    const hint = accepted ? ` Required GitHub App permissions: ${accepted}.` : "";
    throw new InstallerError(`Could not write the Project Map workflow.${hint}`, result.response.status === 403 ? 403 : 502, "workflow_write_failed");
  }
  return existing ? "updated" : "created";
}

async function dispatchWorkflow(fetchImpl: typeof fetch, token: string, repository: GitHubRepository, sleep: (milliseconds: number) => Promise<void>): Promise<void> {
  const delays = [0, 250, 1000];
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) await sleep(delays[attempt]);
    const response = await fetchImpl(`${GITHUB_API}/repos/${repository.full_name}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
      method: "POST",
      headers: { ...githubHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ ref: repository.default_branch }),
    });
    if (response.status === 204) return;
    if (response.status === 404 && attempt + 1 < delays.length) continue;
    const accepted = response.headers.get("X-Accepted-GitHub-Permissions");
    const hint = accepted ? ` Required GitHub App permissions: ${accepted}.` : "";
    throw new InstallerError(`Project Map was installed but its first workflow run could not be started.${hint}`, response.status === 403 ? 403 : 502, "workflow_dispatch_failed");
  }
}

export async function completeGitHubAppInstall(request: Request, env: GitHubAppInstallerEnv, runtime: InstallerRuntime = {}): Promise<InstallCompletion> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) throw new InstallerError("GitHub authorization callback is missing code or state", 400, "invalid_callback");
  const payload = await verifyInstallState(state, requireStateSecret(env.INSTALL_STATE_SECRET), readCookie(request.headers.get("Cookie"), INSTALL_NONCE_COOKIE), runtime);
  const fetchImpl = runtime.fetchImpl ?? fetch;
  const callbackUrl = new URL("/api/install/callback", url.origin).toString();
  const token = await exchangeOAuthCode(code, callbackUrl, env, fetchImpl);
  const repository = await findProfileRepository(fetchImpl, token, payload.username);
  const workflowBody = `${MANAGED_WORKFLOW_MARKER}\n${renderInstallWorkflow(payload)}`;
  const workflow = await upsertManagedWorkflow(fetchImpl, token, repository, workflowBody);
  await dispatchWorkflow(fetchImpl, token, repository, runtime.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))));
  const viewer = new URL(staticAssetUrls(url.origin, payload).viewer);
  viewer.searchParams.set("install", workflow);
  return { username: payload.username, repository: repository.full_name, workflow, viewerUrl: viewer.toString() };
}

export function installerErrorStatus(error: unknown): number | null {
  return error instanceof InstallerError ? error.status : null;
}
