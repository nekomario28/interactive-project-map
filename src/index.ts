import { renderHome } from "./home";
import {
  beginGitHubAppInstall,
  clearInstallNonceCookie,
  completeGitHubAppInstall,
  installerErrorStatus,
  type GitHubAppInstallerEnv,
} from "./github-app-installer.ts";
import { getGraph, normalizeUsername, type WorkerContext } from "./hosted";
import { installOptionsFromUrl, renderInstallWorkflow } from "./install";
import { intParam } from "./params";
import { renderGalaxySvg } from "./svg";
import type { Env } from "./types";
import { renderViewer } from "./viewer";

type WorkerEnv = Env & GitHubAppInstallerEnv;

function corsHeaders(extra: Record<string, string> = {}): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extra,
  });
}

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unknown error";
  let status = installerErrorStatus(error) ?? 500;

  if (status === 500 && (message.includes("Invalid GitHub username") || error instanceof URIError)) status = 400;
  else if (status === 500 && message.includes("not found")) status = 404;
  else if (status === 500 && (message.includes("rate limit") || message.includes("Too many uncached") || message.includes("service is busy"))) status = 429;
  else if (status === 500 && message.startsWith("GitHub API returned")) status = 502;

  return Response.json({ error: message }, { status, headers: corsHeaders({ "Cache-Control": "no-store" }) });
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: WorkerContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
    if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });

    try {
      if (url.pathname === "/") {
        return new Response(renderHome(url.origin), {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
          },
        });
      }

      if (url.pathname === "/health") {
        return Response.json({ ok: true, service: "github-project-galaxy-api" }, { headers: corsHeaders() });
      }

      if (url.pathname === "/api/install-workflow") {
        const options = installOptionsFromUrl(url);
        return new Response(renderInstallWorkflow(options), {
          headers: corsHeaders({
            "Content-Type": "text/yaml; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "X-Content-Type-Options": "nosniff",
          }),
        });
      }

      if (url.pathname === "/api/install/start") {
        const options = installOptionsFromUrl(url);
        return await beginGitHubAppInstall(request, env, options);
      }

      if (url.pathname === "/api/install/callback") {
        try {
          const result = await completeGitHubAppInstall(request, env);
          return new Response(null, {
            status: 303,
            headers: {
              Location: result.viewerUrl,
              "Set-Cookie": clearInstallNonceCookie(),
              "Cache-Control": "no-store",
              "Referrer-Policy": "no-referrer",
            },
          });
        } catch (error) {
          const response = errorResponse(error);
          response.headers.append("Set-Cookie", clearInstallNonceCookie());
          return response;
        }
      }

      if (url.pathname === "/api/graph") {
        const { graph, cacheStatus, source } = await getGraph(request, env, ctx);
        return Response.json(graph, {
          headers: corsHeaders({
            "Cache-Control": "public, max-age=300, s-maxage=900",
            "X-Project-Map-Cache": cacheStatus,
            "X-Project-Map-Source": source,
          }),
        });
      }

      if (url.pathname === "/api/galaxy.svg") {
        const { graph, cacheStatus, source } = await getGraph(request, env, ctx);
        const theme = url.searchParams.get("theme") === "light" ? "light" : "dark";
        const width = intParam(url, "width", 740, 420, 1600);
        const height = intParam(url, "height", 420, 260, 1000);
        const svg = renderGalaxySvg(graph, theme, width, height);
        return new Response(svg, {
          headers: corsHeaders({
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=300, s-maxage=900",
            "X-Project-Map-Cache": cacheStatus,
            "X-Project-Map-Source": source,
            "X-Content-Type-Options": "nosniff",
          }),
        });
      }

      if (url.pathname.startsWith("/u/")) {
        const username = normalizeUsername(decodeURIComponent(url.pathname.slice(3)));
        return new Response(renderViewer(username), {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "Content-Security-Policy": "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
          },
        });
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      return errorResponse(error);
    }
  },
};
