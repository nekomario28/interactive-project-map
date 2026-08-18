import { buildGraph } from "./graph";
import { fetchPublicRepos } from "./github";
import { renderHome, renderViewer } from "./html";
import { renderGalaxySvg } from "./svg";
import type { Env } from "./types";

const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

function corsHeaders(extra: Record<string, string> = {}): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extra,
  });
}

function intParam(url: URL, key: string, fallback: number, min: number, max: number): number {
  const value = url.searchParams.get(key);
  if (value === null || value.trim() === "") return fallback;

  const raw = Number(value);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.round(raw)));
}

function boolParam(url: URL, key: string, fallback: boolean): boolean {
  const raw = url.searchParams.get(key);
  if (raw == null || raw.trim() === "") return fallback;

  const value = raw.toLowerCase();
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return fallback;
}

function usernameFrom(url: URL): string {
  const value = (url.searchParams.get("username") || "").trim();
  if (!USERNAME_RE.test(value)) throw new Error("Invalid GitHub username");
  return value;
}

async function graphFromRequest(request: Request, env: Env) {
  const url = new URL(request.url);
  const username = usernameFrom(url);
  const maxRepos = intParam(url, "max_repos", 100, 1, 300);
  const includeForks = boolParam(url, "forks", true);
  const includeArchived = boolParam(url, "archived", false);
  const repos = await fetchPublicRepos(username, env, maxRepos);
  return buildGraph(username, repos, includeForks, includeArchived);
}

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unknown error";
  let status = 500;

  if (message.includes("Invalid GitHub username") || error instanceof URIError) status = 400;
  else if (message.includes("not found")) status = 404;
  else if (message.includes("rate limit")) status = 429;
  else if (message.startsWith("GitHub API returned")) status = 502;

  return Response.json({ error: message }, { status, headers: corsHeaders({ "Cache-Control": "no-store" }) });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
    if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });

    try {
      if (url.pathname === "/") {
        return new Response(renderHome(url.origin), {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
        });
      }

      if (url.pathname === "/health") {
        return Response.json({ ok: true, service: "github-project-galaxy-api" }, { headers: corsHeaders() });
      }

      if (url.pathname === "/api/graph") {
        const graph = await graphFromRequest(request, env);
        return Response.json(graph, {
          headers: corsHeaders({ "Cache-Control": "public, max-age=900, s-maxage=1800" }),
        });
      }

      if (url.pathname === "/api/galaxy.svg") {
        const graph = await graphFromRequest(request, env);
        const theme = url.searchParams.get("theme") === "light" ? "light" : "dark";
        const width = intParam(url, "width", 740, 420, 1600);
        const height = intParam(url, "height", 420, 260, 1000);
        const svg = renderGalaxySvg(graph, theme, width, height);
        return new Response(svg, {
          headers: corsHeaders({
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=900, s-maxage=1800",
          }),
        });
      }

      if (url.pathname.startsWith("/u/")) {
        const username = decodeURIComponent(url.pathname.slice(3)).trim();
        if (!USERNAME_RE.test(username)) return new Response("Invalid GitHub username", { status: 400 });
        return new Response(renderViewer(username), {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
        });
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      return errorResponse(error);
    }
  },
};
