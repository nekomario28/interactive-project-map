#!/usr/bin/env node

export function githubAppRegistrationUrl(origin, options = {}) {
  const worker = new URL(String(origin || ""));
  if (worker.protocol !== "https:") throw new Error("Worker origin must use https");
  if (worker.pathname !== "/" || worker.search || worker.hash) throw new Error("Pass only the Worker origin, without a path, query, or fragment");

  const name = String(options.name || "interactive-project-map").trim();
  if (!name) throw new Error("GitHub App name is required");

  const registration = new URL("https://github.com/settings/apps/new");
  registration.searchParams.set("name", name);
  registration.searchParams.set("description", "Install and repair the Project Map workflow for a GitHub profile repository");
  registration.searchParams.set("url", worker.origin);
  registration.searchParams.append("callback_urls[]", `${worker.origin}/api/install/callback`);
  registration.searchParams.set("request_oauth_on_install", "true");
  registration.searchParams.set("public", "true");
  registration.searchParams.set("webhook_active", "false");
  registration.searchParams.set("contents", "write");
  registration.searchParams.set("workflows", "write");
  registration.searchParams.set("actions", "write");
  return registration.toString();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const origin = process.argv[2];
  if (!origin) {
    console.error("Usage: node scripts/github-app-registration-url.mjs https://YOUR-WORKER.workers.dev");
    process.exitCode = 2;
  } else {
    try {
      console.log(githubAppRegistrationUrl(origin));
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 2;
    }
  }
}
